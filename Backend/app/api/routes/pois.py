from fastapi import APIRouter, Response, Request, Query, Header, HTTPException
from datetime import datetime, timezone
from typing import Optional
import json
import hashlib
from pymongo.errors import PyMongoError

router = APIRouter(prefix="/poi", tags=["POI"])

def utc_now():
    return datetime.now(timezone.utc)

def to_iso(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat(
            timespec="seconds"
        ).replace("+00:00","Z")
    return value

def public_poi(document: dict, active_languages: set[str],
               requested_languages: Optional[set[str]] = None) -> dict:
    poi_id = document.get("poi_id", document.get("_id"))
    location = document.get("location", {})
    if location.get("type") == "Point":
        coordinates = location.get("coordinates", [0, 0])
        location = {
            "lng": coordinates[0],
            "lat": coordinates[1],
        }
    content = {}
    for lang, value in document.get("content", {}).items():
        if lang not in active_languages:
            continue
        if requested_languages and lang not in requested_languages:
            continue

        content[lang] = {
            "name": value.get("name", ""),
            "address": value.get("address", ""),
            "text": value.get("text", ""),
            "audio_url": value.get("audio_url"),
            "audio_sha256": value.get("audio_sha256"),
            "updated_at": to_iso(value.get("updated_at")),
        }
    return {
        "poi_id": poi_id,
        "zone_id": document.get("zone_id"),
        "category": document.get("category"),
        "location": location,
        "geofence_radius_m": document.get("geofence_radius_m", 30),
        "qr_code": document.get("qr_code"),
        "images": document.get("images", []),
        "content": content,
        "updated_at": to_iso(document.get("updated_at")),
    }

async def get_active_languages(db) -> set[str]:
    cursor = db["languages"].find(
        {"is_active": True},
        {"_id": 1},
    )

    documents = await cursor.to_list(length=100)
    return {document["_id"] for document in documents}

async def find_active_poi(db, field: str, value: str):
    return await db["pois"].find_one({
        field: value,
        "status": "active"
    })

@router.get("/load-all")
async def load_all_pois(
    request: Request,
    response: Response,
    updated_after: Optional[datetime] = Query(default=None),
    langs: Optional[str] = Query(default=None),
    if_none_match: Optional[str] = Header(default=None, alias="If-None-Match"),
):
    db = request.app.state.db

    try:
        active_languages = await get_active_languages(db)
        requested_languages = (
            {item.strip() for item in langs.split(",") if item.strip()}
            if langs else active_languages
        )

        requested_languages &= active_languages

        query = {"status": "active"}
        if updated_after:
            if updated_after.tzinfo is None:
                updated_after = updated_after.replace(tzinfo = timezone.utc)
            query["updated_at"] = {
                "$gt": updated_after.astimezone(timezone.utc)
            }

        cursor = db["pois"].find(query).sort("updated_at",1)
        documents = await cursor.to_list(length=10000)

        pois = [
            public_poi(doc,active_languages, requested_languages)
            for doc in documents
        ]

        canonical = json.dumps(
            pois, ensure_ascii=False, sort_keys=True,
            separators=(",",":"),
        )

        etag = '"' + hashlib.sha1(canonical.encode("utf-8")).hexdigest() + '"'

        response.headers["ETag"] = etag
        response.headers["Cache-Control"] = "no-cache"

        if if_none_match == etag:
            return Response(status_code=304, headers={
                "Etag": etag,
                "Cache-Control": "no-cache",
            })

        return {
            "updated_pois": pois,
            "delete_poi_ids": [],
            "sync_timestamp": to_iso(utc_now()),
        }

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="MongoDB hiện không khả dụng",
        )

@router.get("/hotset")
async def get_hotset(
    request: Request,
    lat: float = Query(..., ge=-90, le= 90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(default=1.5, ge=0.1, le=5),
    limit: int = Query(default=10, ge=1, le=20),
    lang: str = Query(default="vi"),
):
    db = request.app.state.db

    try:
        active_languages = await get_active_languages(db)
        if lang not in active_languages:
            raise HTTPException(
                status_code=422,
                detail="Ngôn ngữ không khả dụng",
            )

        pipeline = [
            {
                "$geoNear": {
                    "near": {
                        "type": "Point",
                        "coordinates": [lng, lat],
                    },
                    "key": "location",
                    "distanceField": "distance_m",
                    "maxDistance": radius_km * 1000,
                    "spherical": True,
                    "query": {"status": "active"},
                }
            },
            {"$limit": limit},
            {
                "$project": {
                    "_id": 1,
                    "poi_id": 1,
                    "content": 1,
                    "distance_m": 1,
                }
            },
        ]

        documents = await db["pois"].aggregate(pipeline).to_list(length=limit)

        results = []
        for document in documents:
            content = document.get("content", {}).get(lang, {})
            audio_url = content.get("audio_url")
            results.append({
                "poi_id": document.get("poi_id", document.get("_id")),
                "distance_m": round(document.get("distance_m", 0), 2),
                "audio_ready": audio_url is not None,
                "audio_url": audio_url,
                "audio_sha256": content.get("audio_sha256"),
            })

        return {"hotset_pois": results}

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="Không thể truy vấn vị trí POI",
        )

@router.get("/{poi_id}")
async def get_poi_detail(
    poi_id: str,
    request: Request,
    lang: str = Query(default="vi"),
    qr_code: Optional[str] = None,
):
    db = request.app.state.db

    try:
        active_languages = await get_active_languages(db)
        if lang not in active_languages:
            raise HTTPException(
                status_code=422,
                detail="Ngôn ngữ chưa được bật",
            )

        if qr_code is not None:
            document = await find_active_poi(
                db, "qr_code", qr_code
            )
            trigger_source = "qr_scan"
        else:
            document = await db["pois"].find_one({
                "$and": [
                    {"status": "active"},
                    {
                        "$or": [
                            {"_id": poi_id},
                            {"poi_id": poi_id},
                        ]
                    },
                ]
            })
            trigger_source = "manual_tap"

        if not document:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "QR_NOT_FOUND" if qr_code else "POI_NOT_FOUND",
                    "message": "Không tìm thấy địa điểm",
                },
            )

        poi = public_poi(document, active_languages)
        content = poi["content"].get(lang, {})
        audio_url = content.get("audio_url")
        tiers = ["tier3_local_tts"]
        if audio_url:
            tiers.insert(0, "tier1_pregen")

        result = {
            "poi": poi,
            "audio_url": audio_url,
            "trigger_source": trigger_source,
        }

        if qr_code is not None:
            result["poi_id"] = poi["poi_id"]
            result["name"] = content.get("name", "")

        return result

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="MongoDB hiện không khả dụng",
        )

@router.get("/by-qr/{qr_code}")
async def get_poi_by_qr(
    qr_code: str,
    request: Request,
    lang: str = Query(default="vi"),
):
    return await get_poi_detail(
        poi_id=None,
        request=request,
        lang=lang,
        qr_code=qr_code,
    )


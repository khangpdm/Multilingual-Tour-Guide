from fastapi import APIRouter, Response, Request, Query, Header, HTTPException
from datetime import datetime, timezone
from typing import Optional
import hashlib
from pymongo.errors import PyMongoError
from app.services.utils import utc_now
from app.services.pois_service import to_iso, public_poi, get_active_languages, find_active_poi
router = APIRouter(prefix="/poi", tags=["POI"])


@router.get("/poi/load-all")
async def load_all_pois(
    request: Request,
    response: Response,
    updated_after: Optional[datetime] = Query(default=None),
    langs: Optional[str] = Query(default=None),
    if_none_match: Optional[str] = Header(default=None, alias="If-None-Match"),
):
    """
    G3. GET /poi/load-all — Delta Sync
    """
    db_pool = request.app.state.db_pool

    try:
        sync_timestamp = datetime.now(timezone.utc)

        async with db_pool.acquire() as conn:
            async with conn.cursor() as cursor:
                active_languages = await get_active_languages(db_pool)
                requested_languages = (
                    {item.strip() for item in langs.split(",") if item.strip()}
                    if langs else active_languages
                )
                requested_languages &= active_languages

                if updated_after:
                    if updated_after.tzinfo is None:
                        updated_after = updated_after.replace(tzinfo=timezone.utc)
                    updated_after_dt = updated_after.astimezone(timezone.utc)

                    sql = """
                        SELECT id, zone_id, category, status, radius, qr_code, images, updated_at,
                               ST_X(location) as lng, ST_Y(location) as lat
                        FROM poi 
                        WHERE updated_after > %s OR (status = 'inactive' AND updated_at > %s)
                        ORDER BY updated_at ASC
                    """
                    await cursor.execute(
                        """
                        SELECT id, zone_id, category, status, radius, qr_code, images, updated_at,
                               ST_X(location) as lng, ST_Y(location) as lat
                        FROM poi 
                        WHERE updated_at > %s
                        ORDER BY updated_at ASC
                        """,
                        (updated_after_dt,)
                    )
                else:
                    await cursor.execute(
                        """
                        SELECT id, zone_id, category, status, radius, qr_code, images, updated_at,
                               ST_X(location) as lng, ST_Y(location) as lat
                        FROM poi 
                        WHERE status = 'active'
                        ORDER BY updated_at ASC
                        """
                    )
                
                poi_rows = await cursor.fetchall()

                documents = []
                for prow in poi_rows:
                    poi_id = prow[0]
                    await cursor.execute(
                        """
                        SELECT language_code, name, address, description, text, 
                               audio_url, audio_sha256, updated_at
                        FROM poi_content WHERE poi_id = %s
                        """,
                        (poi_id,)
                    )
                    content_rows = await cursor.fetchall()
                    content_dict = {}
                    for crow in content_rows:
                        content_dict[crow[0]] = {
                            "name": crow[1], "address": crow[2], "description": crow[3],
                            "text": crow[4], "audio_url": crow[5], "audio_sha256": crow[6], "updated_at": crow[7]
                        }

                    documents.append({
                        "poi_id": poi_id,
                        "zone_id": prow[1],
                        "category": prow[2],
                        "status": prow[3],
                        "geofence_radius_m": prow[4],
                        "qr_code": prow[5],
                        "images": prow[6] if isinstance(prow[6], list) else [],
                        "updated_at": prow[7],
                        "location": {"lng": prow[8], "lat": prow[9]},
                        "content": content_dict
                    })

        active_docs = [doc for doc in documents if doc.get("status") == "active"]
        inactive_docs = [doc for doc in documents if doc.get("status") == "inactive"]

        pois = [
            public_poi(doc, active_languages, requested_languages)
            for doc in active_docs
        ]
        deleted_poi_ids = [str(doc.get("poi_id")) for doc in inactive_docs]

        max_updated_at = max((doc.get("updated_at") for doc in documents if doc.get("updated_at")), default=sync_timestamp)
        max_updated_iso = to_iso(max_updated_at)
        sorted_langs_str = ",".join(sorted(requested_languages))
        updated_after_iso = to_iso(updated_after) if updated_after else ""

        etag_payload = f"{updated_after_iso}|{sorted_langs_str}|{max_updated_iso}|{len(active_docs)}"
        etag = '"' + hashlib.sha1(etag_payload.encode("utf-8")).hexdigest() + '"'

        response.headers["ETag"] = etag
        response.headers["Cache-Control"] = "no-cache"

        if if_none_match == etag:
            return Response(status_code=304, headers={
                "ETag": etag,
                "Cache-Control": "no-cache",
            })

        return {
            "updated_pois": pois,
            "deleted_poi_ids": deleted_poi_ids,
            "sync_timestamp": to_iso(sync_timestamp),
        }

    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail="Database hiện không khả dụng",
        )


@router.get("/poi/hotset")
async def get_hotset(
    request: Request,
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(default=1.5, ge=0.1, le=5),
    limit: int = Query(default=10, ge=1, le=20),
    lang: str = Query(default="vi"),
):
    db_pool = request.app.state.db_pool

    try:
        active_languages = await get_active_languages(db_pool)
        if lang not in active_languages:
            raise HTTPException(
                status_code=422,
                detail="Ngôn ngữ không khả dụng",
            )

        async with db_pool.acquire() as conn:
            async with conn.cursor() as cursor:
                sql = """
                    SELECT 
                        p.id, 
                        ST_Distance_Sphere(p.location, ST_GeomFromText(CONCAT('POINT(', %s, ' ', %s, ')'), 4326)) AS distance_m,
                        pc.audio_url, pc.audio_sha256
                    FROM poi p
                    LEFT JOIN poi_content pc ON p.id = pc.poi_id AND pc.language_code = %s
                    WHERE p.status = 'active'
                      AND ST_Distance_Sphere(p.location, ST_GeomFromText(CONCAT('POINT(', %s, ' ', %s, ')'), 4326)) <= %s
                    ORDER BY distance_m ASC
                    LIMIT %s
                """
                max_distance_m = radius_km * 1000
                await cursor.execute(sql, (lng, lat, lang, lng, lat, max_distance_m, limit))
                rows = await cursor.fetchall()

        results = []
        for row in rows:
            poi_id = row[0]
            distance_m = row[1]
            audio_url = row[2]
            audio_sha256 = row[3]
            
            results.append({
                "poi_id": poi_id,
                "distance_m": round(float(distance_m), 2) if distance_m is not None else 0.0,
                "audio_ready": audio_url is not None,
                "audio_url": audio_url,
                "audio_sha256": audio_sha256,
            })

        return {"hotset_pois": results}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail="Không thể truy vấn vị trí POI",
        )


async def find_active_poi_by_field(pool, field: str, value: str):
    if field not in {"id", "qr_code"}:
        return None
    
    async with pool.acquire() as conn:
        async with conn.cursor() as cursor:
            await cursor.execute(
                f"""
                SELECT id, zone_id, category, status, radius, qr_code, images, updated_at,
                       ST_X(location) as lng, ST_Y(location) as lat
                FROM poi WHERE {field} = %s AND status = 'active'
                """,
                (value,)
            )
            prow = await cursor.fetchone()
            if not prow:
                return None
            
            poi_id = prow[0]
            await cursor.execute(
                """
                SELECT language_code, name, address, description, text, 
                       audio_url, audio_sha256, updated_at
                FROM poi_content WHERE poi_id = %s
                """,
                (poi_id,)
            )
            content_rows = await cursor.fetchall()
            content_dict = {}
            for crow in content_rows:
                content_dict[crow[0]] = {
                    "name": crow[1], "address": crow[2], "description": crow[3],
                    "text": crow[4], "audio_url": crow[5], "audio_sha256": crow[6], "updated_at": crow[7]
                }

            return {
                "poi_id": poi_id,
                "zone_id": prow[1],
                "category": prow[2],
                "status": prow[3],
                "geofence_radius_m": prow[4],
                "qr_code": prow[5],
                "images": prow[6] if isinstance(prow[6], list) else [],
                "updated_at": prow[7],
                "location": {"lng": prow[8], "lat": prow[9]},
                "content": content_dict
            }


@router.get("/poi/{poi_id}")
async def get_poi_detail(
    poi_id: str,
    request: Request,
    lang: str = Query(default="vi"),
):
    db_pool = request.app.state.db_pool

    try:
        active_languages = await get_active_languages(db_pool)
        if lang not in active_languages:
            raise HTTPException(
                status_code=422,
                detail="Ngôn ngữ chưa được bật",
            )

        document = await find_active_poi_by_field(db_pool, "id", poi_id)
        trigger_source = "manual_tap"

        if not document:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "POI_NOT_FOUND",
                    "message": "Không tìm thấy địa điểm",
                },
            )

        poi = public_poi(document, active_languages)
        content = poi["content"].get(lang, {})
        audio_url = content.get("audio_url")

        tier_available = ["tier3_local_tts"]
        if audio_url is not None:
            tier_available.insert(0, "tier1_pregen")

        return {
            "poi": poi,
            "audio_url": audio_url,
            "audio_tier_available": tier_available,
            "trigger_source": trigger_source,
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database hiện không khả dụng",
        )


@router.get("/poi/by-qr/{qr_code}")
async def get_poi_by_qr(
    qr_code: str,
    request: Request,
    lang: str = Query(default="vi"),
):
    db_pool = request.app.state.db_pool

    try:
        active_languages = await get_active_languages(db_pool)
        if lang not in active_languages:
            raise HTTPException(
                status_code=422,
                detail="Ngôn ngữ chưa được bật",
            )

        document = await find_active_poi_by_field(db_pool, "qr_code", qr_code)
        trigger_source = "qr_scan"

        if not document:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "QR_NOT_FOUND",
                    "message": "Không tìm thấy mã QR",
                },
            )

        poi = public_poi(document, active_languages)
        content = poi["content"].get(lang, {})
        audio_url = content.get("audio_url")

        tier_available = ["tier3_local_tts"]
        if audio_url is not None:
            tier_available.insert(0, "tier1_pregen")

        return {
            "poi_id": poi["poi_id"],
            "name": content.get("name", ""),
            "audio_tier_available": tier_available,
            "audio_url": audio_url,
            "trigger_source": trigger_source,
            "poi": poi,
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database hiện không khả dụng",
        )

from uuid import UUID
from pymongo.errors import PyMongoError, BulkWriteError
from datetime import datetime, timezone, timedelta
import time
from collections import defaultdict

from fastapi import (
    APIRouter,
    HTTPException,
    Request,
    status,
    Header,
    Response,
)

from api.schemas.schemas import TelemetryEventRequest, POIVisitRequest

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])

RATE_LIMIT_WINDOW = 60  # giây
RATE_LIMIT_MAX = 30
ip_request_counts = defaultdict(list)

def check_rate_limit(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    now_ts = time.time()
    
    timestamps = ip_request_counts[client_ip]
    timestamps = [ts for ts in timestamps if now_ts - ts < RATE_LIMIT_WINDOW]
    
    if len(timestamps) >= RATE_LIMIT_MAX:
        retry_after = int(RATE_LIMIT_WINDOW - (now_ts - timestamps[0]))
        raise HTTPException(
            status_code=429,
            detail="Quá giới hạn số lượng request cho phép",
            headers={"Retry-After": str(max(1, retry_after))}
        )
    
    timestamps.append(now_ts)
    ip_request_counts[client_ip] = timestamps

def utc_now():
    return datetime.now(timezone.utc)

def normalize_datetime(value: datetime) -> datetime:
    now = utc_now()

    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)

    value = value.astimezone(timezone.utc)

    if value > now + timedelta(minutes=5):
        return now

    if value < now - timedelta(days=30):
        return now

    return value

async def get_active_locales(db) -> set[str]:
    cursor = db["languages"].find({"is_active": True}, {"_id": 1})
    docs = await cursor.to_list(length=100)
    return {str(doc["_id"]) for doc in docs}

async def poi_exists(db, poi_id: str) -> bool:
    document = await db["pois"].find_one(
        {
            "$or": [
                {"_id": poi_id},
                {"poi_id": poi_id},
            ]
        },
        {"_id": 1},
    )
    return document is not None

async def zone_exists(db, zone_id: str) -> bool:
    document = await db["zones"].find_one(
        {
            "$or": [
                {"_id": zone_id},
                {"zone_id": zone_id},
            ]
        },
        {"_id": 1},
    )
    return document is not None

@router.post("/events", status_code=status.HTTP_202_ACCEPTED)
async def create_telemetry_events(
    body: TelemetryEventRequest,
    request: Request,
    device_id: str = Header(..., alias="X-Device-Id")
):
    check_rate_limit(request)

    db = request.app.state.db

    if len(body.events) > 200:
        raise HTTPException(
            status_code=413,
            detail="Một request không được vượt quá 200 sự kiện",
        )

    try:
        parsed_uuid = UUID(device_id, version=4)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="X-Device-Id phải là UUID v4 hợp lệ",
        )

    active_locales = await get_active_locales(db)
    received_at = utc_now()

    valid_events = []
    rejected = []
    duplicates = 0

    try:
        for event in body.events:
            try:
                event_id = str(UUID(event.client_event_id, version=4))
            except ValueError:
                rejected.append({
                    "client_event_id": event.client_event_id,
                    "reason": "INVALID_CLIENT_EVENT_ID",
                })
                continue

            if event.language_code and event.language_code not in active_locales:
                rejected.append({
                    "client_event_id": event_id,
                    "reason": "INVALID_LANGUAGE_CODE",
                })
                continue

            if event.event_type not in {
                "AUDIO_PLAY",
                "QR_SCAN",
                "PACK_DOWNLOAD",
            }:
                rejected.append({
                    "client_event_id": event_id,
                    "reason": "INVALID_EVENT_TYPE",
                })
                continue

            if event.event_type in {"AUDIO_PLAY", "QR_SCAN"}:
                if not event.poi_id:
                    rejected.append({
                        "client_event_id": event_id,
                        "reason": "POI_ID_REQUIRED",
                    })
                    continue

                if not await poi_exists(db, event.poi_id):
                    rejected.append({
                        "client_event_id": event_id,
                        "reason": "POI_NOT_FOUND",
                    })
                    continue

            if event.event_type == "PACK_DOWNLOAD":
                if not event.zone_id:
                    rejected.append({
                        "client_event_id": event_id,
                        "reason": "ZONE_ID_REQUIRED",
                    })
                    continue

                if not await zone_exists(db, event.zone_id):
                    rejected.append({
                        "client_event_id": event_id,
                        "reason": "ZONE_NOT_FOUND",
                    })
                    continue

            if event.event_type == "AUDIO_PLAY":
                if event.trigger_source not in {
                    "geofence",
                    "qr_scan",
                    "manual_tap",
                }:
                    rejected.append({
                        "client_event_id": event_id,
                        "reason": "INVALID_TRIGGER_SOURCE",
                    })
                    continue

                if event.audio_tier not in {
                    "tier1",
                    "tier1_5",
                    "tier2",
                    "tier3",
                }:
                    rejected.append({
                        "client_event_id": event_id,
                        "reason": "INVALID_AUDIO_TIER",
                    })
                    continue

            existing = await db["analytics_events"].find_one(
                {"client_event_id": event_id},
                {"_id": 1},
            )

            if existing:
                duplicates += 1
                continue

            document = {
                "client_event_id": event_id,
                "event_type": event.event_type,
                "poi_id": event.poi_id,
                "zone_id": event.zone_id,
                "language_code": event.language_code,
                "trigger_source": event.trigger_source,
                "audio_tier": event.audio_tier,
                "occurred_at": normalize_datetime(
                    event.occurred_at
                ),
                "received_at": received_at,
            }

            valid_events.append(document)

        accepted = 0

        if valid_events:
            try:
                result = await db["analytics_events"].insert_many(
                    valid_events,
                    ordered=False,
                )
                accepted = len(result.inserted_ids)

            except BulkWriteError as error:
                details = error.details or {}
                write_errors = details.get("writeErrors", [])

                duplicate_errors = sum(
                    1
                    for item in write_errors
                    if item.get("code") == 11000
                )

                other_errors = [
                    item
                    for item in write_errors
                    if item.get("code") != 11000
                ]

                duplicates += duplicate_errors
                accepted = details.get("nInserted", 0)

                if other_errors:
                    raise

        return {
            "accepted": accepted,
            "duplicates": duplicates,
            "rejected": rejected,
        }

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="Không thể ghi nhận sự kiện vào MongoDB",
        )

@router.post(
    "/poi-visits",
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_poi_visit(
    body: POIVisitRequest,
    request: Request,
):
    check_rate_limit(request)

    db = request.app.state.db

    if len(body.visits) > 200:
        raise HTTPException(
            status_code=413,
            detail="Một request không được vượt quá 200 lượt ghé",
        )

    accepted = 0

    try:
        for visit in body.visits:
            poi = await db['pois'].find_one(
                {
                    "$and": [
                        {"status": "published"},
                        {
                            "$or": [
                                {"_id": visit.poi_id},
                                {"poi_id": visit.poi_id}
                            ]
                        }
                    ]
                },
                {"_id": 1}
            )

            if not poi:
                continue

            occurred_at = normalize_datetime(
                visit.occurred_at
            )

            hour_bucket = occurred_at.replace(
                minute=0,
                second=0,
                microsecond=0,
            )

            await db["poi_density_hourly"].update_one(
                {
                    "poi_id": visit.poi_id,
                    "hour_bucket": hour_bucket,
                },
                {
                    "$inc": {
                        "visit_count": 1,
                    }
                },
                upsert=True,
            )

            accepted += 1

        return {
            "accepted": accepted,
        }

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="Không thể ghi nhận lượt ghé POI",
        )
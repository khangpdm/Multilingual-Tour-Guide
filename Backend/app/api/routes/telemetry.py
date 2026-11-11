from uuid import UUID
from services.utils import utc_now
from datetime import datetime, timezone, timedelta
import time
from collections import defaultdict
from app.services.utils import utc_now

from fastapi import (
    APIRouter,
    HTTPException,
    Request,
    status,
    Header,
)

from api.schemas.schemas import TelemetryEventRequest, POIVisitRequest
from services.utils import get_active_languages
from services.telemetry_service import check_rate_limit, normalize_datetime, poi_exists, zone_exists
from app.api.schemas.schemas import TelemetryEventRequest, POIVisitRequest

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])

@router.post("/events", status_code=status.HTTP_202_ACCEPTED)
async def create_telemetry_events(
    body: TelemetryEventRequest,
    request: Request,
    device_id: str = Header(..., alias="X-Device-Id")
):
    check_rate_limit(request)
    db_pool = request.app.state.db_pool

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

    active_locales = await get_active_languages(db_pool)
    received_at = utc_now()

    valid_events = []
    rejected = []
    duplicates = 0

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

            if not await poi_exists(db_pool, event.poi_id):
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

            if not await zone_exists(db_pool, event.zone_id):
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

        norm_occurred_at = normalize_datetime(event.occurred_at)

        valid_events.append((
            event_id,
            device_id,
            event.event_type,
            event.poi_id,
            event.zone_id,
            event.language_code,
            event.trigger_source,
            event.audio_tier,
            norm_occurred_at,
            received_at
        ))

    accepted = 0

    if valid_events:
        try:
            async with db_pool.acquire() as conn:
                async with conn.cursor() as cursor:
                    for ev in valid_events:
                        try:
                            await cursor.execute(
                                """
                                INSERT INTO analytics_events 
                                (client_event_id, device_id, event_type, poi_id, zone_id, language_code, trigger_source, audio_tier, occurred_at, received_at)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                """,
                                ev
                            )
                            accepted += 1
                        except Exception as err:
                            if getattr(err, "args", [None])[0] == 1062:
                                duplicates += 1
                            else:
                                raise err
        except Exception:
            raise HTTPException(
                status_code=503,
                detail="Không thể ghi nhận sự kiện vào MySQL",
            )

    return {
        "accepted": accepted,
        "duplicates": duplicates,
        "rejected": rejected,
    }


@router.post(
    "/poi-visits",
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_poi_visit(
    body: POIVisitRequest,
    request: Request,
):
    check_rate_limit(request)
    db_pool = request.app.state.db_pool

    if len(body.visits) > 200:
        raise HTTPException(
            status_code=413,
            detail="Một request không được vượt quá 200 lượt ghé",
        )

    accepted = 0

    try:
        async with db_pool.acquire() as conn:
            async with conn.cursor() as cursor:
                for visit in body.visits:
                    await cursor.execute(
                        "SELECT 1 FROM poi WHERE id = %s AND status = 'active'",
                        (visit.poi_id,)
                    )
                    if not await cursor.fetchone():
                        continue

                    occurred_at = normalize_datetime(visit.occurred_at)
                    hour_bucket = occurred_at.replace(
                        minute=0,
                        second=0,
                        microsecond=0,
                    )

                    await cursor.execute(
                        """
                        INSERT INTO poi_density_hourly (poi_id, hour_bucket, visit_count)
                        VALUES (%s, %s, 1)
                        ON DUPLICATE KEY UPDATE visit_count = visit_count + 1
                        """,
                        (visit.poi_id, hour_bucket)
                    )
                    accepted += 1

        return {
            "accepted": accepted,
        }

    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Không thể ghi nhận lượt ghé POI",
        )

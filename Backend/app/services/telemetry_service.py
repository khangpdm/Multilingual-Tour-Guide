from uuid import UUID
from datetime import datetime, timezone, timedelta
import time
from collections import defaultdict
from app.services.utils import utc_now

from fastapi import (
    HTTPException,
    Request,
)

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

async def poi_exists(pool, poi_id: str) -> bool:
    async with pool.acquire() as conn:
        async with conn.cursor() as cursor:
            await cursor.execute(
                "SELECT 1 FROM poi WHERE id = %s AND status = 'active'",
                (poi_id,)
            )
            return await cursor.fetchone() is not None

async def zone_exists(pool, zone_id: str) -> bool:
    async with pool.acquire() as conn:
        async with conn.cursor() as cursor:
            await cursor.execute(
                "SELECT 1 FROM zone WHERE id = %s AND is_active = 1",
                (zone_id,)
            )
            return await cursor.fetchone() is not None
import os
from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter(tags=["Health"])

@router.get("/health")
async def health_check():
    now = datetime.now(timezone.utc)

    return {
        "status": "ok",
        "server_time": now.isoformat(
            timespace='seconds'
        ).replace("+00:00", "Z"),
        "version": os.getenv("APP_VERSION", "1.4.2"),
    }
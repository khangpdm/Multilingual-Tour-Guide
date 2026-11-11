import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.core.security import require
from app.db.connection import database

router = APIRouter()


@router.get("/health")
def health():
    database.command("ping")
    return {
        "status": "ok",
        "database": database.name,
        "mode": "local-admin",
        "server_time": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "version": os.getenv("APP_VERSION", "1.4.2"),
    }


@router.get("/admin/database/summary")
def database_summary(user=Depends(require("poi.view"))):
    return {"tables": database.table_counts()}

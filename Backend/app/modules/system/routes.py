from fastapi import APIRouter, Depends
from pydantic import Field

from app.core.security import require
from app.db.connection import database
from app.core.state import mutation_lock
from app.core.utils import audit, update_record
from app.schemas.base import Input

router = APIRouter()
@router.get("/health")
def health():
    database.command("ping")
    return {"status": "ok", "database": database.name, "mode": "local-admin"}


@router.get("/admin/database/summary")
def database_summary(user=Depends(require("poi.view"))):
    return {"tables": database.table_counts()}


class GeofenceSettings(Input):
    radius_m: int = Field(ge=10, le=200)


@router.get("/admin/settings/geofence")
def geofence_settings(user=Depends(require("poi.view"))):
    from app.modules.pois.routes import radius_setting
    return {"radius_m": radius_setting()}


@router.put("/admin/settings/geofence")
def update_geofence(body: GeofenceSettings, user=Depends(require("system.manage_constants"))):
    from app.modules.pois.routes import radius_setting
    with mutation_lock, database.transaction():
        with database.connection() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT value FROM admin_settings WHERE name='geofence_radius_m' FOR UPDATE")
            previous = radius_setting()
            for poi in database.fetch_all("pois"):
                if poi["geofence_radius_m"] != body.radius_m:
                    update_record("pois", poi["poi_id"], {"geofence_radius_m": body.radius_m, "last_modified_by": user["user_id"]}, user, "poi.geofence_update")
            cursor.execute("UPDATE admin_settings SET value=%s WHERE name='geofence_radius_m'", (str(body.radius_m),))
        audit(user, "system.geofence_update", "geofence_radius_m", {"radius_m": previous}, body.model_dump())
        return body.model_dump()

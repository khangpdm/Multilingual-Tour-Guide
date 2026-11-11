from fastapi import APIRouter, Depends

from app.core.state import mutation_lock
from app.core.utils import audit, fail, get_record, identifier, now, public, update_record
from app.core.security import require
from app.db.connection import database
from app.modules.zones.schemas import ZoneInput

router = APIRouter()
@router.get("/admin/zones")
def zones(user=Depends(require("poi.view"))):
    result = []
    for zone in database.fetch_all("zones", order_by="name"):
        zone["zone_id"] = zone.get("zone_id", str(zone["_id"]))
        zone["poi_count"] = database.count_zone_pois(zone["zone_id"])
        result.append(public(zone))
    return {"zones": result}


def save_zone(body, user, zone_id=None):
    with mutation_lock:
        if any(zone.get("name", "").casefold() == body.name.casefold() and zone.get("_id") != zone_id for zone in database.fetch_all("zones")):
            fail(409, "DUPLICATE_NAME", "Zone name already exists.")
        if zone_id:
            return public(update_record("zones", zone_id, body.model_dump(), user, "zone.update"))
        zone_id = identifier("zone")
        document = {"_id": zone_id, "zone_id": zone_id, **body.model_dump(), "created_at": now(), "updated_at": now()}
        database.insert_record("zones", document)
        audit(user, "zone.create", zone_id, None, document)
        return public(document)


@router.post("/admin/zones", status_code=201)
def create_zone(body: ZoneInput, user=Depends(require("system.manage_constants"))):
    return save_zone(body, user)


@router.put("/admin/zones/{zone_id}")
def edit_zone(zone_id: str, body: ZoneInput, user=Depends(require("system.manage_constants"))):
    return save_zone(body, user, zone_id)

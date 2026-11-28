from fastapi import APIRouter, Depends, File, UploadFile

from app.core.state import mutation_lock
from app.core.utils import audit, fail, get_record, identifier, now, public, update_record
from app.core.security import require
from app.db.connection import database
from app.modules.zones.schemas import ZoneInput, ZonePatch
from app.schemas.base import validate_input
from app.modules.zones.geometry import contains
from app.modules.media.storage import IMAGE_LIMIT, asset_path, checked_image, store_bytes

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
    with mutation_lock, database.transaction():
        if zone_id:
            database.lock_zone(zone_id)
            existing = get_record("zones", zone_id)
            body = validate_input(ZoneInput, {**{key: value for key, value in existing.items() if key in ZoneInput.model_fields}, **body.model_dump(exclude_unset=True)})
            active_pois = database.fetch_all("pois", {"zone_id": zone_id, "status": "active", "is_archived": False})
            if existing["is_active"] and not body.is_active and active_pois:
                fail(409, "ZONE_HAS_ACTIVE_POIS", f"Khu vực còn {len(active_pois)} điểm tham quan đang hoạt động. Hãy chuyển hoặc lưu trữ các điểm này trước.")
            for poi in active_pois:
                if not contains(body.model_dump(), *poi["location"]["coordinates"]):
                    fail(409, "ZONE_HAS_OUTSIDE_POIS", "The new boundary excludes an active POI. Move or archive it first.")
        if any(zone.get("name", "").casefold() == body.name.casefold() and zone.get("_id") != zone_id for zone in database.fetch_all("zones")):
            fail(409, "DUPLICATE_NAME", "Zone name already exists.")
        if body.cover_image:
            path = asset_path(body.cover_image)
            if path.suffix not in {".jpg", ".png", ".webp"}:
                fail(422, "INVALID_ZONE_COVER", "Ảnh bìa khu vực phải là ảnh JPG, PNG hoặc WebP.")
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


@router.post("/admin/zones/cover")
async def upload_zone_cover(file: UploadFile = File(...), user=Depends(require("system.manage_constants"))):
    try:
        data = checked_image(await file.read(IMAGE_LIMIT + 1))
    finally:
        await file.close()
    url, _ = store_bytes(data, "jpg")
    return {"cover_image": url}


@router.put("/admin/zones/{zone_id}")
def edit_zone(zone_id: str, body: ZonePatch, user=Depends(require("system.manage_constants"))):
    return save_zone(body, user, zone_id)

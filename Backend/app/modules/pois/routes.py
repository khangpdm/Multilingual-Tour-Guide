import re
import secrets

from fastapi import APIRouter, Depends, Query

from app.core.state import mutation_lock
from app.core.utils import audit, fail, get_record, identifier, now, public, update_record
from app.core.security import require
from app.db.connection import database
from app.modules.pois.schemas import ContentInput, PoiCreate, PoiFields, QrInput, Reason
from app.modules.pois.readiness import readiness

router = APIRouter()
def poi_public(document):
    document = dict(document)
    document["poi_id"] = document.get("poi_id", str(document["_id"]))
    document["status"] = "archived" if document.get("is_archived") else {"active": "published", "inactive": "unpublished"}.get(document.get("status"), document.get("status"))
    location = document.get("location", {})
    if location.get("type") == "Point":
        longitude, latitude = location["coordinates"]
        document["location"] = {"lat": latitude, "lng": longitude}
    document["content_status"] = {language["_id"]: "ready" if document.get("content", {}).get(language["_id"], {}).get("audio_url") else "missing" for language in database.fetch_all("languages", {"is_active": True})}
    document["readiness"] = readiness(document)
    return public(document)


def editable_poi(poi_id):
    document = get_record("pois", poi_id)
    if document.get("status") == "archived" or document.get("is_archived"):
        fail(409, "INVALID_STATE", "Archived POIs cannot be changed.")
    return document


def validate_zone(zone_id, existing=None):
    zone = get_record("zones", zone_id)
    if not zone.get("is_active") and (not existing or existing.get("zone_id") != zone_id):
        fail(422, "INACTIVE_ZONE", "Choose an active zone.")


def content_document(body, locale):
    return {**body.model_dump(), "audio_url": None, "audio_sha256": None, "audio_source": None, "is_edited": locale != "vi", "updated_at": now()}


@router.get("/admin/pois")
def pois(page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=100), user=Depends(require("poi.view"))):
    return {"items": [poi_public(document) for document in database.fetch_all("pois", order_by="updated_at", descending=True, limit=page_size, offset=(page - 1) * page_size)], "total": database.count("pois")}


@router.get("/admin/pois/{poi_id}")
def poi_detail(poi_id: str, user=Depends(require("poi.view"))):
    return poi_public(get_record("pois", poi_id))


@router.post("/admin/pois", status_code=201)
def create_poi(body: PoiCreate, user=Depends(require("poi.create"))):
    validate_zone(body.zone_id)
    for locale in body.content:
        if not database.fetch_one("languages", {"_id": locale, "is_active": True}):
            fail(422, "INVALID_LANGUAGE", "Choose an active language.")
    poi_id = identifier("poi")
    document = {"_id": poi_id, "poi_id": poi_id, **body.model_dump(exclude={"content", "location"}), "location": {"type": "Point", "coordinates": [body.location.lng, body.location.lat]}, "content": {locale: content_document(content, locale) for locale, content in body.content.items()}, "status": "inactive", "qr_code": None, "images": [], "cover_image": None, "created_at": now(), "updated_at": now(), "last_modified_by": user["user_id"]}
    database.insert_record("pois", document)
    audit(user, "poi.create", poi_id, None, document)
    return {"poi": poi_public(document), "tasks_created": []}


@router.put("/admin/pois/{poi_id}")
def edit_poi(poi_id: str, body: PoiFields, user=Depends(require("poi.edit"))):
    with mutation_lock:
        existing = editable_poi(poi_id)
        validate_zone(body.zone_id, existing)
        changes = {**body.model_dump(exclude={"location"}), "location": {"type": "Point", "coordinates": [body.location.lng, body.location.lat]}, "last_modified_by": user["user_id"]}
        return {"poi": poi_public(update_record("pois", poi_id, changes, user, "poi.update"))}


@router.put("/admin/pois/{poi_id}/content/{locale}")
def edit_content(poi_id: str, locale: str, body: ContentInput, user=Depends(require("poi.edit"))):
    with mutation_lock:
        existing = editable_poi(poi_id)
        if not re.fullmatch(r"[a-z]{2,3}(-[A-Z]{2})?", locale) or not database.fetch_one("languages", {"_id": locale, "is_active": True}):
            fail(422, "INVALID_LANGUAGE", "Choose an active language.")
        content = {**existing.get("content", {}).get(locale, {}), **body.model_dump(), "is_edited": locale != "vi", "updated_at": now()}
        if content.get("audio_source") == "TTS" and body.text != existing.get("content", {}).get(locale, {}).get("text"):
            content.update(audio_url=None, audio_sha256=None, audio_source=None)
        return poi_public(update_record("pois", poi_id, {"content." + locale: content, "last_modified_by": user["user_id"]}, user, "poi.content_edit"))



def transition(poi_id, status, user, reason=None):
    with mutation_lock:
        document = editable_poi(poi_id)
        if status == "active":
            validate_zone(document["zone_id"])
            if not get_record("zones", document["zone_id"]).get("is_active"):
                fail(422, "INACTIVE_ZONE", "Zone must be active before publishing.")
            issues = readiness(document)["issues"]
            if issues:
                fail(422, "NOT_READY", "; ".join(issue["message"] for issue in issues))
        if status == "archived":
            with database.connection() as connection, connection.cursor() as cursor:
                cursor.execute("UPDATE audio_tasks SET state='CANCELLED',finished_at=UTC_TIMESTAMP(3) WHERE poi_id=%s AND state IN ('QUEUED','PROCESSING')", (poi_id,))
        return poi_public(update_record("pois", poi_id, {"status": "inactive" if status == "archived" else status, "is_archived": status == "archived", "unpublish_reason": reason, "last_modified_by": user["user_id"]}, user, "poi." + status))


@router.post("/admin/pois/{poi_id}/unpublish")
def unpublish(poi_id: str, body: Reason, user=Depends(require("content.unpublish"))):
    return transition(poi_id, "inactive", user, body.reason)


@router.post("/admin/pois/{poi_id}/republish")
def republish(poi_id: str, user=Depends(require("content.restore"))):
    return transition(poi_id, "active", user)


@router.delete("/admin/pois/{poi_id}")
def archive(poi_id: str, user=Depends(require("poi.delete"))):
    return transition(poi_id, "archived", user)



@router.post("/admin/pois/{poi_id}/qr")
def assign_qr(poi_id: str, body: QrInput, user=Depends(require("poi.assign_qr"))):
    with mutation_lock:
        document = editable_poi(poi_id)
        if document.get("qr_code") and not body.regenerate:
            return poi_public(document)
        return poi_public(update_record("pois", poi_id, {"qr_code": secrets.token_hex(12), "last_modified_by": user["user_id"]}, user, "poi.assign_qr"))


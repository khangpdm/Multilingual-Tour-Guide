import json
import hashlib
import re
import secrets
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Query

from app.core.state import mutation_lock
from app.core.utils import audit, fail, get_record, identifier, now, public, update_record
from app.core.security import require
from app.db.connection import database
from app.modules.audio.queue import enqueue
from app.modules.pois.schemas import ContentInput, ContentPatch, Location, PoiCreate, PoiFields, PoiPatch, QrInput
from app.modules.media.storage import asset_path
from app.modules.pois.readiness import readiness
from app.modules.pois.versioning import check_version, expected_version
from app.modules.zones.geometry import contains
from app.schemas.base import validate_input

router = APIRouter()


def poi_public(document):
    document = dict(document)
    document["poi_id"] = document.get("poi_id", str(document["_id"]))
    document["status"] = "archived" if document.get("is_archived") else "active"
    location = document.get("location", {})
    if location.get("type") == "Point":
        longitude, latitude = location["coordinates"]
        document["location"] = {"lat": latitude, "lng": longitude}
    with database.connection() as connection, connection.cursor() as cursor:
        cursor.execute("SELECT id,language_code,state,error,created_at FROM audio_tasks WHERE poi_id=%s ORDER BY created_at DESC,id DESC", (document["poi_id"],))
        tasks = cursor.fetchall()
    statuses = {}
    for language in database.fetch_all("languages", {"is_active": True}):
        locale = language["code"]
        latest = next((task for task in tasks if task["language_code"] == locale), None)
        if document.get("content", {}).get(locale, {}).get("audio_url"):
            statuses[locale] = "ready"
        elif any(task["language_code"] == locale and task["state"] in {"QUEUED", "PROCESSING"} for task in tasks):
            statuses[locale] = "pending"
        else:
            statuses[locale] = "failed" if latest and latest["state"] == "FAILED" else "missing"
    document["content_status"] = statuses
    document["default_audio_missing"] = not document.get("content", {}).get("en", {}).get("audio_url")
    document["tasks"] = [{**task, "task_id": task["id"], "status": task["state"].lower()} for task in tasks if task["state"] in {"QUEUED", "PROCESSING"}]
    document["readiness"] = readiness(document)
    return public(document)


def editable_poi(poi_id, version=None):
    database.lock_poi(poi_id)
    document = get_record("pois", poi_id)
    check_version(document, version)
    if document.get("is_archived"):
        fail(409, "INVALID_STATE", "Archived POIs cannot be changed.")
    return document


def saveable_content_poi(poi_id, version):
    database.lock_poi(poi_id)
    document = get_record("pois", poi_id)
    check_version(document, version)
    return document


def validate_zone(zone_id, location):
    zone = get_record("zones", zone_id)
    if not zone.get("is_active"):
        fail(422, "INACTIVE_ZONE", "Choose an active zone.")
    if not contains(zone, location.lng, location.lat):
        fail(422, "OUTSIDE_ZONE", "POI must be inside its zone boundary.")


def content_document(body, locale):
    return {**body.model_dump(), "audio_url": None, "audio_sha256": None, "audio_source": None, "is_edited": True, "updated_at": now()}


def radius_setting():
    with database.connection() as connection, connection.cursor() as cursor:
        cursor.execute("SELECT value FROM admin_settings WHERE name='geofence_radius_m'")
        value = cursor.fetchone()["value"]
    return int(json.loads(value) if isinstance(value, str) else value)


@router.get("/admin/pois")
def pois(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), q: str = "", zone_id: str | None = None, status: Literal["active", "archived"] | None = None, category: str | None = None, sort: Literal["updated_at_desc", "name_asc", "created_at_desc"] = "updated_at_desc", user=Depends(require("poi.view"))):
    items = database.fetch_all("pois", {"zone_id": zone_id} if zone_id else {})
    def name(document):
        content = document.get("content", {})
        return content.get("en", content.get("vi", {})).get("name", "").casefold()
    items = [item for item in items if (not status or bool(item.get("is_archived")) == (status == "archived")) and (not category or item["category"] == category) and (not q or any(q.casefold() in content.get("name", "").casefold() for content in item.get("content", {}).values()))]
    items.sort(key=name if sort == "name_asc" else lambda item: item.get("created_at" if sort == "created_at_desc" else "updated_at", ""), reverse=sort != "name_asc")
    total = len(items)
    return {"items": [poi_public(item) for item in items[(page - 1) * page_size:page * page_size]], "page": page, "page_size": page_size, "total": total}


@router.get("/admin/pois/{poi_id}")
def poi_detail(poi_id: str, user=Depends(require("poi.view"))):
    return poi_public(get_record("pois", poi_id))


@router.post("/admin/pois", status_code=201)
def create_poi(body: PoiCreate, background: BackgroundTasks, user=Depends(require("poi.create"))):
    with mutation_lock, database.transaction():
        validate_zone(body.zone_id, body.location)
        for locale in body.content:
            if not database.fetch_one("languages", {"_id": locale, "is_active": True}):
                fail(422, "INVALID_LANGUAGE", "Choose an active language.")
        radius = radius_setting()
        if "geofence_radius_m" in body.model_fields_set and body.geofence_radius_m != radius:
            fail(422, "GLOBAL_GEOFENCE", "Geofence radius is configured globally by an administrator.")
        poi_id = identifier("poi")
        document = {"_id": poi_id, "poi_id": poi_id, **body.model_dump(exclude={"content", "location"}), "geofence_radius_m": radius, "location": {"type": "Point", "coordinates": [body.location.lng, body.location.lat]}, "content": {locale: content_document(content, locale) for locale, content in body.content.items()}, "status": "active", "is_archived": False, "content_version": 1, "qr_code": secrets.token_hex(12), "images": [], "cover_image": None, "created_at": now(), "updated_at": now(), "last_modified_by": user["user_id"]}
        database.insert_record("pois", document)
        tasks = enqueue(document, ["en"], user, background)
        audit(user, "poi.create", poi_id, None, document)
        return {"poi": poi_public(document), "tasks_created": tasks}


@router.put("/admin/pois/{poi_id}")
def edit_poi(poi_id: str, body: PoiPatch, background: BackgroundTasks, version=Depends(expected_version), user=Depends(require("poi.edit"))):
    with mutation_lock, database.transaction():
        existing = editable_poi(poi_id, version)
        changes = body.model_dump(exclude_unset=True)
        longitude, latitude = existing["location"]["coordinates"]
        merged = {field: existing[field] for field in PoiFields.model_fields if field != "location"}
        fields = validate_input(PoiFields, {**merged, "location": {"lng": longitude, "lat": latitude}, **changes})
        if "geofence_radius_m" in changes and changes["geofence_radius_m"] != existing["geofence_radius_m"]:
            fail(403, "GLOBAL_GEOFENCE", "Use the administrator global geofence configuration.")
        validate_zone(fields.zone_id, fields.location)
        changes = {**fields.model_dump(exclude={"location"}), "location": {"type": "Point", "coordinates": [fields.location.lng, fields.location.lat]}, "last_modified_by": user["user_id"]}
        after = update_record("pois", poi_id, changes, user, "poi.update")
        tasks = enqueue(after, ["en"], user, background)
        return {"poi": poi_public(after), "tasks_created": tasks}


@router.put("/admin/pois/{poi_id}/content/{locale}")
def edit_content(poi_id: str, locale: str, body: ContentPatch, background: BackgroundTasks, version=Depends(expected_version), user=Depends(require("poi.edit"))):
    with mutation_lock, database.transaction():
        existing = saveable_content_poi(poi_id, version)
        if not re.fullmatch(r"[a-z]{2,3}(-[A-Z]{2})?", locale) or not database.fetch_one("languages", {"_id": locale, "is_active": True}):
            fail(422, "INVALID_LANGUAGE", "Choose an active language.")
        previous = existing.get("content", {}).get(locale, {})
        fields = validate_input(ContentInput, {**{key: value for key, value in previous.items() if key in ContentInput.model_fields}, **body.model_dump(exclude_unset=True)})
        content = {**previous, **fields.model_dump(), "is_edited": True, "updated_at": now()}
        if content.get("audio_source") == "TTS" and fields.text != previous.get("text"):
            content.update(audio_url=None, audio_sha256=None, audio_source=None)
        after = update_record("pois", poi_id, {"content." + locale: content, "last_modified_by": user["user_id"]}, user, "poi.content_edit")
        tasks = enqueue(after, ["en", locale], user, background) if not after.get("is_archived") else []
        return {**poi_public(after), "tasks_created": tasks}


@router.delete("/admin/pois/{poi_id}")
def archive(poi_id: str, version=Depends(expected_version), user=Depends(require("poi.delete"))):
    with mutation_lock, database.transaction():
        editable_poi(poi_id, version)
        with database.connection() as connection, connection.cursor() as cursor:
            cursor.execute("UPDATE audio_tasks SET state='CANCELLED',finished_at=UTC_TIMESTAMP(3) WHERE poi_id=%s AND state IN ('QUEUED','PROCESSING')", (poi_id,))
        return poi_public(update_record("pois", poi_id, {"status": "inactive", "is_archived": True, "last_modified_by": user["user_id"]}, user, "poi.archive"))


@router.post("/admin/pois/{poi_id}/restore")
def restore(poi_id: str, background: BackgroundTasks, version=Depends(expected_version), user=Depends(require("content.restore"))):
    with mutation_lock, database.transaction():
        database.lock_poi(poi_id)
        existing = get_record("pois", poi_id)
        check_version(existing, version)
        if not existing.get("is_archived"):
            fail(409, "INVALID_STATE", "Only archived POIs may be restored.")
        content = existing.get("content", {}).get("en", {})
        validate_input(ContentInput, {key: value for key, value in content.items() if key in ContentInput.model_fields})
        longitude, latitude = existing["location"]["coordinates"]
        validate_zone(existing["zone_id"], Location(lng=longitude, lat=latitude))
        after = update_record("pois", poi_id, {"status": "active", "is_archived": False, "unpublish_reason": None, "last_modified_by": user["user_id"]}, user, "poi.restore")
        tasks = enqueue(after, ["en"], user, background)
        return {**poi_public(after), "tasks_created": tasks}


@router.post("/admin/pois/{poi_id}/qr")
def assign_qr(poi_id: str, body: QrInput, user=Depends(require("poi.assign_qr"))):
    if body.regenerate:
        fail(409, "IMMUTABLE_QR", "The QR token cannot change during the POI lifetime.")
    return poi_public(get_record("pois", poi_id))


@router.get("/admin/pois/{poi_id}/versions")
def versions(poi_id: str, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), user=Depends(require("poi.view"))):
    get_record("pois", poi_id)
    with database.connection() as connection, connection.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) AS total FROM poi_versions WHERE poi_id=%s", (poi_id,))
        total = cursor.fetchone()["total"]
        cursor.execute("SELECT content_version,document,saved_by,created_at FROM poi_versions WHERE poi_id=%s ORDER BY content_version DESC LIMIT %s OFFSET %s", (poi_id, page_size, (page - 1) * page_size))
        items = [{**row, "document": json.loads(row["document"]) if isinstance(row["document"], str) else row["document"]} for row in cursor.fetchall()]
    return public({"items": items, "page": page, "page_size": page_size, "total": total})


@router.post("/admin/pois/{poi_id}/versions/{source_version}/restore")
def restore_version(poi_id: str, source_version: int, background: BackgroundTasks, version=Depends(expected_version), user=Depends(require("poi.edit"))):
    with mutation_lock, database.transaction():
        editable_poi(poi_id, version)
        with database.connection() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT document FROM poi_versions WHERE poi_id=%s AND content_version=%s", (poi_id, source_version))
            row = cursor.fetchone()
            if not row:
                fail(404, "VERSION_NOT_FOUND", "POI version not found.")
            previous = json.loads(row["document"]) if isinstance(row["document"], str) else row["document"]
            longitude, latitude = previous["location"]["coordinates"]
            restored = validate_input(PoiCreate, {"category": previous["category"], "zone_id": previous["zone_id"], "location": {"lng": longitude, "lat": latitude}, "geofence_radius_m": radius_setting(), "priority": previous.get("priority", 0), "content": {locale: {key: value for key, value in content.items() if key in ContentInput.model_fields} for locale, content in previous["content"].items()}})
            validate_zone(restored.zone_id, restored.location)
            for image in previous.get("images", []):
                asset_path(image)
            for content in previous["content"].values():
                if content.get("audio_url"):
                    path = asset_path(content["audio_url"])
                    if hashlib.sha256(path.read_bytes()).hexdigest() != content.get("audio_sha256"):
                        fail(409, "ASSET_CHANGED", "Saved audio checksum no longer matches its asset.")
            changes = {key: previous[key] for key in ("category", "zone_id", "location", "images", "cover_image")}
            changes.update(priority=previous.get("priority", 0), geofence_radius_m=radius_setting(), last_modified_by=user["user_id"])
            changes["content"] = previous["content"]
            after = update_record("pois", poi_id, changes, user, "poi.version_restore")
            cursor.execute("UPDATE audio_tasks SET state='CANCELLED',finished_at=UTC_TIMESTAMP(3) WHERE poi_id=%s AND state IN ('QUEUED','PROCESSING')", (poi_id,))
        after = get_record("pois", poi_id)
        tasks = enqueue(after, ["en"], user, background)
        return {"poi": poi_public(after), "tasks_created": tasks}

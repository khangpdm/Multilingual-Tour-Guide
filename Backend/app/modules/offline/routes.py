import hashlib
import json
import re
import zipfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import Field

from app.core.config import MEDIA_ROOT
from app.core.security import require
from app.core.state import mutation_lock
from app.core.utils import audit, fail, get_record, identifier, public
from app.db.connection import database
from app.modules.media.storage import asset_path
from app.modules.pois.readiness import readiness
from app.modules.pois.routes import poi_public
from app.schemas.base import Input

router = APIRouter()
PACK_ROOT = MEDIA_ROOT / "packs"
PACK_LIMIT = 250 * 1024 * 1024


class BuildPack(Input):
    zone_id: str = Field(min_length=1, max_length=100)
    locales: list[str] = Field(min_length=1, max_length=30)


def query(statement, parameters=(), one=False):
    with database.connection() as connection, connection.cursor() as cursor:
        cursor.execute(statement, parameters)
        return cursor.fetchone() if one else cursor.fetchall()


def release_record(release_id):
    release = query("SELECT * FROM offline_pack_releases WHERE id=%s", (release_id,), one=True)
    if not release:
        fail(404, "NOT_FOUND", "Offline release not found.")
    release["languages"] = query("SELECT * FROM offline_pack_languages WHERE release_id=%s ORDER BY language_code", (release_id,))
    return release


def snapshot(zone_id, locales):
    zone = get_record("zones", zone_id)
    if not zone.get("is_active"):
        fail(422, "INACTIVE_ZONE", "Select an active zone.")
    for locale in locales:
        if not database.fetch_one("languages", {"_id": locale, "is_active": True}):
            fail(422, "INACTIVE_LANGUAGE", f"Language {locale} is not active.")
    pois = []
    for record in database.fetch_all("pois", {"zone_id": zone_id}):
        if record.get("status") not in {"active", "published"} or record.get("is_archived"):
            continue
        checks = readiness(record, locales)
        if not checks["ready"]:
            name = record.get("content", {}).get("vi", {}).get("name", record["poi_id"])
            fail(422, "INCOMPLETE_CONTENT", name + ": " + "; ".join(issue["message"] for issue in checks["issues"]))
        poi = poi_public(record)
        poi.pop("readiness", None)
        poi.pop("content_status", None)
        poi["content"] = {locale: poi["content"][locale] for locale in sorted(locales)}
        for image in poi["images"]:
            asset_path(image)
        for content in poi["content"].values():
            path = asset_path(content["audio_url"])
            if hashlib.sha256(path.read_bytes()).hexdigest() != content["audio_sha256"]:
                fail(422, "ASSET_CHANGED", "Audio checksum does not match. Upload it again.")
        pois.append(poi)
    if not pois:
        fail(422, "EMPTY_ZONE", "This zone has no published POIs.")
    result = {"schema_version": 1, "zone": public(zone), "locales": sorted(locales), "pois": sorted(pois, key=lambda poi: poi["poi_id"])}
    encoded = json.dumps(result, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return result, hashlib.sha256(encoded).hexdigest()


def zip_bundle(path, manifest, urls):
    paths = [asset_path(url) for url in sorted(set(urls))]
    if sum(resource.stat().st_size for resource in paths) > PACK_LIMIT:
        fail(422, "PACK_TOO_LARGE", "A pack part may not exceed 250 MB. Split the zone.")
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
        for resource in paths:
            archive.write(resource, "assets/" + resource.name)
    return hashlib.sha256(path.read_bytes()).hexdigest(), path.stat().st_size


def build_release(release_id, data):
    try:
        PACK_ROOT.mkdir(parents=True, exist_ok=True)
        release = release_record(release_id)
        base = {"schema_version": 1, "release_id": release_id, "version": release["version"], "source_hash": release["source_hash"], "zone": data["zone"]}
        common = []
        images = []
        for poi in data["pois"]:
            common.append({**{key: value for key, value in poi.items() if key != "content"}, "images": ["assets/" + Path(image).name for image in poi["images"]], "cover_image": "assets/" + Path(poi["cover_image"]).name})
            images.extend(poi["images"])
        checksum, size = zip_bundle(PACK_ROOT / f"{release_id}-common.zip", {**base, "pois": common}, images)
        for locale in data["locales"]:
            audio = [poi["content"][locale]["audio_url"] for poi in data["pois"]]
            content = [{"poi_id": poi["poi_id"], **poi["content"][locale], "audio_url": "assets/" + Path(poi["content"][locale]["audio_url"]).name} for poi in data["pois"]]
            locale_hash, locale_size = zip_bundle(PACK_ROOT / f"{release_id}-{locale}.zip", {**base, "language": locale, "content": content}, audio)
            query("UPDATE offline_pack_languages SET status='ready',file_url=%s,sha256=%s,size_bytes=%s,built_at=UTC_TIMESTAMP(3) WHERE release_id=%s AND language_code=%s", (f"/admin/offline-packs/{release_id}/files/{locale}", locale_hash, locale_size, release_id, locale))
        query("UPDATE offline_pack_releases SET status='ready',common_file_url=%s,common_sha256=%s,common_size_bytes=%s,built_at=UTC_TIMESTAMP(3),error=NULL WHERE id=%s", (f"/admin/offline-packs/{release_id}/files/common", checksum, size, release_id))
    except Exception as error:
        message = str(error.detail.get("message", "Invalid resources")) if isinstance(error, HTTPException) and isinstance(error.detail, dict) else "Packaging failed. Check storage and resources, then create a new version."
        query("UPDATE offline_pack_releases SET status='failed',error=%s WHERE id=%s", (message[:1000], release_id))
        query("UPDATE offline_pack_languages SET status='failed' WHERE release_id=%s AND status='building'", (release_id,))


@router.get("/admin/offline-packs")
def releases(page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=100), user=Depends(require("offline.view"))):
    records = query("SELECT id FROM offline_pack_releases ORDER BY created_at DESC LIMIT %s OFFSET %s", (page_size, (page - 1) * page_size))
    return {"items": [public(release_record(record["id"])) for record in records], "total": query("SELECT COUNT(*) AS total FROM offline_pack_releases", one=True)["total"]}


@router.post("/admin/offline-packs", status_code=201)
def create_release(body: BuildPack, background: BackgroundTasks, user=Depends(require("offline.manage"))):
    with mutation_lock:
        locales = sorted(set(body.locales))
        data, checksum = snapshot(body.zone_id, locales)
        release_id = identifier("release")
        with database.connection() as connection, connection.cursor() as cursor:
            connection.begin()
            try:
                cursor.execute("SELECT id FROM zone WHERE id=%s FOR UPDATE", (body.zone_id,))
                cursor.fetchone()
                cursor.execute("SELECT COALESCE(MAX(version),0)+1 AS version FROM offline_pack_releases WHERE zone_id=%s", (body.zone_id,))
                version = cursor.fetchone()["version"]
                cursor.execute("INSERT INTO offline_pack_releases (id,zone_id,version,created_by,source_hash,poi_count) VALUES (%s,%s,%s,%s,%s,%s)", (release_id, body.zone_id, version, user["user_id"], checksum, len(data["pois"])))
                for locale in locales:
                    cursor.execute("INSERT INTO offline_pack_languages (id,release_id,language_code) VALUES (%s,%s,%s)", (identifier("language"), release_id, locale))
                connection.commit()
            except Exception:
                connection.rollback()
                raise
        audit(user, "offline.build", release_id, None, {"zone_id": body.zone_id, "version": version, "locales": locales})
        background.add_task(build_release, release_id, data)
    return public(release_record(release_id))


def verify_bundle(release_id, part, checksum):
    if not re.fullmatch(r"[a-f0-9-]{36}", release_id) or not re.fullmatch(r"common|[a-z]{2,3}(-[A-Z]{2})?", part):
        fail(404, "NOT_FOUND", "Pack not found.")
    path = PACK_ROOT / f"{release_id}-{part}.zip"
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != checksum:
        fail(409, "PACK_MISSING", "Pack is missing or changed. Build a new version.")
    return path


@router.post("/admin/offline-packs/{release_id}/publish")
def publish(release_id: str, user=Depends(require("offline.publish"))):
    with mutation_lock:
        release = release_record(release_id)
        if release["status"] != "ready":
            fail(409, "INVALID_STATE", "Only ready releases may be published.")
        _, checksum = snapshot(release["zone_id"], [item["language_code"] for item in release["languages"]])
        if checksum != release["source_hash"]:
            fail(409, "STALE_PACK", "Source content changed. Build a new version before publishing.")
        verify_bundle(release_id, "common", release["common_sha256"])
        for item in release["languages"]:
            if item["status"] != "ready":
                fail(409, "NOT_READY", "A language pack is not ready.")
            verify_bundle(release_id, item["language_code"], item["sha256"])
        with database.connection() as connection, connection.cursor() as cursor:
            connection.begin()
            try:
                cursor.execute("SELECT id FROM zone WHERE id=%s FOR UPDATE", (release["zone_id"],))
                cursor.fetchone()
                cursor.execute("UPDATE offline_pack_releases SET status='superseded' WHERE zone_id=%s AND status='published'", (release["zone_id"],))
                cursor.execute("UPDATE offline_pack_releases SET status='published',published_by=%s,published_at=UTC_TIMESTAMP(3) WHERE id=%s", (user["user_id"], release_id))
                connection.commit()
            except Exception:
                connection.rollback()
                raise
        audit(user, "offline.publish", release_id, None, {"version": release["version"]})
    return public(release_record(release_id))


@router.post("/admin/offline-packs/{release_id}/withdraw")
def withdraw(release_id: str, user=Depends(require("offline.publish"))):
    with mutation_lock:
        release = release_record(release_id)
        if release["status"] != "published":
            fail(409, "INVALID_STATE", "Only published packs may be withdrawn.")
        query("UPDATE offline_pack_releases SET status='superseded' WHERE id=%s", (release_id,))
        audit(user, "offline.withdraw", release_id, None, {"status": "superseded"})
    return public(release_record(release_id))


@router.get("/admin/offline-packs/{release_id}/files/{part}")
def download(release_id: str, part: str, user=Depends(require("offline.view"))):
    release = release_record(release_id)
    if release["status"] not in {"ready", "published", "superseded"}:
        fail(409, "NOT_READY", "The pack is not ready for download.")
    record = next((item for item in release["languages"] if item["language_code"] == part), None)
    if part != "common" and not record:
        fail(404, "NOT_FOUND", "Language pack not found.")
    checksum = release["common_sha256"] if part == "common" else record["sha256"]
    path = verify_bundle(release_id, part, checksum)
    return FileResponse(path, media_type="application/zip", filename=path.name, headers={"Cache-Control": "private, no-store"})

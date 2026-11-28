import hashlib
import json
import re
import tempfile
import zipfile
import zlib
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import Field

from app.core.config import LANG_SHARD_MAX_LANGS, MEDIA_ROOT
from app.core.security import require, user_permissions
from app.core.state import mutation_lock
from app.core.utils import audit, fail, get_record, identifier, public
from app.db.connection import database
from app.modules.media.storage import asset_path
from app.modules.audio.queue import enqueue
from app.modules.offline.distribution import extract_map, map_source, upload_release
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
    counts = release.get("audio_fallback_counts")
    release["audio_fallback_counts"] = json.loads(counts) if counts else None
    release["languages"] = query("SELECT * FROM offline_pack_languages WHERE release_id=%s ORDER BY language_code", (release_id,))
    release["outdated"] = False
    if release["status"] in {"ready", "published"}:
        try:
            _, checksum = snapshot(release["zone_id"], [item["language_code"] for item in release["languages"]])
            release["outdated"] = checksum != release["source_hash"]
        except HTTPException:
            release["outdated"] = True
    return release


def published_release(zone_id):
    return query(
        "SELECT r.*, z.name AS zone_name, z.min_lng, z.min_lat, z.max_lng, z.max_lat, "
        "z.min_zoom, z.max_zoom, z.is_active AS zone_is_active "
        "FROM offline_pack_releases r JOIN zone z ON z.id=r.zone_id "
        "WHERE r.zone_id=%s AND r.status='published' AND z.is_active=TRUE "
        "LIMIT 1",
        (zone_id,),
        one=True,
    )


def checked_artifact(release_id, part, checksum, size):
    if not checksum or not re.fullmatch(r"[a-f0-9]{64}", checksum) or not size or size <= 0:
        fail(409, "PACK_MISSING", "Pack metadata is invalid.")
    path = verify_bundle(release_id, part, checksum)
    if path.stat().st_size != size:
        fail(409, "PACK_MISSING", "Pack size does not match its metadata.")
    return path


def artifact_is_valid(release_id, part, checksum, size):
    if not checksum or not re.fullmatch(r"[a-f0-9]{64}", checksum) or not size or size <= 0:
        return False
    try:
        path = verify_bundle(release_id, part, checksum)
    except HTTPException:
        return False
    return path.stat().st_size == size


def mobile_artifact(zone_id, version, part):
    return f"/offline-packs/{zone_id}/v{version}/{part}.zip"


@router.get("/offline-packs/zones")
def mobile_zones():
    rows = query(
        "SELECT r.id, r.zone_id, z.name, r.version, r.common_sha256, r.common_size_bytes, "
        "z.min_lng, z.min_lat, z.max_lng, z.max_lat, z.min_zoom, z.max_zoom "
        "FROM offline_pack_releases r JOIN zone z ON z.id=r.zone_id "
        "WHERE r.status='published' AND z.is_active=TRUE "
        "ORDER BY z.name"
    )
    zones = []
    for row in rows:
        if not artifact_is_valid(row["id"], "common", row["common_sha256"], row["common_size_bytes"]):
            continue
        ready_shards = query(
            "SELECT language_code, sha256, size_bytes FROM offline_pack_languages "
            "WHERE release_id=%s AND status='ready'",
            (row["id"],),
        )
        if not any(
            artifact_is_valid(row["id"], shard["language_code"], shard["sha256"], shard["size_bytes"])
            for shard in ready_shards
        ):
            continue
        zones.append(
            {
                "zone_id": row["zone_id"],
                "name": row["name"],
                "release_id": row["id"],
                "version": row["version"],
                "map_region": {
                    "bbox": [
                        float(row["min_lng"]),
                        float(row["min_lat"]),
                        float(row["max_lng"]),
                        float(row["max_lat"]),
                    ],
                    "min_zoom": row["min_zoom"],
                    "max_zoom": row["max_zoom"],
                },
            }
        )
    return {"zones": zones}


@router.get("/offline-packs/{zone_id}/manifest")
def mobile_manifest(zone_id: str, langs: str = Query("vi")):
    requested = [item.strip() for item in langs.split(",") if item.strip()]
    if not 1 <= len(requested) <= LANG_SHARD_MAX_LANGS or len(set(requested)) != len(requested):
        fail(422, "INVALID_LANGUAGE", "Request between one and three distinct languages.")

    active_languages = {
        row["code"]
        for row in query("SELECT code FROM languages WHERE is_active=TRUE")
    }
    invalid = [language for language in requested if language not in active_languages]
    if invalid:
        fail(422, "INVALID_LANGUAGE", f"Language {invalid[0]} is not active.")

    release = published_release(zone_id)
    if not release:
        fail(404, "PACK_NOT_PUBLISHED", "This zone has no published offline pack.")

    common_path = checked_artifact(
        release["id"],
        "common",
        release["common_sha256"],
        release["common_size_bytes"],
    )
    shards = []
    for language in requested:
        shard = query(
            "SELECT language_code, sha256, size_bytes, status "
            "FROM offline_pack_languages WHERE release_id=%s AND language_code=%s",
            (release["id"], language),
            one=True,
        )
        if not shard or shard["status"] != "ready":
            fail(409, "LANGUAGE_SHARD_NOT_READY", f"Language shard {language} is not ready.")
        checked_artifact(release["id"], language, shard["sha256"], shard["size_bytes"])
        shards.append(
            {
                "language_code": language,
                "url": mobile_artifact(zone_id, release["version"], language),
                "sha256": shard["sha256"],
                "size_bytes": shard["size_bytes"],
            }
        )

    return {
        "zone_id": zone_id,
        "release_id": release["id"],
        "version": release["version"],
        "common_pack": {
            "url": mobile_artifact(zone_id, release["version"], "common"),
            "sha256": release["common_sha256"],
            "size_bytes": common_path.stat().st_size,
        },
        "language_shards": shards,
    }


@router.get("/offline-packs/{zone_id}/v{version}/{part}.zip")
def mobile_download(zone_id: str, version: int, part: str):
    if not re.fullmatch(r"common|[a-z]{2,3}(?:-[A-Z]{2})?", part):
        fail(404, "NOT_FOUND", "Pack not found.")
    release = query(
        "SELECT id, version, common_sha256, common_size_bytes "
        "FROM offline_pack_releases "
        "WHERE zone_id=%s AND version=%s AND status='published'",
        (zone_id, version),
        one=True,
    )
    if not release:
        fail(404, "PACK_NOT_PUBLISHED", "This offline pack is not published.")

    if part == "common":
        checksum = release["common_sha256"]
        size = release["common_size_bytes"]
    else:
        shard = query(
            "SELECT sha256, size_bytes, status FROM offline_pack_languages "
            "WHERE release_id=%s AND language_code=%s",
            (release["id"], part),
            one=True,
        )
        if not shard or shard["status"] != "ready":
            fail(404, "NOT_FOUND", "Pack not found.")
        checksum = shard["sha256"]
        size = shard["size_bytes"]

    path = checked_artifact(release["id"], part, checksum, size)
    return FileResponse(
        path,
        media_type="application/zip",
        filename=f"{part}.zip",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


def snapshot(zone_id, locales):
    locales = sorted(set(["en", *locales]))
    zone = get_record("zones", zone_id)
    if not zone.get("is_active"):
        fail(422, "INACTIVE_ZONE", "Select an active zone.")
    for locale in locales:
        if not database.fetch_one("languages", {"_id": locale, "is_active": True}):
            fail(422, "INACTIVE_LANGUAGE", f"Language {locale} is not active.")
    pois = []
    assets = {}
    for record in database.fetch_all("pois", {"zone_id": zone_id}):
        if record.get("status") not in {"active", "published"} or record.get("is_archived"):
            continue
        checks = readiness(record)
        if not checks["ready"]:
            name = record.get("content", {}).get("vi", {}).get("name", record["poi_id"])
            fail(422, "INCOMPLETE_CONTENT", name + ": " + "; ".join(issue["message"] for issue in checks["issues"]))
        poi = poi_public(record)
        poi.pop("readiness", None)
        poi.pop("content_status", None)
        poi.pop("tasks", None)
        poi.pop("default_audio_missing", None)
        default = poi["content"]["en"]
        localized = {}
        for locale in locales:
            content = poi["content"].get(locale, {})
            if not content.get("audio_url"):
                content = {**default, **content, "audio_url": default["audio_url"], "audio_sha256": default["audio_sha256"], "audio_source": default.get("audio_source"), "audio_fallback_locale": "en"}
            localized[locale] = content
        poi["content"] = localized
        for image in poi["images"]:
            assets[image] = hashlib.sha256(asset_path(image).read_bytes()).hexdigest()
        for content in poi["content"].values():
            path = asset_path(content["audio_url"])
            checksum = hashlib.sha256(path.read_bytes()).hexdigest()
            if checksum != content["audio_sha256"]:
                fail(422, "ASSET_CHANGED", "Audio checksum does not match. Upload it again.")
            assets[content["audio_url"]] = checksum
        pois.append(poi)
    if not pois:
        fail(422, "EMPTY_ZONE", "This zone has no published POIs.")
    if zone.get("cover_image"):
        cover = zone["cover_image"]
        assets[cover] = hashlib.sha256(asset_path(cover).read_bytes()).hexdigest()
    basemap = map_source()
    result = {"schema_version": 1, "zone": public(zone), "locales": sorted(locales), "pois": sorted(pois, key=lambda poi: poi["poi_id"]), "assets": assets}
    if basemap:
        result["map_source_version"] = basemap[1]
    encoded = json.dumps(result, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return result, hashlib.sha256(encoded).hexdigest()


def zip_bundle(path, manifest, urls, expected_assets, basemap=None):
    resources = [(url, asset_path(url)) for url in sorted(set(urls))]
    map_size = basemap.stat().st_size if basemap else 0
    if map_size + sum(resource.stat().st_size for _, resource in resources) > PACK_LIMIT:
        fail(422, "PACK_TOO_LARGE", "A pack part may not exceed 250 MB. Split the zone.")
    manifest = {**manifest, "asset_sha256": {"assets/" + resource.name: expected_assets[url] for url, resource in resources}}
    if basemap:
        manifest["map"] = {"path": "map.pmtiles", "sha256": hashlib.sha256(basemap.read_bytes()).hexdigest(), "size_bytes": map_size}
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
        if basemap:
            archive.write(basemap, "map.pmtiles", compress_type=zipfile.ZIP_STORED)
        total_size = map_size
        for url, resource in resources:
            data = resource.read_bytes()
            total_size += len(data)
            if total_size > PACK_LIMIT:
                fail(422, "PACK_TOO_LARGE", "A pack part may not exceed 250 MB. Split the zone.")
            if hashlib.sha256(data).hexdigest() != expected_assets[url]:
                fail(409, "ASSET_CHANGED", "Source resources changed. Build a new version.")
            archive.writestr("assets/" + resource.name, data)
    return hashlib.sha256(path.read_bytes()).hexdigest(), path.stat().st_size


def build_release(release_id, data, publisher=None):
    try:
        PACK_ROOT.mkdir(parents=True, exist_ok=True)
        release = release_record(release_id)
        base = {"schema_version": 1, "release_id": release_id, "version": release["version"], "source_hash": release["source_hash"], "zone": data["zone"]}
        common = []
        images = []
        for poi in data["pois"]:
            common.append({**{key: value for key, value in poi.items() if key != "content"}, "images": ["assets/" + Path(image).name for image in poi["images"]], "cover_image": "assets/" + Path(poi["cover_image"]).name})
            images.extend(poi["images"])
        zone = base["zone"]
        if zone.get("cover_image"):
            images.append(zone["cover_image"])
            base["zone"] = {**zone, "cover_image": "assets/" + Path(zone["cover_image"]).name}
        common_path = PACK_ROOT / f"{release_id}-common.zip"
        manifest = {**base, "pois": common}
        if data.get("map_source_version"):
            source = map_source()
            if not source or source[1] != data["map_source_version"]:
                fail(409, "OFFLINE_MAP_CHANGED", "Nguồn PMTiles đã thay đổi. Hãy build phiên bản mới.")
            with tempfile.TemporaryDirectory(dir=PACK_ROOT, prefix="map-") as temporary:
                basemap = Path(temporary) / "zone.pmtiles"
                extract_map(zone, source[0], basemap)
                checksum, size = zip_bundle(common_path, manifest, images, data["assets"], basemap)
        else:
            checksum, size = zip_bundle(common_path, manifest, images, data["assets"])
        for locale in data["locales"]:
            audio = [poi["content"][locale]["audio_url"] for poi in data["pois"]]
            content = [{"poi_id": poi["poi_id"], **poi["content"][locale], "audio_url": "assets/" + Path(poi["content"][locale]["audio_url"]).name} for poi in data["pois"]]
            locale_hash, locale_size = zip_bundle(PACK_ROOT / f"{release_id}-{locale}.zip", {**base, "language": locale, "content": content}, audio, data["assets"])
            query("UPDATE offline_pack_languages SET status='ready',file_url=%s,sha256=%s,size_bytes=%s,built_at=UTC_TIMESTAMP(3) WHERE release_id=%s AND language_code=%s", (f"/admin/offline-packs/{release_id}/files/{locale}", locale_hash, locale_size, release_id, locale))
        query("UPDATE offline_pack_releases SET status='ready',common_file_url=%s,common_sha256=%s,common_size_bytes=%s,built_at=UTC_TIMESTAMP(3),error=NULL WHERE id=%s", (f"/admin/offline-packs/{release_id}/files/common", checksum, size, release_id))
    except Exception as error:
        message = str(error.detail.get("message", "Invalid resources")) if isinstance(error, HTTPException) and isinstance(error.detail, dict) else "Packaging failed. Check storage and resources, then create a new version."
        query("UPDATE offline_pack_releases SET status='failed',error=%s WHERE id=%s", (message[:1000], release_id))
        query("UPDATE offline_pack_languages SET status='failed' WHERE release_id=%s AND status='building'", (release_id,))
        return
    if publisher:
        try:
            publish_release(release_id, publisher)
        except Exception as error:
            detail = error.detail.get("message") if isinstance(error, HTTPException) and isinstance(error.detail, dict) else None
            message = "Tự động phát hành thất bại. " + (detail or "Hãy thử phát hành lại.")
            query("UPDATE offline_pack_releases SET error=%s WHERE id=%s AND status='ready'", (message[:1000], release_id))


@router.get("/admin/offline-packs")
def releases(page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=100), latest_per_zone: bool = False, user=Depends(require("offline.view"))):
    offset = (page - 1) * page_size
    if latest_per_zone:
        records = query(
            """SELECT r.id, (
                   SELECT MAX(built_at) FROM offline_pack_releases
                   WHERE zone_id = r.zone_id
               ) AS latest_built_at
               FROM offline_pack_releases AS r
               JOIN (SELECT zone_id, MAX(version) AS version FROM offline_pack_releases GROUP BY zone_id) AS latest
                 ON latest.zone_id = r.zone_id AND latest.version = r.version
               ORDER BY r.zone_id LIMIT %s OFFSET %s""",
            (page_size, offset),
        )
        total = query("SELECT COUNT(DISTINCT zone_id) AS total FROM offline_pack_releases", one=True)["total"]
        return {"items": [public({**release_record(row["id"]), "latest_built_at": row["latest_built_at"]}) for row in records], "total": total}
    records = query("SELECT id FROM offline_pack_releases ORDER BY created_at DESC, id DESC LIMIT %s OFFSET %s", (page_size, offset))
    return {"items": [public(release_record(record["id"])) for record in records], "total": query("SELECT COUNT(*) AS total FROM offline_pack_releases", one=True)["total"]}


@router.post("/admin/offline-packs/zones/{zone_id}/queue-english")
def queue_zone_english(zone_id: str, background: BackgroundTasks, user=Depends(require("offline.manage"))):
    from app.modules.audio.routes import configured

    configured()
    with mutation_lock, database.transaction():
        zone = get_record("zones", zone_id)
        if not zone.get("is_active"):
            fail(422, "INACTIVE_ZONE", "Hãy chọn khu vực đang hoạt động.")
        tasks = []
        for poi in database.fetch_all("pois", {"zone_id": zone_id, "status": "active", "is_archived": False}):
            database.lock_poi(poi["poi_id"])
            current = get_record("pois", poi["poi_id"])
            if current["is_archived"] or current["zone_id"] != zone_id:
                continue
            tasks.extend(enqueue(current, ["en"], user, background))
        if tasks:
            audit(user, "offline.queue_english", zone_id, None, {"tasks_created": len(tasks)})
    return {"tasks_created": tasks}


@router.post("/admin/offline-packs", status_code=201)
def create_release(body: BuildPack, background: BackgroundTasks, user=Depends(require("offline.manage"))):
    with mutation_lock, database.transaction():
        locales = sorted(set(["en", *body.locales]))
        data, checksum = snapshot(body.zone_id, locales)
        fallback_counts = {locale: sum(
            bool(poi["content"][locale].get("audio_fallback_locale")) for poi in data["pois"]
        ) for locale in locales if locale != "en"}
        publisher = user if "offline.publish" in user_permissions(user) else None
        release_id = identifier("release")
        with database.connection() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT id FROM zone WHERE id=%s FOR UPDATE", (body.zone_id,))
            cursor.fetchone()
            cursor.execute("SELECT COALESCE(MAX(version),0)+1 AS version FROM offline_pack_releases WHERE zone_id=%s", (body.zone_id,))
            version = cursor.fetchone()["version"]
            cursor.execute("INSERT INTO offline_pack_releases (id,zone_id,version,created_by,source_hash,poi_count,audio_fallback_counts) VALUES (%s,%s,%s,%s,%s,%s,%s)", (release_id, body.zone_id, version, user["user_id"], checksum, len(data["pois"]), json.dumps(fallback_counts)))
            for locale in locales:
                cursor.execute("INSERT INTO offline_pack_languages (id,release_id,language_code) VALUES (%s,%s,%s)", (identifier("language"), release_id, locale))
        audit(user, "offline.build", release_id, None, {"zone_id": body.zone_id, "version": version, "locales": locales})
        background.add_task(build_release, release_id, data, publisher)
    return public(release_record(release_id))


def verify_bundle(release_id, part, checksum):
    if not re.fullmatch(r"[a-f0-9-]{36}", release_id) or not re.fullmatch(r"common|[a-z]{2,3}(-[A-Z]{2})?", part):
        fail(404, "NOT_FOUND", "Pack not found.")
    path = PACK_ROOT / f"{release_id}-{part}.zip"
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != checksum:
        fail(409, "PACK_MISSING", "Pack is missing or changed. Build a new version.")
    try:
        with zipfile.ZipFile(path) as archive:
            if archive.testzip() is not None:
                fail(409, "PACK_INVALID", "Pack is damaged. Build a new version.")
            if "manifest.json" not in archive.namelist():
                fail(409, "PACK_INVALID", "Pack manifest is missing. Build a new version.")
            manifest = json.loads(archive.read("manifest.json"))
            if not isinstance(manifest, dict) or manifest.get("release_id") != release_id:
                fail(409, "PACK_INVALID", "Pack manifest does not match this release.")
    except (zipfile.BadZipFile, OSError, RuntimeError, EOFError, zlib.error, ValueError):
        fail(409, "PACK_INVALID", "Pack is damaged. Build a new version.")
    return path


@router.post("/admin/offline-packs/{release_id}/publish")
def publish(release_id: str, user=Depends(require("offline.publish"))):
    publish_release(release_id, user)
    return public(release_record(release_id))


def publish_release(release_id, user):
    zone = query("SELECT zone_id FROM offline_pack_releases WHERE id=%s", (release_id,), one=True)
    if not zone:
        fail(404, "NOT_FOUND", "Offline release not found.")
    with mutation_lock, database.transaction():
        database.lock_zone(zone["zone_id"])
        release = release_record(release_id)
        if release["status"] != "ready":
            fail(409, "INVALID_STATE", "Only ready releases may be published.")
        newer = query("SELECT id FROM offline_pack_releases WHERE zone_id=%s AND version>%s AND published_at IS NOT NULL LIMIT 1 FOR UPDATE", (release["zone_id"], release["version"]), one=True)
        if newer:
            fail(409, "NEWER_PACK_PUBLISHED", "Một phiên bản mới hơn đã được phát hành. Hãy tạo gói mới.")
        _, checksum = snapshot(release["zone_id"], [item["language_code"] for item in release["languages"]])
        if checksum != release["source_hash"]:
            fail(409, "STALE_PACK", "Source content changed. Build a new version before publishing.")
        files = [verify_bundle(release_id, "common", release["common_sha256"])]
        for item in release["languages"]:
            if item["status"] != "ready":
                fail(409, "NOT_READY", "A language pack is not ready.")
            files.append(verify_bundle(release_id, item["language_code"], item["sha256"]))
        cdn_base = upload_release(files)
        with database.connection() as connection, connection.cursor() as cursor:
            cursor.execute("UPDATE offline_pack_releases SET status='superseded' WHERE zone_id=%s AND status='published'", (release["zone_id"],))
            cursor.execute("UPDATE offline_pack_releases SET status='published',published_by=%s,published_at=UTC_TIMESTAMP(3),cdn_base_url=%s,error=NULL WHERE id=%s", (user["user_id"], cdn_base, release_id))
        audit(user, "offline.publish", release_id, None, {"version": release["version"]})


@router.post("/admin/offline-packs/{release_id}/withdraw")
def withdraw(release_id: str, user=Depends(require("offline.publish"))):
    with mutation_lock, database.transaction():
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

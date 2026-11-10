import hashlib
import json
import urllib.request
from urllib.parse import urlsplit

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from pydantic import Field
from pymysql.err import IntegrityError

from app.core.config import settings
from app.core.messages import message_vi
from app.core.security import require
from app.core.state import mutation_lock
from app.core.utils import audit, fail, identifier, now, public, update_record
from app.db.connection import database
from app.modules.media.storage import AUDIO_LIMIT, checked_mp3, store_bytes
from app.modules.pois.routes import editable_poi
from app.schemas.base import Input

router = APIRouter()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise ValueError("TTS endpoint redirects are not allowed.")


class Regenerate(Input):
    locales: list[str] = Field(min_length=1, max_length=30)
    replace_uploaded_audio: bool = False
    retranslate: bool = False


def query(statement, parameters=(), one=False):
    with database.connection() as connection, connection.cursor() as cursor:
        cursor.execute(statement, parameters)
        return cursor.fetchone() if one else cursor.fetchall()


def task_record(task_id):
    record = query("SELECT * FROM audio_tasks WHERE id=%s", (task_id,), one=True)
    if not record:
        fail(404, "NOT_FOUND", "Audio task not found.")
    return record


def task_public(record):
    return public({**record, "task_id": record["id"], "status": record["state"].lower()})


def configured():
    endpoint = settings.get("TTS_ENDPOINT", "")
    parts = urlsplit(endpoint)
    if not endpoint:
        fail(503, "TTS_NOT_CONFIGURED", "Configure TTS_ENDPOINT before generating audio. MP3 upload is available.")
    if parts.scheme != "https" and not (parts.scheme == "http" and parts.hostname in {"localhost", "127.0.0.1"}):
        fail(503, "TTS_INVALID_CONFIG", "TTS requires HTTPS or a loopback development endpoint.")
    return endpoint


def text_hash(content):
    return hashlib.sha256(content["text"].encode("utf-8")).hexdigest()


def execute_task(task_id, user):
    try:
        with mutation_lock:
            task = task_record(task_id)
            if task["state"] != "QUEUED":
                return
            poi = editable_poi(task["poi_id"])
            locale = task["language_code"]
            content = poi.get("content", {}).get(locale, {})
            options = json.loads(task["options"]) if isinstance(task["options"], str) else task["options"]
            if not content.get("text"):
                raise ValueError("Content is missing.")
            query("UPDATE audio_tasks SET state='PROCESSING',progress=15,started_at=UTC_TIMESTAMP(3) WHERE id=%s", (task_id,))
        headers = {"Content-Type": "application/json", "Accept": "audio/mpeg"}
        if settings.get("TTS_API_KEY"):
            headers["Authorization"] = "Bearer " + settings["TTS_API_KEY"]
        request = urllib.request.Request(configured(), data=json.dumps({"text": content["text"], "language": locale}).encode(), headers=headers, method="POST")
        with urllib.request.build_opener(NoRedirect).open(request, timeout=60) as response:
            data = checked_mp3(response.read(AUDIO_LIMIT + 1))
        with mutation_lock:
            if task_record(task_id)["state"] != "PROCESSING":
                return
            latest = editable_poi(task["poi_id"])
            current = latest.get("content", {}).get(locale, {})
            if not database.fetch_one("languages", {"_id": locale, "is_active": True}):
                raise ValueError("Language is no longer active.")
            if text_hash(current) != options["text_hash"] or current.get("audio_sha256") != options.get("audio_sha256"):
                raise ValueError("Content or audio changed during generation. Generate again.")
            if current.get("audio_source") == "UPLOADED" and not options.get("replace_uploaded_audio"):
                raise ValueError("Uploaded audio is protected.")
            url, checksum = store_bytes(data, "mp3")
            update_record("pois", task["poi_id"], {"content." + locale: {**current, "audio_url": url, "audio_sha256": checksum, "audio_source": "TTS", "updated_at": now()}, "last_modified_by": user["user_id"]}, user, "audio.completed")
            query("UPDATE audio_tasks SET state='COMPLETED',progress=100,error=NULL,finished_at=UTC_TIMESTAMP(3) WHERE id=%s", (task_id,))
    except Exception as error:
        translated = message_vi(str(error)) if isinstance(error, ValueError) else ""
        message = translated[:400] if translated and translated != str(error) else message_vi("Audio generation failed. Check provider configuration and server connectivity, then retry.")
        query("UPDATE audio_tasks SET state='FAILED',error=%s,finished_at=UTC_TIMESTAMP(3) WHERE id=%s AND state IN ('QUEUED','PROCESSING')", (message, task_id))


@router.get("/admin/audio-tasks")
def tasks(page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=100), user=Depends(require("audio.view_tasks"))):
    items = query("SELECT * FROM audio_tasks ORDER BY created_at DESC LIMIT %s OFFSET %s", (page_size, (page - 1) * page_size))
    total = query("SELECT COUNT(*) AS total FROM audio_tasks", one=True)["total"]
    return {"items": [task_public(item) for item in items], "total": total}


@router.post("/admin/pois/{poi_id}/audio/regenerate")
def regenerate(poi_id: str, body: Regenerate, background: BackgroundTasks, user=Depends(require("audio.trigger_regenerate"))):
    configured()
    if body.retranslate:
        fail(422, "TRANSLATION_UNAVAILABLE", "Save the translated script first; this provider generates speech only.")
    created, skipped = [], []
    with mutation_lock:
        poi = editable_poi(poi_id)
        for locale in dict.fromkeys(body.locales):
            content = poi.get("content", {}).get(locale, {})
            if not database.fetch_one("languages", {"_id": locale, "is_active": True}) or not content.get("text"):
                skipped.append({"locale": locale, "reason": "Missing script or inactive language"})
                continue
            if content.get("audio_source") == "UPLOADED" and not body.replace_uploaded_audio:
                skipped.append({"locale": locale, "reason": "Uploaded audio is protected"})
                continue
            task_id = identifier("task")
            options = {"text_hash": text_hash(content), "audio_sha256": content.get("audio_sha256"), "replace_uploaded_audio": body.replace_uploaded_audio}
            try:
                query("INSERT INTO audio_tasks (id,poi_id,language_code,options,created_by) VALUES (%s,%s,%s,%s,%s)", (task_id, poi_id, locale, json.dumps(options), user["user_id"]))
            except IntegrityError:
                skipped.append({"locale": locale, "reason": "A task is already active"})
                continue
            background.add_task(execute_task, task_id, user)
            created.append(task_id)
        audit(user, "audio.regenerate", poi_id, None, {"tasks": created})
    return public({"tasks_created": created, "skipped": skipped})


@router.post("/admin/audio-tasks/{task_id}/cancel")
def cancel(task_id: str, user=Depends(require("audio.cancel_task"))):
    with mutation_lock:
        task = task_record(task_id)
        if task["state"] not in {"QUEUED", "PROCESSING"}:
            fail(409, "INVALID_STATE", "Only active tasks may be cancelled.")
        query("UPDATE audio_tasks SET state='CANCELLED',finished_at=UTC_TIMESTAMP(3) WHERE id=%s", (task_id,))
        audit(user, "audio.cancel", task_id, None, {"status": "cancelled"})
    return task_public(task_record(task_id))


@router.post("/admin/audio-tasks/{task_id}/retry")
def retry(task_id: str, background: BackgroundTasks, user=Depends(require("audio.retry_task"))):
    configured()
    with mutation_lock:
        task = task_record(task_id)
        if task["state"] not in {"FAILED", "CANCELLED"}:
            fail(409, "INVALID_STATE", "Only failed or cancelled tasks may be retried.")
        poi = editable_poi(task["poi_id"])
        content = poi.get("content", {}).get(task["language_code"], {})
        if not content.get("text"):
            fail(422, "MISSING_CONTENT", "Save a script first.")
        options = json.loads(task["options"]) if isinstance(task["options"], str) else task["options"]
        options.update(text_hash=text_hash(content), audio_sha256=content.get("audio_sha256"))
        try:
            query("UPDATE audio_tasks SET state='QUEUED',progress=0,error=NULL,started_at=NULL,finished_at=NULL,retry_count=retry_count+1,options=%s WHERE id=%s", (json.dumps(options), task_id))
        except IntegrityError:
            fail(409, "TASK_ACTIVE", "Another task is already active for this content.")
        audit(user, "audio.retry", task_id, None, {"status": "queued"})
        background.add_task(execute_task, task_id, user)
    return task_public(task_record(task_id))

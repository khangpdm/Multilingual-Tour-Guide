import hashlib
import json

from app.core.config import settings
from app.core.utils import identifier
from app.db.connection import database


def enqueue(poi, locales, user, background):
    from app.modules.audio.routes import execute_task

    created = []
    with database.connection() as connection, connection.cursor() as cursor:
        for locale in dict.fromkeys(locales):
            content = poi.get("content", {}).get(locale, {})
            if not content.get("text") or content.get("audio_url"):
                continue
            if not database.fetch_one("languages", {"_id": locale, "is_active": True}):
                continue
            fingerprint = hashlib.sha256(content["text"].encode()).hexdigest()
            cursor.execute("SELECT id,options FROM audio_tasks WHERE poi_id=%s AND language_code=%s AND state IN ('QUEUED','PROCESSING') FOR UPDATE", (poi["poi_id"], locale))
            active = cursor.fetchone()
            if active:
                options = json.loads(active["options"]) if isinstance(active["options"], str) else active["options"]
                if options.get("text_hash") == fingerprint:
                    continue
                cursor.execute("UPDATE audio_tasks SET state='CANCELLED',finished_at=UTC_TIMESTAMP(3) WHERE id=%s", (active["id"],))
            task_id = identifier("task")
            options = {"text_hash": fingerprint, "audio_sha256": content.get("audio_sha256"), "replace_uploaded_audio": False}
            cursor.execute("INSERT INTO audio_tasks (id,poi_id,language_code,options,created_by) VALUES (%s,%s,%s,%s,%s)", (task_id, poi["poi_id"], locale, json.dumps(options), user["user_id"]))
            if settings.get("TTS_ENDPOINT"):
                background.add_task(execute_task, task_id, user)
            else:
                cursor.execute("UPDATE audio_tasks SET state='FAILED',error='TTS_NOT_CONFIGURED: configure TTS_ENDPOINT or upload MP3.',finished_at=UTC_TIMESTAMP(3) WHERE id=%s", (task_id,))
            created.append(task_id)
    return created

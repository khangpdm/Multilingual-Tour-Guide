import os
from pathlib import Path

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
settings = {**dotenv_values(ROOT / ".env"), **os.environ}
ORIGINS = settings.get("ADMIN_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
COOKIE = "tour_admin_session"
COOKIE_SECURE = settings.get("ADMIN_COOKIE_SECURE", "false").lower() in {"true", "1"}
SESSION_TTL_SECONDS = int(settings.get("ADMIN_SESSION_TTL_SECONDS", "28800"))
if not 300 <= SESSION_TTL_SECONDS <= 86400:
    raise RuntimeError("ADMIN_SESSION_TTL_SECONDS must be between 300 and 86400.")
PERMISSIONS = ["poi.view", "poi.create", "poi.edit", "poi.delete", "poi.assign_qr", "content.unpublish", "content.restore", "system.manage_constants", "system.manage_languages", "audit.view"]
PERMISSIONS += ["audio.view_tasks", "audio.trigger_regenerate", "audio.cancel_task", "audio.retry_task", "offline.view", "offline.manage", "offline.publish"]
MEDIA_ROOT = Path(settings.get("ADMIN_MEDIA_ROOT") or str(ROOT / "media")).resolve()

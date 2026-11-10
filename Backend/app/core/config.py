import os
from pathlib import Path

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
settings = {**dotenv_values(ROOT / ".env"), **os.environ}
ORIGINS = settings.get("ADMIN_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
COOKIE = "tour_admin_session"
PERMISSIONS = ["poi.view", "poi.create", "poi.edit", "poi.delete", "poi.assign_qr", "content.unpublish", "content.restore", "system.manage_constants", "system.manage_languages", "audit.view"]
import secrets
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.security import password_hash
from app.core.utils import identifier, now
from app.db.connection import database


@asynccontextmanager
async def lifespan(app):
    database.command("ping")
    database.initialize()
    email = settings.get("ADMIN_EMAIL", "admin@tour.local").strip().lower()
    if not database.fetch_one("users", {"email": email}):
        password = settings.get("ADMIN_PASSWORD", "")
        if len(password) < 16 or password == "replace_with_a_unique_password":
            raise RuntimeError("Set a unique ADMIN_PASSWORD of at least 16 characters in Backend/.env")
        salt = secrets.token_hex(16)
        user_id = identifier("user")
        database.insert_record("users", {"_id": user_id, "user_id": user_id, "email": email, "full_name": "Local Admin", "role_id": "local_admin", "status": "active", "created_at": now(), "password_salt": salt, "password_hash": password_hash(password, salt)})
    yield
    database.close()
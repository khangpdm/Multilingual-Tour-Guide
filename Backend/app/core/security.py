import hashlib
import hmac

import bcrypt
from fastapi import Depends, Request

from app.core.config import COOKIE, PERMISSIONS, settings
from app.core.utils import fail, now, public
from app.db.connection import database


def password_hash(password, salt=None):
    if len(password.encode()) > 72:
        raise ValueError("Bcrypt passwords must not exceed 72 UTF-8 bytes.")
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def password_matches(password, user):
    try:
        encoded = password.encode()
        stored = (user.get("password_hash") or "").encode()
        if stored.startswith((b"$2a$", b"$2b$", b"$2y$")):
            return len(encoded) <= 72 and bcrypt.checkpw(encoded, stored)
        salt = bytes.fromhex(user.get("password_salt") or "00" * 16)
        if len(salt) != 16 or len(stored) != 128:
            return False
        return hmac.compare_digest(hashlib.scrypt(encoded, salt=salt, n=16384, r=8, p=1).hex(), stored.decode())
    except (ValueError, TypeError, UnicodeError):
        return False


def current_user(request: Request):
    token = request.cookies.get(COOKIE, "")
    session = database.fetch_valid_session(hashlib.sha256(token.encode()).hexdigest(), now()) if token else None
    if not session:
        fail(401, "UNAUTHENTICATED", "Please sign in.")
    user = database.fetch_one("users", {"_id": session["user_id"]})
    if not user or user.get("status") != "active":
        fail(403, "ACCOUNT_DEACTIVATED", "Account is not active.")
    if not user_permissions(user):
        fail(403, "ADMIN_ACCESS_DENIED", "This account has no Admin permissions.")
    return user


def user_permissions(user):
    role = database.fetch_one("roles", {"_id": user["role_id"]})
    if not role or role.get("level", 0) < 1:
        return []
    return [permission for permission in (role or {}).get("permissions", []) if permission in PERMISSIONS]


def require(permission):
    if permission not in PERMISSIONS:
        raise ValueError("Unknown Admin permission: " + permission)
    def authorized(user=Depends(current_user)):
        if permission not in user_permissions(user):
            fail(403, "FORBIDDEN", "You do not have permission.")
        return user
    return authorized


def session_response(user):
    fields = {"user_id", "username", "email", "full_name", "role_id", "status", "last_login_at", "created_at", "updated_at"}
    return {"user": public({key: value for key, value in user.items() if key in fields}), "permissions": user_permissions(user), "capabilities": {"local_database": True, "media_uploads": True, "audio_tasks": True, "tts": bool(settings.get("TTS_ENDPOINT")), "offline_packs": True}}

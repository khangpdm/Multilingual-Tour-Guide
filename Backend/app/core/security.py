import hashlib
import hmac

import bcrypt
from fastapi import Depends, Request

from app.core.config import COOKIE, PERMISSIONS
from app.core.utils import fail, now, public
from app.db.connection import database


def password_hash(password, salt=None):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def password_matches(password, user):
    stored = user.get("password_hash", "").encode()
    if stored.startswith((b"$2a$", b"$2b$", b"$2y$")):
        return bcrypt.checkpw(password.encode(), stored)
    salt = user.get("password_salt") or "00" * 16
    return hmac.compare_digest(hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex(), stored.decode())


def current_user(request: Request):
    token = request.cookies.get(COOKIE, "")
    session = database.fetch_valid_session(hashlib.sha256(token.encode()).hexdigest(), now()) if token else None
    if not session:
        fail(401, "UNAUTHENTICATED", "Please sign in.")
    user = database.fetch_one("users", {"_id": session["user_id"]})
    if not user or user.get("status") != "active":
        fail(403, "ACCOUNT_DEACTIVATED", "Account is not active.")
    return user


def user_permissions(user):
    role = database.fetch_one("roles", {"_id": user["role_id"]})
    return [permission for permission in (role or {}).get("permissions", []) if permission in PERMISSIONS]


def require(permission):
    def authorized(user=Depends(current_user)):
        if permission not in user_permissions(user):
            fail(403, "FORBIDDEN", "You do not have permission.")
        return user
    return authorized


def session_response(user):
    return {"user": public(user), "permissions": user_permissions(user), "capabilities": {"local_database": True, "media_uploads": False, "audio_tasks": False, "offline_packs": False}}
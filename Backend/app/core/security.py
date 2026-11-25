import hashlib
import hmac

import bcrypt
from fastapi import Depends, Request

from app.core.config import COOKIE, MANAGEMENT_PERMISSIONS, PERMISSIONS, settings
from app.core.utils import fail, now, public
from app.db.connection import database
from app.modules.auth.sessions import credential_fingerprint


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
    with database.connection() as connection, connection.cursor() as cursor:
        cursor.execute("SELECT proof.credential_hash,proof.mfa_verified,security.locked_by_admin FROM auth_session_assurance proof LEFT JOIN auth_account_security security ON security.user_id=%s WHERE proof.token_hash=%s", (user["_id"], session["_id"]))
        assurance = cursor.fetchone()
    if not assurance or assurance["locked_by_admin"] or not hmac.compare_digest(assurance["credential_hash"], credential_fingerprint(user)) or (user["role_id"] == "super_admin" and not assurance["mfa_verified"]):
        fail(401, "UNAUTHENTICATED", "Please sign in.")
    if not user_permissions(user):
        fail(403, "ADMIN_ACCESS_DENIED", "This account has no Admin permissions.")
    return user


def user_permissions(user):
    role = database.fetch_one("roles", {"_id": user["role_id"]})
    if not role or role.get("level", 0) < 1:
        return []
    if role["role_id"] == "super_admin" and role.get("is_system") and role["level"] == 3:
        return list(PERMISSIONS)
    return [permission for permission in (role or {}).get("permissions", []) if permission in PERMISSIONS and permission not in MANAGEMENT_PERMISSIONS]


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
    return {"user": public({key: value for key, value in user.items() if key in fields}), "permissions": user_permissions(user), "capabilities": {"local_database": True, "media_uploads": True, "audio_tasks": True, "tts": bool(settings.get("TTS_ENDPOINT")), "offline_packs": True, "permission_catalog": list(PERMISSIONS)}}

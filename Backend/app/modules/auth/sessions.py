import hashlib
import json
import secrets
from datetime import timedelta

from app.core.config import COOKIE, COOKIE_SECURE, SESSION_TTL_SECONDS
from app.core.utils import now
from app.db.connection import database


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def credential_fingerprint(user):
    return token_hash(json.dumps([user["password_hash"], user["role_id"], user["status"].lower()]))


def rotate_session(old_token, user_id):
    token = secrets.token_urlsafe(32)
    current_time = now().replace(tzinfo=None)
    expires_at = current_time + timedelta(seconds=SESSION_TTL_SECONDS)
    with database.connection() as connection, connection.cursor() as cursor:
        connection.begin()
        try:
            cursor.execute(
                "UPDATE admin_sessions SET token_hash=%s,expires_at=%s WHERE token_hash=%s AND user_id=%s AND expires_at>%s",
                (token_hash(token), expires_at, token_hash(old_token), user_id, current_time),
            )
            if cursor.rowcount != 1:
                connection.rollback()
                return None
            cursor.execute("UPDATE auth_session_assurance SET token_hash=%s WHERE token_hash=%s", (token_hash(token), token_hash(old_token)))
            if cursor.rowcount != 1:
                connection.rollback()
                return None
            connection.commit()
            return token
        except Exception:
            connection.rollback()
            raise


def set_session_cookie(response, token):
    response.set_cookie(COOKIE, token, max_age=SESSION_TTL_SECONDS, httponly=True, samesite="strict", secure=COOKIE_SECURE, path="/")

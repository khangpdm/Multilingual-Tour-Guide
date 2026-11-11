import hashlib
import secrets
from datetime import timedelta

from app.core.config import COOKIE, COOKIE_SECURE, SESSION_TTL_SECONDS
from app.core.utils import now
from app.db.connection import database


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(user_id, old_token=None):
    token = secrets.token_urlsafe(32)
    created_at = now().replace(tzinfo=None)
    expires_at = created_at + timedelta(seconds=SESSION_TTL_SECONDS)
    with database.connection() as connection, connection.cursor() as cursor:
        connection.begin()
        try:
            cursor.execute("DELETE FROM admin_sessions WHERE expires_at<=%s", (created_at,))
            if old_token:
                cursor.execute("DELETE FROM admin_sessions WHERE token_hash=%s", (token_hash(old_token),))
            cursor.execute("INSERT INTO admin_sessions (token_hash,user_id,expires_at) VALUES (%s,%s,%s)", (token_hash(token), user_id, expires_at))
            cursor.execute("UPDATE users SET last_login_at=%s WHERE id=%s", (created_at, user_id))
            connection.commit()
        except Exception:
            connection.rollback()
            raise
    return token


def rotate_session(old_token, user_id):
    token = secrets.token_urlsafe(32)
    current_time = now().replace(tzinfo=None)
    expires_at = current_time + timedelta(seconds=SESSION_TTL_SECONDS)
    with database.connection() as connection, connection.cursor() as cursor:
        cursor.execute(
            "UPDATE admin_sessions SET token_hash=%s,expires_at=%s WHERE token_hash=%s AND user_id=%s AND expires_at>%s",
            (token_hash(token), expires_at, token_hash(old_token), user_id, current_time),
        )
        return token if cursor.rowcount == 1 else None


def set_session_cookie(response, token):
    response.set_cookie(COOKIE, token, max_age=SESSION_TTL_SECONDS, httponly=True, samesite="strict", secure=COOKIE_SECURE, path="/")

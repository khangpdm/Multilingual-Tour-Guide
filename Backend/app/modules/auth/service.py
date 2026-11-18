import hmac
import json
import logging
import secrets
from contextlib import contextmanager
from datetime import timedelta
from pathlib import Path
from uuid import uuid4

from app.core.config import SESSION_TTL_SECONDS, settings
from app.core.security import password_hash, password_matches, user_permissions
from app.core.utils import fail, now
from app.db.connection import database
from app.modules.auth.mail import password_reset_url, send_auth_email
from app.modules.auth.sessions import credential_fingerprint, token_hash

logger = logging.getLogger(__name__)
LOCK_SECONDS = int(settings.get("ADMIN_LOCK_SECONDS", "900"))
RESET_SECONDS = int(settings.get("ADMIN_RESET_TTL_SECONDS", "1800"))
if not 60 <= LOCK_SECONDS <= 86400 or not 300 <= RESET_SECONDS <= 3600:
    raise RuntimeError("Invalid Admin lock/reset lifetime configuration.")
DUMMY_USER = {"password_hash": password_hash(secrets.token_urlsafe(32))}


def initialize_auth():
    with database.connection() as connection, connection.cursor() as cursor:
        for statement in Path(__file__).with_name("schema.sql").read_text(encoding="utf-8").split(";"):
            if statement.strip():
                cursor.execute(statement)
        cursor.execute("DELETE FROM auth_challenges WHERE expires_at<=UTC_TIMESTAMP(3)")
        cursor.execute("DELETE proof FROM auth_session_assurance proof LEFT JOIN admin_sessions session ON session.token_hash=proof.token_hash WHERE session.token_hash IS NULL")


@contextmanager
def transaction():
    with database.connection() as connection, connection.cursor() as cursor:
        connection.begin()
        try:
            yield connection, cursor
            connection.commit()
        except Exception:
            connection.rollback()
            raise


def reject(connection, status, code, message):
    connection.commit()
    fail(status, code, message)


def fingerprint(user):
    return credential_fingerprint(user)


def write_audit(cursor, user, action, after=None):
    cursor.execute(
        "INSERT INTO audit_logs (id,actor_user_id,action,target_id,after_data) VALUES (%s,%s,%s,%s,%s)",
        (str(uuid4()), user["id"], action, user["id"], json.dumps(after) if after is not None else None),
    )


def lock_state(cursor, user_id):
    cursor.execute("INSERT IGNORE INTO auth_account_security (user_id) VALUES (%s)", (user_id,))
    cursor.execute("SELECT * FROM auth_account_security WHERE user_id=%s FOR UPDATE", (user_id,))
    return cursor.fetchone()


def check_active(connection, user):
    if user["status"] != "ACTIVE":
        reject(connection, 403, "ACCOUNT_DEACTIVATED", "Tài khoản chưa kích hoạt hoặc đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.")


def check_lock(connection, state, current_time):
    if state["locked_until"] and state["locked_until"] > current_time:
        reject(connection, 423, "ACCOUNT_LOCKED", f"Tài khoản bị khóa tạm thời. Thử lại sau {state['locked_until'].isoformat()}Z (UTC).")


def issue_challenge(cursor, user, kind, lifetime, code=None):
    token = secrets.token_urlsafe(32)
    cursor.execute("DELETE FROM auth_challenges WHERE user_id=%s AND kind=%s", (user["id"], kind))
    cursor.execute(
        "INSERT INTO auth_challenges (token_hash,user_id,kind,proof_hash,credential_hash,expires_at) VALUES (%s,%s,%s,%s,%s,%s)",
        (token_hash(token), user["id"], kind, token_hash(token + ":" + code) if code else None, fingerprint(user), now().replace(tzinfo=None) + timedelta(seconds=lifetime)),
    )
    return token


def grant_session(cursor, user, old_token, mfa_verified=False):
    current_time = now().replace(tzinfo=None)
    token = secrets.token_urlsafe(32)
    if old_token:
        cursor.execute("DELETE FROM admin_sessions WHERE token_hash=%s", (token_hash(old_token),))
    cursor.execute("DELETE FROM admin_sessions WHERE expires_at<=%s", (current_time,))
    cursor.execute("INSERT INTO admin_sessions (token_hash,user_id,expires_at) VALUES (%s,%s,%s)", (token_hash(token), user["id"], current_time + timedelta(seconds=SESSION_TTL_SECONDS)))
    cursor.execute("DELETE proof FROM auth_session_assurance proof LEFT JOIN admin_sessions session ON session.token_hash=proof.token_hash WHERE session.token_hash IS NULL")
    cursor.execute("INSERT INTO auth_session_assurance (token_hash,credential_hash,mfa_verified) VALUES (%s,%s,%s)", (token_hash(token), fingerprint(user), mfa_verified))
    cursor.execute("UPDATE users SET last_login_at=%s WHERE id=%s", (current_time, user["id"]))
    cursor.execute("UPDATE auth_account_security SET failed_attempts=0,locked_until=NULL WHERE user_id=%s", (user["id"],))
    write_audit(cursor, user, "login_success", {"mfa_bypassed_local": True} if user["role_id"] == "super_admin" and not mfa_verified else None)
    return token


def login_email(email, password, old_token=None, *, local_mfa_bypass=False):
    with transaction() as (connection, cursor):
        cursor.execute("SELECT * FROM users WHERE email=%s FOR UPDATE", (email,))
        user = cursor.fetchone()
        if not user:
            password_matches(password, DUMMY_USER)
            reject(connection, 401, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.")
        check_active(connection, user)
        state = lock_state(cursor, user["id"])
        current_time = now().replace(tzinfo=None)
        check_lock(connection, state, current_time)
        if not password_matches(password, user):
            failures = (0 if state["locked_until"] else state["failed_attempts"]) + 1
            locked_until = current_time + timedelta(seconds=LOCK_SECONDS) if failures >= 5 else None
            cursor.execute("UPDATE auth_account_security SET failed_attempts=%s,locked_until=%s WHERE user_id=%s", (failures, locked_until, user["id"]))
            if locked_until:
                cursor.execute("DELETE FROM auth_challenges WHERE user_id=%s AND kind='mfa'", (user["id"],))
                write_audit(cursor, user, "account_locked", {"locked_until": locked_until.isoformat() + "Z"})
                check_lock(connection, {"locked_until": locked_until}, current_time)
            reject(connection, 401, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.")
        mapped = {**user, "_id": user["id"], "status": "active"}
        if not user_permissions(mapped):
            reject(connection, 403, "ADMIN_ACCESS_DENIED", "Tài khoản không có quyền truy cập Admin.")
        if user["role_id"] == "super_admin" and not local_mfa_bypass:
            code = f"{secrets.randbelow(1000000):06d}"
            challenge = issue_challenge(cursor, user, "mfa", 300, code)
            result = {"mfa_required": True, "challenge_token": challenge, "expires_in": 300}
            recipient = user["email"]
        else:
            return {"session_token": grant_session(cursor, user, old_token), "user_id": user["id"]}
    try:
        send_auth_email(recipient, "Tour Guide - Mã xác thực đăng nhập", f"Mã OTP của bạn: {code}\nCó hiệu lực trong 5 phút. Không chia sẻ mã này.")
    except Exception:
        with database.connection() as connection, connection.cursor() as cursor:
            cursor.execute("DELETE FROM auth_challenges WHERE token_hash=%s", (token_hash(challenge),))
        logger.warning("MFA email delivery failed; no session issued.")
        fail(503, "AUTH_EMAIL_UNAVAILABLE", "Không thể hoàn tất đăng nhập. Vui lòng thử lại sau.")
    return result


def challenge_user(cursor, digest, kind):
    cursor.execute("SELECT user_id FROM auth_challenges WHERE token_hash=%s AND kind=%s", (digest, kind))
    challenge = cursor.fetchone()
    if not challenge:
        return None, None
    cursor.execute("SELECT * FROM users WHERE id=%s FOR UPDATE", (challenge["user_id"],))
    user = cursor.fetchone()
    cursor.execute("SELECT * FROM auth_challenges WHERE token_hash=%s AND kind=%s FOR UPDATE", (digest, kind))
    return user, cursor.fetchone()


def valid_challenge(user, challenge):
    return bool(user and challenge and user["status"] == "ACTIVE" and challenge["expires_at"] > now().replace(tzinfo=None) and hmac.compare_digest(challenge["credential_hash"], fingerprint(user)))


def verify_mfa(challenge_token, code, old_token=None):
    digest = token_hash(challenge_token)
    with transaction() as (connection, cursor):
        user, challenge = challenge_user(cursor, digest, "mfa")
        if not valid_challenge(user, challenge) or user["role_id"] != "super_admin":
            cursor.execute("DELETE FROM auth_challenges WHERE token_hash=%s", (digest,))
            reject(connection, 401, "MFA_EXPIRED", "Lần đăng nhập đã hủy hoặc hết hạn. Vui lòng đăng nhập lại.")
        state = lock_state(cursor, user["id"])
        check_lock(connection, state, now().replace(tzinfo=None))
        if not user_permissions({**user, "_id": user["id"], "status": "active"}):
            reject(connection, 403, "ADMIN_ACCESS_DENIED", "Tài khoản không có quyền truy cập Admin.")
        if not hmac.compare_digest(challenge["proof_hash"], token_hash(challenge_token + ":" + code)):
            attempts = challenge["attempts"] + 1
            if attempts >= 3:
                cursor.execute("DELETE FROM auth_challenges WHERE token_hash=%s", (digest,))
                reject(connection, 401, "MFA_EXPIRED", "Đã sai OTP 3 lần. Vui lòng đăng nhập lại.")
            cursor.execute("UPDATE auth_challenges SET attempts=%s WHERE token_hash=%s", (attempts, digest))
            reject(connection, 401, "INVALID_OTP", f"Mã OTP không đúng. Còn {3 - attempts} lần thử.")
        cursor.execute("DELETE FROM auth_challenges WHERE token_hash=%s", (digest,))
        return {"session_token": grant_session(cursor, user, old_token, mfa_verified=True), "user_id": user["id"]}


def request_password_reset(email):
    digest = None
    try:
        with transaction() as (connection, cursor):
            cursor.execute("SELECT * FROM users WHERE email=%s FOR UPDATE", (email,))
            user = cursor.fetchone()
            if not user or user["status"] != "ACTIVE":
                return
            cursor.execute("SELECT created_at FROM auth_challenges WHERE user_id=%s AND kind='reset'", (user["id"],))
            previous = cursor.fetchone()
            if previous and previous["created_at"] > now().replace(tzinfo=None) - timedelta(seconds=60):
                return
            token = issue_challenge(cursor, user, "reset", RESET_SECONDS)
            digest = token_hash(token)
            recipient = user["email"]
        url = password_reset_url(token)
        send_auth_email(recipient, "Tour Guide - Đặt lại mật khẩu", f"Mở liên kết để đặt lại mật khẩu:\n{url}\nLiên kết dùng một lần, hết hạn sau {RESET_SECONDS // 60} phút. Nếu không yêu cầu, hãy bỏ qua email này.")
    except Exception:
        logger.warning("Password reset could not be delivered; generic response retained.")
        if digest:
            try:
                with database.connection() as connection, connection.cursor() as cursor:
                    cursor.execute("DELETE FROM auth_challenges WHERE token_hash=%s", (digest,))
            except Exception:
                logger.warning("Failed to remove undelivered password reset challenge.")


def reset_password(token, password):
    hashed = password_hash(password)
    digest = token_hash(token)
    with transaction() as (connection, cursor):
        user, challenge = challenge_user(cursor, digest, "reset")
        if not valid_challenge(user, challenge):
            cursor.execute("DELETE FROM auth_challenges WHERE token_hash=%s", (digest,))
            reject(connection, 400, "RESET_LINK_INVALID", "Liên kết hết hạn, đã dùng hoặc không hợp lệ. Vui lòng yêu cầu liên kết mới.")
        cursor.execute("UPDATE users SET password_hash=%s,password_salt=NULL WHERE id=%s", (hashed, user["id"]))
        cursor.execute("DELETE FROM admin_sessions WHERE user_id=%s", (user["id"],))
        cursor.execute("DELETE FROM auth_challenges WHERE user_id=%s", (user["id"],))
        cursor.execute("DELETE FROM auth_account_security WHERE user_id=%s", (user["id"],))
        write_audit(cursor, user, "password_reset")

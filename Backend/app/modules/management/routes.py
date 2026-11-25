import json
import logging
import secrets
from contextlib import contextmanager
from datetime import timedelta

from fastapi import APIRouter, Depends, Query, Request, Response
from pymysql import IntegrityError

from app.core.config import PERMISSIONS, settings
from app.core.security import password_hash, require
from app.core.utils import fail, identifier, now, public
from app.db.connection import database
from app.modules.auth.mail import account_link, send_auth_email
from app.modules.auth.service import RESET_SECONDS, issue_challenge, send_password_reset
from app.modules.auth.sessions import token_hash
from app.modules.management.schemas import Activation, PermissionChanges, RoleCreate, UserEdit, UserInvite

router = APIRouter()
logger = logging.getLogger(__name__)
INVITE_DAYS = int(settings.get("ADMIN_INVITE_TTL_DAYS", "7"))
if INVITE_DAYS < 1:
    raise RuntimeError("ADMIN_INVITE_TTL_DAYS must be positive.")

USER_FIELDS = """id AS user_id,username,email,full_name,role_id,
    CASE WHEN status='ACTIVE' AND invite_token_hash IS NOT NULL THEN 'pending_activation'
         WHEN status='ACTIVE' AND EXISTS (
             SELECT 1 FROM auth_account_security AS security WHERE security.user_id=users.id
             AND (security.locked_by_admin OR security.locked_until>UTC_TIMESTAMP(3))
         ) THEN 'locked'
         ELSE LOWER(status) END AS status,
    created_at,last_login_at,invite_expires_at"""


def deliver_account_email(send, *args):
    try:
        send(*args)
        return "sent"
    except Exception as error:
        logger.warning("Account email delivery failed (type=%s, SMTP status=%s).", type(error).__name__, getattr(error, "smtp_code", None))
        return "failed"


def send_invitation(email, token):
    url = account_link("/activate", token)
    send_auth_email(email, "Tour Guide - Thiết lập mật khẩu lần đầu",
                    f"Mở liên kết để thiết lập mật khẩu:\n{url}\nLiên kết dùng một lần và hết hạn sau {INVITE_DAYS} ngày.")



def role_permissions(cursor, role_id):
    if role_id == "super_admin":
        return set(PERMISSIONS)
    cursor.execute("SELECT permission_id FROM role_permissions WHERE role_id=%s", (role_id,))
    return {row["permission_id"] for row in cursor.fetchall()} & set(PERMISSIONS)


@contextmanager
def transaction(user=None, permission=None):
    with database.connection() as connection, connection.cursor() as cursor:
        connection.begin()
        try:
            cursor.execute("SELECT id,name,level,is_system FROM roles ORDER BY id FOR UPDATE")
            roles = {row["id"]: row for row in cursor.fetchall()}
            actor = None
            if user:
                cursor.execute("SELECT id,role_id,status FROM users WHERE id=%s FOR UPDATE", (user["user_id"],))
                actor = cursor.fetchone()
                if not actor or actor["status"].upper() != "ACTIVE" or roles[actor["role_id"]]["level"] < 1 or permission not in role_permissions(cursor, actor["role_id"]):
                    fail(403, "FORBIDDEN", "You do not have permission.")
                actor["level"] = roles[actor["role_id"]]["level"]
            yield cursor, roles, actor
            connection.commit()
        except IntegrityError:
            connection.rollback()
            fail(409, "ALREADY_EXISTS", "Record already exists or conflicts with related data.")
        except Exception:
            connection.rollback()
            raise


def write_audit(cursor, user, action, target, before, after):
    cursor.execute(
        "INSERT INTO audit_logs (id,actor_user_id,action,target_id,before_data,after_data) VALUES (%s,%s,%s,%s,%s,%s)",
        (identifier("audit"), user["user_id"], action, target, json.dumps(before), json.dumps(after)),
    )


def check_role_access(actor, role):
    if not role or role["level"] < 1:
        fail(422, "INVALID_ROLE", "Choose an Admin role.")
    if actor["role_id"] != "super_admin" and role["level"] >= actor["level"]:
        fail(403, "FORBIDDEN", "You cannot manage a role at or above your level.")


def check_permissions(cursor, actor, permissions):
    if not set(permissions) <= set(PERMISSIONS):
        fail(422, "INVALID_PERMISSION", "Unknown or unavailable permission.")
    if not set(permissions) <= role_permissions(cursor, actor["role_id"]):
        fail(403, "FORBIDDEN", "You cannot grant permissions you do not have.")


@router.get("/admin/roles")
def list_roles(user=Depends(require("role.view"))):
    roles = database.fetch_all("roles")
    for role in roles:
        role["is_system"] = bool(role["is_system"])
        role["permissions"] = list(PERMISSIONS) if role["role_id"] == "super_admin" else [permission for permission in role["permissions"] if permission in PERMISSIONS]
    return {"roles": [public(role) for role in roles]}


@router.post("/admin/roles", status_code=201)
def create_role(body: RoleCreate, user=Depends(require("role.create"))):
    with transaction(user, "role.create") as (cursor, roles, actor):
        if body.role_id in {"super_admin", "admin", "poi_manager", "user", "local_admin"} or body.role_id in roles:
            fail(409, "ROLE_EXISTS", "Role ID is reserved or already exists.")
        check_role_access(actor, {"level": body.level})
        check_permissions(cursor, actor, body.permission_ids)
        cursor.execute("INSERT INTO roles (id,name,level,is_system) VALUES (%s,%s,%s,FALSE)", (body.role_id, body.name, body.level))
        for permission in sorted(set(body.permission_ids)):
            cursor.execute("INSERT INTO role_permissions (role_id,permission_id) VALUES (%s,%s)", (body.role_id, permission))
        write_audit(cursor, user, "role.create", body.role_id, None, body.model_dump())
    return {"role_id": body.role_id}


@router.post("/admin/roles/{role_id}/permissions")
def change_permissions(role_id: str, body: PermissionChanges, user=Depends(require("role.assign_permission"))):
    with transaction(user, "role.assign_permission") as (cursor, roles, actor):
        if role_id in {"super_admin", "admin", "poi_manager", "user", actor["role_id"]}:
            fail(403, "PROTECTED_ROLE", "This role cannot be modified.")
        if role_id not in roles:
            fail(404, "NOT_FOUND", "Record not found.")
        check_role_access(actor, roles[role_id])
        check_permissions(cursor, actor, body.grant)
        if set(body.grant) & set(body.revoke) or not set(body.revoke) <= set(PERMISSIONS):
            fail(422, "INVALID_PERMISSION", "Invalid permission changes.")
        before = role_permissions(cursor, role_id)
        after = (before | set(body.grant)) - set(body.revoke)
        for permission in body.revoke:
            cursor.execute("DELETE FROM role_permissions WHERE role_id=%s AND permission_id=%s", (role_id, permission))
        for permission in body.grant:
            cursor.execute("INSERT IGNORE INTO role_permissions (role_id,permission_id) VALUES (%s,%s)", (role_id, permission))
        write_audit(cursor, user, "role.assign_permission", role_id, sorted(before), sorted(after))
    return {"permissions": sorted(after)}


@router.get("/admin/users")
def list_users(page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=100), user=Depends(require("user.view"))):
    with database.connection() as connection, connection.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) AS total FROM users WHERE role_id IN (SELECT id FROM roles WHERE level>0)")
        total = cursor.fetchone()["total"]
        cursor.execute(f"SELECT {USER_FIELDS} FROM users WHERE role_id IN (SELECT id FROM roles WHERE level>0) ORDER BY created_at,id LIMIT %s OFFSET %s", (page_size, (page - 1) * page_size))
        items = [public(row) for row in cursor.fetchall()]
    return {"items": items, "total": total}


@router.post("/admin/users/invite", status_code=201)
def invite_user(body: UserInvite, response: Response, user=Depends(require("user.create"))):
    token = secrets.token_urlsafe(32)
    user_id = identifier("user")
    username = "member_" + user_id.replace("-", "")
    expires = now().replace(tzinfo=None) + timedelta(days=INVITE_DAYS)
    with transaction(user, "user.create") as (cursor, roles, actor):
        check_role_access(actor, roles.get(body.role_id))
        check_permissions(cursor, actor, role_permissions(cursor, body.role_id))
        cursor.execute("INSERT INTO users (id,username,email,password_hash,full_name,role_id,status,invite_token_hash,invite_expires_at) VALUES (%s,%s,%s,%s,%s,%s,'ACTIVE',%s,%s)", (user_id, username, body.email, password_hash(secrets.token_urlsafe(32)), body.full_name, body.role_id, token_hash(token), expires))
        write_audit(cursor, user, "user.invite", user_id, None, {"email": body.email, "role_id": body.role_id})
    response.headers["Cache-Control"] = "no-store"
    return {"user_id": user_id, "username": username, "activation_path": "/activate?token=" + token, "delivery": deliver_account_email(send_invitation, body.email, token)}


def target_user(cursor, roles, actor, user_id):
    cursor.execute(f"SELECT {USER_FIELDS} FROM users WHERE id=%s FOR UPDATE", (user_id,))
    target = cursor.fetchone()
    if not target:
        fail(404, "NOT_FOUND", "Record not found.")
    if user_id != actor["id"]:
        check_role_access(actor, roles.get(target["role_id"]))
    return target


@router.post("/admin/users/{user_id}/reissue-invitation")
def reissue_invitation(user_id: str, response: Response, user=Depends(require("user.create"))):
    with transaction(user, "user.create") as (cursor, roles, actor):
        target = target_user(cursor, roles, actor, user_id)
        if target["status"] != "pending_activation":
            fail(409, "INVITATION_NOT_PENDING", "Chỉ có thể cấp lại link cho tài khoản đang chờ kích hoạt.")
        check_permissions(cursor, actor, role_permissions(cursor, target["role_id"]))
        token = secrets.token_urlsafe(32)
        expires = now().replace(tzinfo=None) + timedelta(days=INVITE_DAYS)
        cursor.execute(
            "UPDATE users SET invite_token_hash=%s, invite_expires_at=%s WHERE id=%s",
            (token_hash(token), expires, user_id),
        )
        expires_at = public({"value": expires})["value"]
        write_audit(cursor, user, "user.reissue_invitation", user_id, None, {"invite_expires_at": expires_at})
    response.headers["Cache-Control"] = "no-store"
    return {"username": target["username"], "activation_path": "/activate?token=" + token, "delivery": deliver_account_email(send_invitation, target["email"], token)}


def protect_last_super(cursor, target):
    if target["role_id"] == "super_admin" and target["status"] in {"active", "locked"}:
        cursor.execute("""SELECT id FROM users WHERE role_id='super_admin' AND status='ACTIVE'
                       AND invite_token_hash IS NULL AND id<>%s AND NOT EXISTS (
                           SELECT 1 FROM auth_account_security AS security WHERE security.user_id=users.id
                           AND (security.locked_by_admin OR security.locked_until>UTC_TIMESTAMP(3))
                       ) FOR UPDATE""", (target["user_id"],))
        if not cursor.fetchone():
            fail(409, "LAST_SUPER_ADMIN", "The last active Super Admin must remain active.")


@router.put("/admin/users/{user_id}")
def edit_user(user_id: str, body: UserEdit, user=Depends(require("user.edit"))):
    with transaction(user, "user.edit") as (cursor, roles, actor):
        target = target_user(cursor, roles, actor, user_id)
        new_role = body.role_id or target["role_id"]
        if new_role != target["role_id"]:
            if user_id == actor["id"]:
                fail(403, "SELF_ROLE_CHANGE", "You cannot change your own role.")
            protect_last_super(cursor, target)
            check_role_access(actor, roles.get(new_role))
            check_permissions(cursor, actor, role_permissions(cursor, new_role))
        full_name = body.full_name if "full_name" in body.model_fields_set else target["full_name"]
        cursor.execute("UPDATE users SET full_name=%s,role_id=%s WHERE id=%s", (full_name, new_role, user_id))
        if new_role != target["role_id"]:
            cursor.execute("DELETE FROM admin_sessions WHERE user_id=%s", (user_id,))
        write_audit(cursor, user, "user.update", user_id, {"full_name": target["full_name"], "role_id": target["role_id"]}, {"full_name": full_name, "role_id": new_role})
    return {"user_id": user_id}


@router.put("/admin/users/{user_id}/deactivate")
def deactivate_user(user_id: str, user=Depends(require("user.deactivate"))):
    with transaction(user, "user.deactivate") as (cursor, roles, actor):
        if user_id == actor["id"]:
            fail(403, "SELF_DEACTIVATION", "You cannot deactivate yourself.")
        target = target_user(cursor, roles, actor, user_id)
        protect_last_super(cursor, target)
        cursor.execute("UPDATE users SET status='DEACTIVATED',deactivated_at=UTC_TIMESTAMP(3),invite_token_hash=NULL,invite_expires_at=NULL WHERE id=%s", (user_id,))
        cursor.execute("DELETE FROM admin_sessions WHERE user_id=%s", (user_id,))
        write_audit(cursor, user, "user.deactivate", user_id, {"status": target["status"]}, {"status": "deactivated"})
    return {"user_id": user_id, "status": "deactivated"}


@router.put("/admin/users/{user_id}/lock")
@router.put("/admin/users/{user_id}/unlock")
def set_user_lock(user_id: str, request: Request, user=Depends(require("user.deactivate"))):
    locked = request.url.path.endswith("/lock")
    with transaction(user, "user.deactivate") as (cursor, roles, actor):
        target = target_user(cursor, roles, actor, user_id)
        if locked and user_id == actor["id"]:
            fail(403, "SELF_LOCK", "Bạn không thể tự khóa tài khoản.")
        if target["status"] != ("active" if locked else "locked"):
            fail(409, "INVALID_ACCOUNT_STATE", "Trạng thái tài khoản đã thay đổi. Vui lòng tải lại.")
        if locked:
            protect_last_super(cursor, target)
        cursor.execute(
            "INSERT INTO auth_account_security (user_id,locked_by_admin) VALUES (%s,%s) "
            "ON DUPLICATE KEY UPDATE locked_by_admin=%s,failed_attempts=0,locked_until=NULL",
            (user_id, locked, locked),
        )
        if locked:
            cursor.execute("DELETE FROM admin_sessions WHERE user_id=%s", (user_id,))
            cursor.execute("DELETE FROM auth_challenges WHERE user_id=%s AND kind='mfa'", (user_id,))
        status = "locked" if locked else "active"
        write_audit(cursor, user, "user.lock" if locked else "user.unlock", user_id,
                    {"status": target["status"]}, {"status": status})
    return {"user_id": user_id, "status": status}


@router.post("/admin/users/{user_id}/send-password-reset")
def send_user_password_reset(user_id: str, user=Depends(require("user.edit"))):
    with transaction(user, "user.edit") as (cursor, roles, actor):
        target = target_user(cursor, roles, actor, user_id)
        if target["status"] not in {"active", "locked"}:
            fail(409, "INVALID_ACCOUNT_STATE", "Tài khoản cần thiết lập mật khẩu trước khi đặt lại.")
        cursor.execute("SELECT * FROM users WHERE id=%s", (user_id,))
        token = issue_challenge(cursor, cursor.fetchone(), "reset", RESET_SECONDS)
        write_audit(cursor, user, "user.request_password_reset", user_id, None, None)
    return {"delivery": deliver_account_email(send_password_reset, target["email"], token)}


@router.post("/auth/activate")
def activate_user(body: Activation):
    with transaction() as (cursor, roles, actor):
        cursor.execute("SELECT id,username FROM users WHERE invite_token_hash=%s AND invite_expires_at>UTC_TIMESTAMP(3) AND status IN ('PENDING_ACTIVATION','ACTIVE') FOR UPDATE", (token_hash(body.token),))
        target = cursor.fetchone()
        if not target:
            fail(422, "INVALID_INVITATION", "Invitation is invalid, expired or already used.")
        hashed = password_hash(body.password)
        cursor.execute("UPDATE users SET status='ACTIVE',password_hash=%s,password_salt=NULL,full_name=%s,invite_token_hash=NULL,invite_expires_at=NULL WHERE id=%s", (hashed, body.full_name, target["id"]))
        write_audit(cursor, {"user_id": target["id"]}, "user.activate", target["id"], {"status": "pending_activation"}, {"status": "active"})
    return {"username": target["username"], "status": "active"}

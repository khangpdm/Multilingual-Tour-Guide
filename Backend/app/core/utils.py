from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder

from app.db.connection import database
from app.core.messages import localize_messages, message_vi


def now():
    return datetime.now(timezone.utc)


def identifier(prefix):
    return str(uuid4())


def public(document):
    return jsonable_encoder(
        localize_messages({key: value for key, value in document.items() if key not in {"_id", "password_hash", "password_salt"}}),
        custom_encoder={datetime: lambda value: (value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value).isoformat()},
    )


def fail(status, code, message):
    raise HTTPException(status, {"code": code, "message": message_vi(message)})


def get_record(collection, record_id):
    document = database.fetch_one(collection, {"_id": record_id})
    if not document:
        fail(404, "NOT_FOUND", "Record not found.")
    return document


def audit_data(value):
    if isinstance(value, dict):
        sanitized = {}
        for key, item in value.items():
            normalized = str(key).lower().replace("-", "_")
            if normalized in {"authorization", "cookie", "set_cookie", "activation_path", "credential", "credentials"} or any(part in normalized for part in ("password", "secret", "token", "api_key", "apikey")):
                continue
            sanitized[key] = audit_data(item)
        return sanitized
    if isinstance(value, (list, tuple)):
        return [audit_data(item) for item in value]
    return value

def audit(user, action, target, before, after):
    database.insert_record("audit_logs", {"_id": identifier("audit"), "log_id": identifier("audit"), "actor_user_id": user["user_id"], "actor_email": user["email"], "action": action, "target_id": target, "before": public(audit_data(before)) if before is not None else None, "after": public(audit_data(after)) if after is not None else None, "timestamp": now()})


def update_record(collection, record_id, changes, user, action):
    with database.transaction():
        if collection == "pois":
            database.lock_poi(record_id)
        before = get_record(collection, record_id)
        changes = {**changes, "updated_at": now()}
        if collection == "pois":
            database.save_snapshot(before, user["user_id"])
            changes["content_version"] = before["content_version"] + 1
        after = database.update_record(collection, record_id, changes)
        audit(user, action, record_id, before, after)
        return after

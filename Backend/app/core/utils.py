from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder

from app.db.connection import database


def now():
    return datetime.now(timezone.utc)


def identifier(prefix):
    return str(uuid4())


def public(document):
    return jsonable_encoder({key: value for key, value in document.items() if key not in {"_id", "password_hash", "password_salt"}})


def fail(status, code, message):
    raise HTTPException(status, {"code": code, "message": message})


def get_record(collection, record_id):
    document = database.fetch_one(collection, {"_id": record_id})
    if not document:
        fail(404, "NOT_FOUND", "Record not found.")
    return document


def audit(user, action, target, before, after):
    database.insert_record("audit_logs", {"_id": identifier("audit"), "log_id": identifier("audit"), "actor_user_id": user["user_id"], "actor_email": user["email"], "action": action, "target_id": target, "before": public(before) if before else None, "after": public(after) if after else None, "timestamp": now()})


def update_record(collection, record_id, changes, user, action):
    before = get_record(collection, record_id)
    changes["updated_at"] = now()
    after = database.update_record(collection, record_id, changes)
    audit(user, action, record_id, before, after)
    return after
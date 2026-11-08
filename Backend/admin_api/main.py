import hashlib
import bcrypt
import hmac
import os
import re
import secrets
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from dotenv import dotenv_values
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator
from pymysql import MySQLError

from admin_api.mysql_store import DuplicateRecordError, MySQLDatabase

ROOT = Path(__file__).resolve().parents[1]
settings = {**dotenv_values(ROOT / ".env"), **os.environ}
ORIGINS = settings.get("ADMIN_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
COOKIE = "tour_admin_session"
PERMISSIONS = ["poi.view", "poi.create", "poi.edit", "poi.delete", "poi.assign_qr", "content.unpublish", "content.restore", "system.manage_constants", "system.manage_languages", "audit.view"]
database = MySQLDatabase(settings)
mutation_lock = threading.RLock()
login_attempts = defaultdict(deque)


def now():
    return datetime.now(timezone.utc)


def identifier(prefix):
    return str(uuid4())


def password_hash(password, salt=None):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()

def password_matches(password, user):
    stored = user.get("password_hash", "").encode()
    if stored.startswith((b"$2a$", b"$2b$", b"$2y$")):
        return bcrypt.checkpw(password.encode(), stored)
    salt = user.get("password_salt") or "00" * 16
    return hmac.compare_digest(hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex(), stored.decode())


def public(document):
    return jsonable_encoder({key: value for key, value in document.items() if key not in {"_id", "password_hash", "password_salt"}})


def fail(status, code, message):
    raise HTTPException(status, {"code": code, "message": message})


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


app = FastAPI(title="Tour Guide Local Admin API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_credentials=True, allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Content-Type"])


@app.middleware("http")
async def protect_writes(request: Request, call_next):
    if request.method in {"POST", "PUT", "DELETE", "PATCH"}:
        if request.headers.get("origin") not in ORIGINS:
            return JSONResponse({"error": {"code": "INVALID_ORIGIN", "message": "Write requests require an allowed Admin Origin."}}, status_code=403)
        length = request.headers.get("content-length", "0")
        if not length.isdigit() or int(length) > 131072:
            return JSONResponse({"error": {"code": "BODY_TOO_LARGE", "message": "Request body is too large."}}, status_code=413)
    return await call_next(request)


@app.exception_handler(HTTPException)
async def http_error(request, error):
    detail = error.detail if isinstance(error.detail, dict) else {"code": "HTTP_ERROR", "message": str(error.detail)}
    return JSONResponse({"error": detail}, status_code=error.status_code, headers=error.headers)


@app.exception_handler(RequestValidationError)
async def invalid_request(request, error):
    return JSONResponse({"error": {"code": "VALIDATION_ERROR", "message": "Invalid input.", "details": [{"field": ".".join(map(str, item["loc"])), "reason": item["msg"]} for item in error.errors()]}}, status_code=422)


@app.exception_handler(DuplicateRecordError)
async def duplicate(request, error):
    return JSONResponse({"error": {"code": "ALREADY_EXISTS", "message": "This record already exists."}}, status_code=409)


@app.exception_handler(MySQLError)
async def database_error(request, error):
    return JSONResponse({"error": {"code": "DATABASE_UNAVAILABLE", "message": "MySQL is unavailable. Check Backend/.env and the MySQL service."}}, status_code=503)


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)


class Login(Input):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)


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


@app.get("/health")
def health():
    database.command("ping")
    return {"status": "ok", "database": database.name, "mode": "local-admin"}


@app.get("/admin/database/summary")
def database_summary(user=Depends(require("poi.view"))):
    return {"tables": database.table_counts()}

@app.post("/auth/login")
def login(body: Login, request: Request, response: Response):
    email = body.email.lower()
    key = (request.client.host, email)
    with mutation_lock:
        cutoff = time.monotonic() - 60
        for old_key in list(login_attempts):
            while login_attempts[old_key] and login_attempts[old_key][0] < cutoff:
                login_attempts[old_key].popleft()
            if not login_attempts[old_key]:
                del login_attempts[old_key]
        if len(login_attempts[key]) >= 5:
            raise HTTPException(429, {"code": "RATE_LIMITED", "message": "Try again in a minute."}, headers={"Retry-After": "60"})
        login_attempts[key].append(time.monotonic())
    user = database.fetch_one("users", {"email": email})
    salt = (user or {}).get("password_salt", "00" * 16)
    if not user or not password_matches(body.password, user):
        fail(401, "INVALID_CREDENTIALS", "Invalid email or password.")
    if user.get("status") != "active":
        fail(403, "ACCOUNT_DEACTIVATED", "Account is not active.")
    token = secrets.token_urlsafe(32)
    old_token = request.cookies.get(COOKIE)
    if old_token:
        database.delete_record("admin_sessions", hashlib.sha256(old_token.encode()).hexdigest())
    database.insert_record("admin_sessions", {"_id": hashlib.sha256(token.encode()).hexdigest(), "user_id": user["_id"], "expires_at": now() + timedelta(hours=8)})
    database.update_record("users", user["_id"], {"last_login_at": now()})
    response.set_cookie(COOKIE, token, max_age=28800, httponly=True, samesite="strict", secure=False, path="/")
    return session_response(user)


@app.get("/admin/me/permissions")
def me(user=Depends(current_user)):
    return session_response(user)


@app.post("/auth/refresh", status_code=204)
def refresh(user=Depends(current_user)):
    return Response(status_code=204)


@app.post("/auth/logout", status_code=204)
def logout(request: Request):
    token = request.cookies.get(COOKIE, "")
    database.delete_record("admin_sessions", hashlib.sha256(token.encode()).hexdigest())
    response = Response(status_code=204)
    response.delete_cookie(COOKIE, path="/", httponly=True, samesite="strict")
    return response


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


class MapRegion(Input):
    bbox: list[float] = Field(min_length=4, max_length=4)
    min_zoom: int = Field(ge=0, le=22)
    max_zoom: int = Field(ge=0, le=22)

    @model_validator(mode="after")
    def validate_bounds(self):
        west, south, east, north = self.bbox
        if not (-180 <= west < east <= 180 and -90 <= south < north <= 90 and east - west <= 1 and north - south <= 1 and self.min_zoom <= self.max_zoom):
            raise ValueError("Invalid map bounds or zoom range.")
        return self


class ZoneInput(Input):
    name: str = Field(min_length=1, max_length=100)
    map_region: MapRegion
    is_active: bool = True


@app.get("/admin/zones")
def zones(user=Depends(require("poi.view"))):
    result = []
    for zone in database.fetch_all("zones", order_by="name"):
        zone["zone_id"] = zone.get("zone_id", str(zone["_id"]))
        zone["poi_count"] = database.count_zone_pois(zone["zone_id"])
        result.append(public(zone))
    return {"zones": result}


def save_zone(body, user, zone_id=None):
    with mutation_lock:
        if any(zone.get("name", "").casefold() == body.name.casefold() and zone.get("_id") != zone_id for zone in database.fetch_all("zones")):
            fail(409, "DUPLICATE_NAME", "Zone name already exists.")
        if zone_id:
            return public(update_record("zones", zone_id, body.model_dump(), user, "zone.update"))
        zone_id = identifier("zone")
        document = {"_id": zone_id, "zone_id": zone_id, **body.model_dump(), "created_at": now(), "updated_at": now()}
        database.insert_record("zones", document)
        audit(user, "zone.create", zone_id, None, document)
        return public(document)


@app.post("/admin/zones", status_code=201)
def create_zone(body: ZoneInput, user=Depends(require("system.manage_constants"))):
    return save_zone(body, user)


@app.put("/admin/zones/{zone_id}")
def edit_zone(zone_id: str, body: ZoneInput, user=Depends(require("system.manage_constants"))):
    return save_zone(body, user, zone_id)


class LanguageFields(Input):
    name: str = Field(min_length=1, max_length=100)
    native_name: str = Field(min_length=1, max_length=100)
    is_active: bool = False
    is_default: bool = False
    display_order: int = Field(ge=0, le=10000)


class LanguageCreate(LanguageFields):
    code: str = Field(pattern=r"^[a-z]{2,3}(-[A-Z]{2})?$")


@app.get("/admin/languages")
def languages(user=Depends(require("poi.view"))):
    return {"languages": [public({**document, "code": document["_id"]}) for document in database.fetch_all("languages", order_by="display_order")]}


def save_language(code, body, user, create=False):
    with mutation_lock:
        if create and database.fetch_one("languages", {"_id": code}):
            fail(409, "ALREADY_EXISTS", "Language already exists.")
        before = None if create else get_record("languages", code)
        fields = body.model_dump(exclude={"code"})
        if code == "vi" and not fields["is_active"]:
            fail(409, "SOURCE_LANGUAGE_REQUIRED", "Vietnamese must remain enabled.")
        if fields["is_default"] and not fields["is_active"]:
            fail(409, "DEFAULT_LANGUAGE_REQUIRED", "Default language must be active.")
        if before and before.get("is_default") and not fields["is_default"]:
            fail(409, "DEFAULT_LANGUAGE_REQUIRED", "Choose another default language first.")
        if not database.has_default_language() and not fields["is_default"]:
            fail(409, "DEFAULT_LANGUAGE_REQUIRED", "A default language is required.")
        if fields["is_default"]:
            database.clear_default_language_except(code)
        fields.update(code=code, updated_at=now())
        if create:
            database.insert_record("languages", {"_id": code, **fields, "created_at": now()})
        else:
            database.update_record("languages", code, fields)
        after = get_record("languages", code)
        audit(user, "language.create" if create else "language.update", code, before, after)
        return public(after)


@app.post("/admin/languages", status_code=201)
def create_language(body: LanguageCreate, user=Depends(require("system.manage_languages"))):
    return save_language(body.code, body, user, True)


@app.put("/admin/languages/{code}")
def edit_language(code: str, body: LanguageFields, user=Depends(require("system.manage_languages"))):
    return save_language(code, body, user)


class Location(Input):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class ContentInput(Input):
    name: str = Field(min_length=1, max_length=200)
    address: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=5000)
    text: str = Field(min_length=1, max_length=5000)


class PoiFields(Input):
    category: str = Field(min_length=1, max_length=50)
    zone_id: str = Field(min_length=1, max_length=100)
    location: Location
    geofence_radius_m: int = Field(ge=10, le=200, default=30)


class PoiCreate(PoiFields):
    content: dict[str, ContentInput]

    @model_validator(mode="after")
    def validate_content(self):
        if "vi" not in self.content or any(not re.fullmatch(r"[a-z]{2,3}(-[A-Z]{2})?", code) for code in self.content):
            raise ValueError("Vietnamese content and valid locale codes are required.")
        return self


def poi_public(document):
    document = dict(document)
    document["poi_id"] = document.get("poi_id", str(document["_id"]))
    document["status"] = "archived" if document.get("is_archived") else {"active": "published", "inactive": "unpublished"}.get(document.get("status"), document.get("status"))
    location = document.get("location", {})
    if location.get("type") == "Point":
        longitude, latitude = location["coordinates"]
        document["location"] = {"lat": latitude, "lng": longitude}
    document["content_status"] = {language["_id"]: "ready" if document.get("content", {}).get(language["_id"], {}).get("audio_url") else "missing" for language in database.fetch_all("languages", {"is_active": True})}
    return public(document)


def editable_poi(poi_id):
    document = get_record("pois", poi_id)
    if document.get("status") == "archived" or document.get("is_archived"):
        fail(409, "INVALID_STATE", "Archived POIs cannot be changed.")
    return document


def validate_zone(zone_id, existing=None):
    zone = get_record("zones", zone_id)
    if not zone.get("is_active") and (not existing or existing.get("zone_id") != zone_id):
        fail(422, "INACTIVE_ZONE", "Choose an active zone.")


def content_document(body, locale):
    return {**body.model_dump(), "audio_url": None, "audio_sha256": None, "audio_source": None, "is_edited": locale != "vi", "updated_at": now()}


@app.get("/admin/pois")
def pois(page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=100), user=Depends(require("poi.view"))):
    return {"items": [poi_public(document) for document in database.fetch_all("pois", order_by="updated_at", descending=True, limit=page_size, offset=(page - 1) * page_size)], "total": database.count("pois")}


@app.get("/admin/pois/{poi_id}")
def poi_detail(poi_id: str, user=Depends(require("poi.view"))):
    return poi_public(get_record("pois", poi_id))


@app.post("/admin/pois", status_code=201)
def create_poi(body: PoiCreate, user=Depends(require("poi.create"))):
    validate_zone(body.zone_id)
    for locale in body.content:
        if not database.fetch_one("languages", {"_id": locale, "is_active": True}):
            fail(422, "INVALID_LANGUAGE", "Choose an active language.")
    poi_id = identifier("poi")
    document = {"_id": poi_id, "poi_id": poi_id, **body.model_dump(exclude={"content", "location"}), "location": {"type": "Point", "coordinates": [body.location.lng, body.location.lat]}, "content": {locale: content_document(content, locale) for locale, content in body.content.items()}, "status": "active", "qr_code": None, "images": [], "created_at": now(), "updated_at": now(), "last_modified_by": user["user_id"]}
    database.insert_record("pois", document)
    audit(user, "poi.create", poi_id, None, document)
    return {"poi": poi_public(document), "tasks_created": []}


@app.put("/admin/pois/{poi_id}")
def edit_poi(poi_id: str, body: PoiFields, user=Depends(require("poi.edit"))):
    with mutation_lock:
        existing = editable_poi(poi_id)
        validate_zone(body.zone_id, existing)
        changes = {**body.model_dump(exclude={"location"}), "location": {"type": "Point", "coordinates": [body.location.lng, body.location.lat]}, "last_modified_by": user["user_id"]}
        return {"poi": poi_public(update_record("pois", poi_id, changes, user, "poi.update"))}


@app.put("/admin/pois/{poi_id}/content/{locale}")
def edit_content(poi_id: str, locale: str, body: ContentInput, user=Depends(require("poi.edit"))):
    with mutation_lock:
        existing = editable_poi(poi_id)
        if not re.fullmatch(r"[a-z]{2,3}(-[A-Z]{2})?", locale) or not database.fetch_one("languages", {"_id": locale, "is_active": True}):
            fail(422, "INVALID_LANGUAGE", "Choose an active language.")
        content = {**existing.get("content", {}).get(locale, {}), **body.model_dump(), "is_edited": locale != "vi", "updated_at": now()}
        return poi_public(update_record("pois", poi_id, {"content." + locale: content, "last_modified_by": user["user_id"]}, user, "poi.content_edit"))


class Reason(Input):
    reason: str = Field(min_length=5, max_length=500)


def transition(poi_id, status, user, reason=None):
    with mutation_lock:
        editable_poi(poi_id)
        return poi_public(update_record("pois", poi_id, {"status": "inactive" if status == "archived" else status, "is_archived": status == "archived", "unpublish_reason": reason, "last_modified_by": user["user_id"]}, user, "poi." + status))


@app.post("/admin/pois/{poi_id}/unpublish")
def unpublish(poi_id: str, body: Reason, user=Depends(require("content.unpublish"))):
    return transition(poi_id, "inactive", user, body.reason)


@app.post("/admin/pois/{poi_id}/republish")
def republish(poi_id: str, user=Depends(require("content.restore"))):
    return transition(poi_id, "active", user)


@app.delete("/admin/pois/{poi_id}")
def archive(poi_id: str, user=Depends(require("poi.delete"))):
    return transition(poi_id, "archived", user)


class QrInput(Input):
    regenerate: bool = False


@app.post("/admin/pois/{poi_id}/qr")
def assign_qr(poi_id: str, body: QrInput, user=Depends(require("poi.assign_qr"))):
    with mutation_lock:
        document = editable_poi(poi_id)
        if document.get("qr_code") and not body.regenerate:
            return poi_public(document)
        return poi_public(update_record("pois", poi_id, {"qr_code": secrets.token_hex(12), "last_modified_by": user["user_id"]}, user, "poi.assign_qr"))


@app.get("/admin/audit-logs")
def audit_logs(request: Request, page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=100), user=Depends(require("audit.view"))):
    filters = {}
    for parameter, field in [("actor", "actor_user_id"), ("action", "action"), ("target_id", "target_id")]:
        if request.query_params.get(parameter):
            filters[field] = request.query_params[parameter]
    for parameter, operator in [("from", "from"), ("to", "to")]:
        if request.query_params.get(parameter):
            try:
                value = datetime.fromisoformat(request.query_params[parameter].replace("Z", "+00:00"))
                if value.tzinfo is None:
                    raise ValueError()
            except ValueError:
                fail(422, "INVALID_DATE", "Use an ISO date with timezone.")
            filters[operator] = value
    return {"items": [public(document) for document in database.fetch_audit_logs(filters, page, page_size)], "total": database.count_audit_logs(filters)}

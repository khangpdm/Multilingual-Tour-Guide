import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.core.config import COOKIE, COOKIE_SECURE
from app.core.security import current_user, password_hash, password_matches, session_response, user_permissions
from app.core.state import login_attempts, mutation_lock
from app.core.utils import fail, now
from app.db.connection import database
from app.modules.auth.schemas import Login
from app.modules.auth.sessions import create_session, rotate_session, set_session_cookie, token_hash

router = APIRouter()
DUMMY_USER = {"password_hash": password_hash(secrets.token_urlsafe(32))}

@router.post("/auth/login")
def login(body: Login, request: Request, response: Response):
    username = body.username
    host = request.client.host if request.client else "unknown"
    keys = [((host, username), 5), ((host, None), 30)]
    with mutation_lock:
        cutoff = time.monotonic() - 60
        for old_key in list(login_attempts):
            while login_attempts[old_key] and login_attempts[old_key][0] < cutoff:
                login_attempts[old_key].popleft()
            if not login_attempts[old_key]:
                del login_attempts[old_key]
        for key, limit in keys:
            if len(login_attempts[key]) >= limit:
                raise HTTPException(429, {"code": "RATE_LIMITED", "message": "Try again in a minute."}, headers={"Retry-After": "60"})
        for key, limit in keys:
            login_attempts[key].append(time.monotonic())
    user = database.fetch_one("users", {"username": username})
    matches = password_matches(body.password, user or DUMMY_USER)
    if not user or not matches:
        fail(401, "INVALID_CREDENTIALS", "Invalid username or password.")
    if user.get("status") != "active":
        fail(403, "ACCOUNT_DEACTIVATED", "Account is not active.")
    if not user_permissions(user):
        fail(403, "ADMIN_ACCESS_DENIED", "This account has no Admin permissions.")
    token = create_session(user["_id"], request.cookies.get(COOKIE))
    user = {**user, "last_login_at": now()}
    set_session_cookie(response, token)
    return session_response(user)


@router.get("/admin/me/permissions")
def me(user=Depends(current_user)):
    return session_response(user)


@router.post("/auth/refresh", status_code=204)
def refresh(request: Request, user=Depends(current_user)):
    token = rotate_session(request.cookies[COOKIE], user["_id"])
    if not token:
        fail(401, "UNAUTHENTICATED", "The session expired or was already renewed. Please sign in.")
    response = Response(status_code=204)
    set_session_cookie(response, token)
    return response


@router.post("/auth/logout", status_code=204)
def logout(request: Request):
    token = request.cookies.get(COOKIE, "")
    if token:
        database.delete_record("admin_sessions", token_hash(token))
    response = Response(status_code=204)
    response.delete_cookie(COOKIE, path="/", httponly=True, samesite="strict", secure=COOKIE_SECURE)
    return response

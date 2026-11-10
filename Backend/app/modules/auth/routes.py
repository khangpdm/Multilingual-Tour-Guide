import hashlib
import secrets
import time
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.core.config import COOKIE
from app.core.security import current_user, password_matches, require, session_response
from app.core.state import login_attempts, mutation_lock
from app.core.utils import fail, now
from app.db.connection import database
from app.modules.auth.schemas import Login

router = APIRouter()
@router.post("/auth/login")
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


@router.get("/admin/me/permissions")
def me(user=Depends(current_user)):
    return session_response(user)


@router.post("/auth/refresh", status_code=204)
def refresh(user=Depends(current_user)):
    return Response(status_code=204)


@router.post("/auth/logout", status_code=204)
def logout(request: Request):
    token = request.cookies.get(COOKIE, "")
    database.delete_record("admin_sessions", hashlib.sha256(token.encode()).hexdigest())
    response = Response(status_code=204)
    response.delete_cookie(COOKIE, path="/", httponly=True, samesite="strict")
    return response

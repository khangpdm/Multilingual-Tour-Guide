import hashlib
import time

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response

from app.core.config import COOKIE, COOKIE_SECURE
from app.core.security import current_user, session_response
from app.core.state import login_attempts, mutation_lock
from app.core.utils import fail
from app.db.connection import database
from app.modules.auth.schemas import EmailInput, EmailLogin, ResetPassword, VerifyMfa
from app.modules.auth.service import login_email, request_password_reset, reset_password, verify_mfa
from app.modules.auth.sessions import rotate_session, set_session_cookie, token_hash

router = APIRouter()


def rate_limit(request, scope, identity=""):
    host = request.client.host if request.client else "unknown"
    identity = hashlib.sha256(identity.encode()).hexdigest()
    keys = [((scope, host, identity), 10), (("auth", host), 60)]
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
        if len(login_attempts) >= 10000:
            raise HTTPException(429, {"code": "RATE_LIMITED", "message": "Try again in a minute."}, headers={"Retry-After": "60"})
        for key, limit in keys:
            login_attempts[key].append(time.monotonic())


def login_response(result, response):
    if result.get("mfa_required"):
        return result
    user = database.fetch_one("users", {"_id": result["user_id"]})
    payload = session_response(user)
    set_session_cookie(response, result["session_token"])
    return payload


@router.post("/auth/login")
def login(body: EmailLogin, request: Request, response: Response):
    rate_limit(request, "login", body.email)
    return login_response(login_email(body.email, body.password, request.cookies.get(COOKIE)), response)


@router.post("/auth/mfa/verify")
def confirm_mfa(body: VerifyMfa, request: Request, response: Response):
    rate_limit(request, "mfa", body.challenge_token)
    return login_response(verify_mfa(body.challenge_token, body.code, request.cookies.get(COOKIE)), response)


@router.post("/auth/forgot-password")
def forgot_password(body: EmailInput, request: Request, background_tasks: BackgroundTasks):
    rate_limit(request, "forgot", body.email)
    background_tasks.add_task(request_password_reset, body.email)
    return {"message": "Nếu email hợp lệ, hướng dẫn đặt lại mật khẩu sẽ được gửi."}


@router.post("/auth/reset-password", status_code=204)
def confirm_reset(body: ResetPassword, request: Request):
    rate_limit(request, "reset", body.token)
    reset_password(body.token, body.password)
    response = Response(status_code=204)
    response.delete_cookie(COOKIE, path="/", httponly=True, samesite="strict", secure=COOKIE_SECURE)
    return response


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
        with database.connection() as connection, connection.cursor() as cursor:
            cursor.execute("DELETE FROM admin_sessions WHERE token_hash=%s", (token_hash(token),))
            cursor.execute("DELETE FROM auth_session_assurance WHERE token_hash=%s", (token_hash(token),))
    response = Response(status_code=204)
    response.delete_cookie(COOKIE, path="/", httponly=True, samesite="strict", secure=COOKIE_SECURE)
    return response

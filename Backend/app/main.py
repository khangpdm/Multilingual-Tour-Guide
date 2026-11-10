from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.errors import install_exception_handlers
from app.core.config import ORIGINS
from app.core.lifecycle import lifespan
from app.modules.audit.routes import router as audit_router
from app.modules.auth.routes import router as auth_router
from app.modules.languages.routes import router as languages_router
from app.modules.pois.routes import router as pois_router
from app.modules.system.routes import router as system_router
from app.modules.zones.routes import router as zones_router
from app.modules.media.routes import router as media_router
from app.modules.audio.routes import router as audio_router
from app.modules.offline.routes import router as offline_router

app = FastAPI(title="Tour Guide Local Admin API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_credentials=True, allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Content-Type"])
install_exception_handlers(app)


@app.middleware("http")
async def protect_writes(request: Request, call_next):
    if request.method in {"POST", "PUT", "DELETE", "PATCH"}:
        if request.headers.get("origin") not in ORIGINS:
            return JSONResponse({"error": {"code": "INVALID_ORIGIN", "message": "Nguồn gửi yêu cầu không được phép. Vui lòng mở đúng địa chỉ trang quản trị."}}, status_code=403)
        length = request.headers.get("content-length", "0")
        limit = 16 * 1024 * 1024 if request.headers.get("content-type", "").startswith("multipart/form-data") else 131072
        if not length.isdigit() or int(length) > limit:
            return JSONResponse({"error": {"code": "BODY_TOO_LARGE", "message": "Dữ liệu gửi lên vượt quá dung lượng cho phép."}}, status_code=413)
    return await call_next(request)


@app.middleware("http")
async def protect_auth_cache(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/auth/") or request.url.path == "/admin/me/permissions":
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"] = "no-cache"
    return response

app.include_router(system_router)
app.include_router(auth_router)
app.include_router(zones_router)
app.include_router(languages_router)
app.include_router(pois_router)
app.include_router(audit_router)
app.include_router(media_router)
app.include_router(audio_router)
app.include_router(offline_router)

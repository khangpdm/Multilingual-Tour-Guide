import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from db.sql import lifespan
from api.routes.health import router as health_router
from api.routes.languages import router as languages_router
from api.routes.pois import router as pois_router
from api.routes.telemetry import router as telemetry_router
from api.routes.offline_packs import OfflinePackAPIError, router as offline_packs_router

import os

app = FastAPI(
    title="Tourism API",
    version="0.1",
    lifespan=lifespan
)

os.makedirs("static/images", exist_ok=True)
os.makedirs("static/audio", exist_ok=True)

app.mount("/images", StaticFiles(directory="static/images"), name="images")
app.mount("/audio", StaticFiles(directory="static/audio"), name="audio")

app.include_router(health_router)
app.include_router(languages_router)
app.include_router(pois_router)
app.include_router(telemetry_router)
app.include_router(offline_packs_router)


@app.exception_handler(OfflinePackAPIError)
async def offline_pack_error_handler(_request, exc: OfflinePackAPIError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )

@app.get("/")
async def root():
    return {
        "message": "Tourism API is running",
        "docs": "/docs",
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

import uvicorn
from fastapi import FastAPI
from db.mongo import lifespan
from api.routes.health import router as health_router
from api.routes.languages import router as languages_router
from api.routes.pois import router as pois_router

app = FastAPI(
    title="Tourism API",
    version="0.1",
    lifespan=lifespan
)

app.include_router(health_router)
app.include_router(languages_router)
app.include_router(pois_router)

@app.get("/")
async def root():
    return {
        "message": "Tourism API is running",
        "docs": "/docs",
    }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
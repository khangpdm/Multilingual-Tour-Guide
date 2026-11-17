from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import install_exception_handlers
from app.core.config import MOBILE_ORIGINS
from app.db.connection import database
from app.modules.mobile.routes import router

app = FastAPI(title='Tour Guide Public Mobile API', docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(CORSMiddleware, allow_origins=MOBILE_ORIGINS, allow_methods=['GET', 'POST'], allow_headers=['Content-Type', 'If-None-Match', 'X-Device-Id'])
install_exception_handlers(app)
app.include_router(router)


@app.get('/health')
def health():
    database.command('ping')
    return {'status': 'ok', 'surface': 'mobile-public-only'}

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pymysql import MySQLError

from app.db.mysql_store import DuplicateRecordError


def install_exception_handlers(app: FastAPI):
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
from fastapi import FastAPI
from starlette.exceptions import HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pymysql import MySQLError

from app.db.mysql_store import DuplicateRecordError
from app.core.messages import localize_messages, validation_detail


def install_exception_handlers(app: FastAPI):
    @app.exception_handler(HTTPException)
    async def http_error(request, error):
        detail = error.detail if isinstance(error.detail, dict) else {"code": "HTTP_ERROR", "message": str(error.detail)}
        return JSONResponse({"error": localize_messages(detail)}, status_code=error.status_code, headers=error.headers)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, error):
        return JSONResponse({"error": {"code": "VALIDATION_ERROR", "message": "Dữ liệu nhập chưa hợp lệ.", "details": [validation_detail(item) for item in error.errors()]}}, status_code=422)

    @app.exception_handler(DuplicateRecordError)
    async def duplicate(request, error):
        return JSONResponse({"error": {"code": "ALREADY_EXISTS", "message": "Dữ liệu này đã tồn tại."}}, status_code=409)

    @app.exception_handler(MySQLError)
    async def database_error(request, error):
        return JSONResponse({"error": {"code": "DATABASE_UNAVAILABLE", "message": "Không thể kết nối cơ sở dữ liệu. Vui lòng kiểm tra cấu hình và dịch vụ MySQL."}}, status_code=503)

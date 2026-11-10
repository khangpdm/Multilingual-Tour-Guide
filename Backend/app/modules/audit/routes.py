from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request

from app.core.security import require
from app.core.utils import fail, public
from app.db.connection import database

router = APIRouter()
@router.get("/admin/audit-logs")
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

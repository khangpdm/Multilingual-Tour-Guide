from fastapi import APIRouter, Depends

from app.core.state import mutation_lock
from app.core.utils import audit, fail, get_record, now, public
from app.core.security import require
from app.db.connection import database
from app.modules.languages.schemas import LanguageCreate, LanguageFields

router = APIRouter()
@router.get("/admin/languages")
def languages(user=Depends(require("poi.view"))):
    return {"languages": [public({**document, "code": document["_id"]}) for document in database.fetch_all("languages", order_by="display_order")]}


def save_language(code, body, user, create=False):
    with mutation_lock:
        if create and database.fetch_one("languages", {"_id": code}):
            fail(409, "ALREADY_EXISTS", "Language already exists.")
        before = None if create else get_record("languages", code)
        fields = body.model_dump(exclude={"code"})
        if code == "vi" and not fields["is_active"]:
            fail(409, "SOURCE_LANGUAGE_REQUIRED", "Vietnamese must remain enabled.")
        if fields["is_default"] and not fields["is_active"]:
            fail(409, "DEFAULT_LANGUAGE_REQUIRED", "Default language must be active.")
        if before and before.get("is_default") and not fields["is_default"]:
            fail(409, "DEFAULT_LANGUAGE_REQUIRED", "Choose another default language first.")
        if not database.has_default_language() and not fields["is_default"]:
            fail(409, "DEFAULT_LANGUAGE_REQUIRED", "A default language is required.")
        if fields["is_default"]:
            database.clear_default_language_except(code)
        fields.update(code=code, updated_at=now())
        if create:
            database.insert_record("languages", {"_id": code, **fields, "created_at": now()})
        else:
            database.update_record("languages", code, fields)
        after = get_record("languages", code)
        audit(user, "language.create" if create else "language.update", code, before, after)
        return public(after)


@router.post("/admin/languages", status_code=201)
def create_language(body: LanguageCreate, user=Depends(require("system.manage_languages"))):
    return save_language(body.code, body, user, True)


@router.put("/admin/languages/{code}")
def edit_language(code: str, body: LanguageFields, user=Depends(require("system.manage_languages"))):
    return save_language(code, body, user)

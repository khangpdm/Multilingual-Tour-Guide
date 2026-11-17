from fastapi import APIRouter, BackgroundTasks, Depends

from app.core.state import mutation_lock
from app.core.utils import audit, fail, get_record, now, public
from app.core.security import require
from app.db.connection import database
from app.modules.languages.schemas import LanguageCreate, LanguageFields, LanguagePatch
from app.schemas.base import validate_input
from app.modules.audio.queue import enqueue

router = APIRouter()
@router.get("/admin/languages")
def languages(user=Depends(require("poi.view"))):
    return {"languages": [public({**document, "code": document["_id"]}) for document in database.fetch_all("languages", order_by="display_order")]}


def save_language(code, body, user, background, create=False):
    with mutation_lock, database.transaction():
        with database.connection() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT code FROM languages ORDER BY code FOR UPDATE")
        if create and database.fetch_one("languages", {"_id": code}):
            fail(409, "ALREADY_EXISTS", "Language already exists.")
        before = None if create else get_record("languages", code)
        fields = body.model_dump(exclude={"code"}, exclude_unset=not create)
        fields = validate_input(LanguageFields, {**({key: value for key, value in before.items() if key in LanguageFields.model_fields} if before else {}), **fields}).model_dump()
        if code == "vi" and not fields["is_active"]:
            fail(409, "SOURCE_LANGUAGE_REQUIRED", "Vietnamese must remain enabled.")
        if code == "en" and not fields["is_active"]:
            fail(409, "DEFAULT_AUDIO_LANGUAGE_REQUIRED", "English must remain enabled for default audio.")
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
        tasks = []
        if fields["is_active"] and (not before or not before.get("is_active")):
            for poi in database.fetch_all("pois", {"status": "active", "is_archived": False}):
                database.lock_poi(poi["poi_id"])
                tasks.extend(enqueue(get_record("pois", poi["poi_id"]), [code], user, background))
        if not fields["is_active"]:
            with database.connection() as connection, connection.cursor() as cursor:
                cursor.execute("UPDATE audio_tasks SET state='CANCELLED',finished_at=UTC_TIMESTAMP(3) WHERE language_code=%s AND state IN ('QUEUED','PROCESSING')", (code,))
        return public({**after, "tasks_created": tasks})


@router.post("/admin/languages", status_code=201)
def create_language(body: LanguageCreate, background: BackgroundTasks, user=Depends(require("system.manage_languages"))):
    return save_language(body.code, body, user, background, True)


@router.put("/admin/languages/{code}")
def edit_language(code: str, body: LanguagePatch, background: BackgroundTasks, user=Depends(require("system.manage_languages"))):
    return save_language(code, body, user, background)

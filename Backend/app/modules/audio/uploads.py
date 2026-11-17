from fastapi import APIRouter, Depends, File, UploadFile

from app.core.security import require
from app.core.state import mutation_lock
from app.core.utils import fail, now, update_record
from app.db.connection import database
from app.modules.audio.storage import AUDIO_LIMIT, checked_mp3, store_audio_bytes
from app.modules.pois.routes import editable_poi, poi_public
from app.modules.pois.versioning import expected_version

router = APIRouter()


@router.post("/admin/pois/{poi_id}/content/{locale}/audio")
async def upload_audio(
    poi_id: str,
    locale: str,
    file: UploadFile = File(...),
    version=Depends(expected_version),
    user=Depends(require("poi.edit")),
):
    try:
        data = checked_mp3(await file.read(AUDIO_LIMIT + 1))
    finally:
        await file.close()

    with mutation_lock, database.transaction():
        poi = editable_poi(poi_id, version)
        content = poi.get("content", {}).get(locale)

        language = database.fetch_one("languages", {"_id": locale})
        if not content or not language or not language.get("is_active"):
            fail(
                422,
                "INVALID_LANGUAGE",
                "Save content for an active language first.",
            )

        url, checksum = store_audio_bytes(data)
        with database.connection() as connection, connection.cursor() as cursor:
            cursor.execute("UPDATE audio_tasks SET state='CANCELLED',finished_at=UTC_TIMESTAMP(3) WHERE poi_id=%s AND language_code=%s AND state IN ('QUEUED','PROCESSING')", (poi_id, locale))

        updated_content = {
            **content,
            "audio_url": url,
            "audio_sha256": checksum,
            "audio_source": "UPLOADED",
            "updated_at": now(),
        }

        return poi_public(
            update_record(
                "pois",
                poi_id,
                {
                    f"content.{locale}": updated_content,
                    "last_modified_by": user["user_id"],
                },
                user,
                "poi.audio_upload",
            )
        )

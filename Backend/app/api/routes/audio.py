from fastapi import HTTPException, APIRouter, Request, Response, Header, Query, status
from fastapi.responses import FileResponse
from services.audio_service import resolve_safe_path
from api.schemas.schemas import SynthesizeRequest
from pathlib import Path
from services.pois_service import get_active_languages
import uuid
import json
from typing import Optional
import hashlib

router = APIRouter(prefix="/audio", tags=["Audio Management"])

AUDIO_ROOT_DIR = Path("/home/khangpham/Documents/Voice-Travel/Multilingual-Tour-Guide/Backend/static/audio")

@router.post("/synthesize", status_code=202)
async def request_audio_synthesize(
    payload: SynthesizeRequest,
    request: Request,
    x_device_id: str = Header(..., alias="X-Device-Id")
):
    db_pool = request.app.state.db_pool

    try:
        async with db_pool.acquire() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute(
                    "SELECT status FROM poi WHERE id = %s", 
                    (payload.poi_id,)
                )
                poi_row = await cursor.fetchone()
                if not poi_row or poi_row[0] != 'active':
                    raise HTTPException(status_code=404, detail="POI_NOT_FOUND")

                active_languages = await get_active_languages(db_pool)
                if payload.target_locale not in active_languages:
                    raise HTTPException(status_code=422, detail="LANGUAGE_NOT_ACTIVE")

                await cursor.execute(
                    """
                    SELECT audio_url, audio_sha256 FROM poi_content 
                    WHERE poi_id = %s AND language_code = %s
                    """,
                    (payload.poi_id, payload.target_locale)
                )
                content_row = await cursor.fetchone()
                
                if content_row and content_row[0]:
                    return {
                        "status": "ready",
                        "audio_url": content_row[0],
                        "audio_sha256": content_row[1]
                    }

                await cursor.execute(
                    """
                    SELECT id, state FROM audio_tasks 
                    WHERE poi_id = %s AND language_code = %s AND state IN ('QUEUED', 'PROCESSING')
                    LIMIT 1
                    """,
                    (payload.poi_id, payload.target_locale)
                )
                task_row = await cursor.fetchone()

                if task_row:
                    task_id, task_state = task_row[0], task_row[1]
                    if task_state == 'QUEUED':
                        await cursor.execute(
                            """
                            UPDATE audio_tasks 
                            SET options = JSON_SET(COALESCE(options, JSON_OBJECT()), '$.priority', 1) 
                            WHERE id = %s AND state = 'QUEUED'
                            """,
                            (task_id,)
                        )
                        await conn.commit()
                else:
                    task_id = str(uuid.uuid4())
                    initial_options = json.dumps({"retranslate": False, "replace_uploaded_audio": False, "priority": 1})
                    
                    await cursor.execute(
                        """
                        INSERT INTO audio_tasks (id, poi_id, language_code, state, progress, retry_count, options, created_at)
                        VALUES (%s, %s, %s, 'QUEUED', 0, 0, %s, NOW())
                        """,
                        (task_id, payload.poi_id, payload.target_locale, initial_options)
                    )
                    await conn.commit()

                return Response(
                    status_code=status.HTTP_202_ACCEPTED,
                    content=json.dumps({
                        "task_id": task_id,
                        "status": "queued",
                        "poll_after_ms": 1500
                    }),
                    media_type="application/json"
                )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database error: {str(e)}")

@router.get("/tasks/{task_id}")
async def get_audio_task_status(task_id: str, request: Request):
    db_pool = request.app.state.db_pool

    try:
        async with db_pool.acquire() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute(
                    """
                    SELECT
                    t.id, t.state, t.progress, c.audio_url, c.audio_sha256
                    FROM audio_tasks t
                    LEFT JOIN poi_content c ON t.poi_id = c.poi_id AND t.language_code = c.language_code
                    WHERE t.id = %s
                    """,
                    (task_id,)
                )
                row = await cursor.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="TASK_NOT_FOUND")

                task_state = row[1].lower()
                
                response_data = {
                    "task_id": row[0],
                    "status": task_state,
                    "progress": row[2],
                    "audio_url": row[3] if task_state == "completed" else None,
                    "audio_sha256": row[4] if task_state == "completed" else None
                }
                return response_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail="Database error")

@router.get("/{poi_id}/{locale}.mp3")
async def serve_audio_file(
    poi_id: str,
    locale: str,
    request: Request,
    if_none_match: Optional[str]=Header(default=None, alias="If-None-Match")
):
    relative_path = f"{poi_id}/{locale}.mp3"
    try:
        safe_path = resolve_safe_path(AUDIO_ROOT_DIR, relative_path)
    except HTTPException:
        raise HTTPException(404, "Audio file not found")

    if not safe_path.exists() or not safe_path.is_file():
        raise HTTPException(404, "Audio file not found")

    file_bytes = safe_path.read_bytes()
    file_sha256 = hashlib.sha256(file_bytes).hexdigest()
    etag = f'"{file_sha256}"'

    headers = {
        "ETag": etag,
        "Cache-Control": "public, no-cache"
    }

    if if_none_match == etag:
        return Response(status_code=304, headers=headers)

    return FileResponse(
        path=safe_path, 
        media_type="audio/mpeg", 
        headers=headers
    )
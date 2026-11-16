from deep_translator import MyMemoryTranslator
import edge_tts
from pathlib import Path
import asyncio
from fastapi import HTTPException
import tempfile
import os 
import hashlib
import random
import json

AUDIO_ROOT_DIR = Path("/home/khangpham/Documents/Voice-Travel/Multilingual-Tour-Guide/Backend/static/audio")
MY_MEMORY_CODES = {
    "en": "en-GB",
    "vi": "vi-VN",
    "ja": "ja-JP",
    "ko": "ko-KR",
    "zh": "zh-CN",
    "th": "th-TH",
    "fr": "fr-FR",
    "de": "de-DE",
    "es": "es-ES",
    "pt": "pt-PT",
    "id": "id-ID",
    "ru": "ru-RU",
    "ar": "ar-SA",
    "hi": "hi-IN",
}

class TranslationError(Exception):
    def __init__(self, message: str, retry_count: int = 0):
        super().__init__(message)
        self.retry_count = retry_count


async def translate_with_retry(
    text: str,
    source: str,
    target: str,
    max_retries: int = 3
) -> tuple[str, int]:

    translator = MyMemoryTranslator(
        source=MY_MEMORY_CODES.get(source, source),
        target=MY_MEMORY_CODES.get(target, target)
    )

    for attempt in range(max_retries + 1):
        try:
            result = await asyncio.to_thread(
                translator.translate,
                text
            )

            if not result:
                raise RuntimeError("Google Translate trả về kết quả rỗng")

            return result, attempt

        except Exception as exc:
            error_message = str(exc).lower()

            transient_errors = (
                "too many requests",
                "server error",
                "429",
                "rate limit",
                "timed out",
                "timeout",
                "connection",
            )

            is_transient = any(
                keyword in error_message
                for keyword in transient_errors
            )

            if not is_transient or attempt >= max_retries:
                raise TranslationError(
                    str(exc),
                    retry_count=attempt
                ) from exc

            delay = (3 * (2 ** attempt)) + random.uniform(0, 1)

            print(
                f"[!] Google Translate lỗi tạm thời. "
                f"Thử lại lần {attempt + 1}/{max_retries} "
                f"sau {delay:.1f}s. Lỗi: {exc}"
            )

            await asyncio.sleep(delay)

    raise TranslationError("Không thể dịch nội dung")

async def process_audio_tasks_loop(db_pool):
    print("[*] Audio Background Worker đã khởi động...")
    while True:
        try:
            async with db_pool.acquire() as conn:
                async with conn.cursor() as cursor:
                    await cursor.execute(
                        """
                        SELECT id, poi_id, language_code, options, retry_count
                        FROM audio_tasks 
                        WHERE state = 'QUEUED' 
                        ORDER BY COALESCE(JSON_EXTRACT(options, '$.priority'), 0) DESC, created_at ASC 
                        LIMIT 1
                        """
                    )
                    task = await cursor.fetchone()

                    if not task:
                        await asyncio.sleep(2)
                        continue

                    task_id = task[0]
                    poi_id = task[1]
                    language_code = task[2]
                    options_json = task[3]
                    retry_count = task[4]

                    await cursor.execute(
                        """
                        UPDATE audio_tasks
                        SET state = 'PROCESSING', progress=10, started_at=NOW()
                        WHERE id = %s
                        """,
                        (task_id,)
                    )
                    await conn.commit()

                    try:
                        await cursor.execute(
                            """
                            SELECT name, text FROM poi_content
                            WHERE poi_id = %s AND language_code='en'
                            """,
                            (poi_id,)
                        )
                        base_content = await cursor.fetchone()
                        if not base_content:
                            raise RuntimeError("Không tìm thấy nội dung để sinh audio")

                        poi_name, poi_text = base_content[0], base_content[1]
                        full_text_to_speak = f"{poi_name}. {poi_text}"

                        # Parse options của task
                        if isinstance(options_json, dict):
                            options = options_json
                        elif isinstance(options_json, (str, bytes)):
                            options = json.loads(options_json)
                        else:
                            options = {}

                        replace_uploaded_audio = options.get(
                            "replace_uploaded_audio",
                            False
                        )

                        # Kiểm tra bản ghi nội dung của ngôn ngữ đích
                        await cursor.execute(
                            """
                            SELECT audio_source
                            FROM poi_content
                            WHERE poi_id = %s
                            AND language_code = %s
                            """,
                            (poi_id, language_code)
                        )

                        target_content = await cursor.fetchone()

                        if not target_content:
                            raise RuntimeError(
                                f"Không tìm thấy poi_content cho ngôn ngữ {language_code}"
                            )

                        if (
                            target_content[0] == "UPLOADED"
                            and not replace_uploaded_audio
                        ):
                            raise RuntimeError(
                                "Audio đã được upload thủ công, không được phép ghi đè"
                            )

                        text_to_tts = full_text_to_speak
                        translation_retries = 0

                        if language_code != 'en':
                            text_to_tts, translation_retries = await translate_with_retry(
                                text=full_text_to_speak,
                                source="en",
                                target=language_code,
                                max_retries=3
                            )

                            print(
                                f"[+] Dịch thành công POI {poi_id} "
                                f"({language_code}), số lần retry: {translation_retries}"
                            )

                        await cursor.execute(
                            """
                            UPDATE audio_tasks
                            SET progress = 40,
                                retry_count = retry_count + %s
                            WHERE id = %s
                            """,
                            (translation_retries, task_id)
                        )
                        await conn.commit()

                        voice_map = {
                            "en": "en-US-AriaNeural",
                            "vi": "vi-VN-HoaiMyNeural",
                            "ja": "ja-JP-NanamiNeural",
                            "ko": "ko-KR-SunHiNeural",
                            "zh": "zh-CN-XiaoxiaoNeural",
                            "th": "th-TH-PremwadeeNeural",
                            "fr": "fr-FR-DeniseNeural",
                            "de": "de-DE-KatjaNeural",
                            "es": "es-ES-ElviraNeural",
                            "id": "id-ID-GadisNeural",
                            "ru": "ru-RU-SvetlanaNeural",
                            "pt": "pt-BR-FranciscaNeural",
                            "it": "it-IT-ElsaNeural",
                            "hi": "hi-IN-SwaraNeural",
                            "ar": "ar-SA-ZariyahNeural",
                            "tr": "tr-TR-EmelNeural",
                        }

                        voice = voice_map.get(language_code)

                        if not voice:
                            raise RuntimeError(
                                f"Chưa cấu hình giọng đọc TTS cho ngôn ngữ {language_code}"
                        )
                        poi_audio_dir = AUDIO_ROOT_DIR / str(poi_id)
                        poi_audio_dir.mkdir(parents=True, exist_ok=True)
                        final_file_path = poi_audio_dir / f"{language_code}.mp3"

                        fd, temp_path_str = tempfile.mkstemp(dir = poi_audio_dir, suffix=".tmp")
                        os.close(fd)
                        temp_path = Path(temp_path_str)

                        communicate = edge_tts.Communicate(text_to_tts, voice)
                        await communicate.save(str(temp_path))

                        await cursor.execute("UPDATE audio_tasks SET progress = 80 WHERE id = %s", (task_id,))
                        await conn.commit()

                        file_bytes = temp_path.read_bytes()
                        audio_sha256 = hashlib.sha256(file_bytes).hexdigest()

                        temp_path.replace(final_file_path)

                        audio_url = f"/audio/{poi_id}/{language_code}.mp3"

                        await cursor.execute(
                            """
                            UPDATE poi_content
                            SET
                                audio_url = %s,
                                audio_sha256 = %s,
                                audio_source = 'TTS',
                                updated_at = NOW()
                            WHERE poi_id = %s
                            AND language_code = %s
                            AND (
                                audio_source IS NULL
                                OR audio_source = 'TTS'
                                OR %s = TRUE
                            )
                            """,
                            (
                                audio_url,
                                audio_sha256,
                                poi_id,
                                language_code,
                                replace_uploaded_audio
                            )
                        )

                        if cursor.rowcount == 0:
                            raise RuntimeError(
                                f"Không cập nhật được audio cho POI {poi_id}, "
                                f"language {language_code}. "
                                "Có thể audio đã được upload hoặc bản ghi không tồn tại."
                            )

                        await cursor.execute(
                            """
                            UPDATE audio_tasks 
                            SET state = 'COMPLETED', progress = 100, finished_at = NOW() 
                            WHERE id = %s
                            """,
                            (task_id,)
                        )
                        await conn.commit()
                        print(f"[+] Hoàn thành audio task cho POI {poi_id} ({language_code})")

                    except Exception as inner_err:
                        retries_used = getattr(inner_err, "retry_count", 0)

                        print(
                            f"[-] Lỗi xử lý task {task_id}: {str(inner_err)}"
                        )

                        await cursor.execute(
                            """
                            UPDATE audio_tasks
                            SET
                                state = 'FAILED',
                                retry_count = retry_count + %s,
                                error = %s,
                                finished_at = NOW()
                            WHERE id = %s
                            """,
                            (
                                retries_used,
                                str(inner_err)[:255],
                                task_id
                            )
                        )

                        await conn.commit()

        except Exception as outer_err:
            print(f"[-] Lỗi kết nối vòng lặp worker: {str(outer_err)}")
            await asyncio.sleep(5)
from deep_translator import GoogleTranslator
import edge_tts
from pathlib import Path
import asyncio
from fastapi import HTTPException
import tempfile
import os 
import hashlib

AUDIO_ROOT_DIR = Path("/home/khangpham/Documents/Voice-Travel/Multilingual-Tour-Guide/Backend/static/audio")

async def process_audio_tasks_loop(db_pool):
    print("[*] Audio Background Worker đã khởi động...")
    while True:
        try:
            async with db_pool.acquire() as conn:
                async with conn.cursor() as cursor:
                    await cursor.execute(
                        """
                        SELECT id, poi_id, language_code, options 
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

                    task_id, poi_id, language_code, options_json = task[0], task[1], task[2], task[3]

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

                        text_to_tts = full_text_to_speak
                        if language_code != 'en':
                            translator = GoogleTranslator(source='en', target=language_code)
                            text_to_tts = translator.translate(full_text_to_speak)

                        await cursor.execute("UPDATE audio_tasks SET progress = 40 WHERE id = %s", (task_id,))
                        await conn.commit()

                        voice_map = {
                            "ja": "ja-JP-NanamiNeural",
                            "en": "en-US-AriaNeural",
                            "vi": "vi-VN-HoangMaiNeural"
                        }
                        voice = voice_map.get(language_code, "en-US-AriaNeural")

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
                            SET audio_url = %s, audio_sha256 = %s, updated_at = NOW()
                            WHERE poi_id = %s AND language_code = %s
                            """,
                            (audio_url, audio_sha256, poi_id, language_code)
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
                        print(errMsg := f"[-] Lỗi xử lý task {task_id}: {str(inner_err)}")

                        await cursor.execute(
                            """
                            UPDATE audio_tasks 
                            SET state = 'FAILED', error = %s, finished_at = NOW() 
                            WHERE id = %s
                            """,
                            (str(inner_err)[:255], task_id)
                        )
                        await conn.commit()

        except Exception as outer_err:
            print(f"[-] Lỗi kết nối vòng lặp worker: {str(outer_err)}")
            await asyncio.sleep(5)
from contextlib import asynccontextmanager
import asyncio

import asyncmy
from fastapi import FastAPI

from app.core.config import settings
from app.services.audio_worker import process_audio_tasks_loop


MYSQL_HOST = settings.get("MYSQL_HOST", "127.0.0.1")
MYSQL_PORT = int(settings.get("MYSQL_PORT", 3306))
MYSQL_USER = settings.get("MYSQL_USER", "root")
MYSQL_PASSWORD = settings.get("MYSQL_PASSWORD", "")
MYSQL_DB_NAME = settings.get("MYSQL_DB_NAME", "tourism_db")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Khởi tạo connection pool
    pool = await asyncmy.create_pool(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        db=MYSQL_DB_NAME,
        autocommit=True,
        charset="utf8mb4",
    )

    # 2. Kiểm tra kết nối MySQL
    try:
        async with pool.acquire() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute("SELECT 1")

        print("Connected to MySQL successfully!")

    except Exception:
        pool.close()
        await pool.wait_closed()
        raise

    app.state.db_pool = pool

    # 3. Khởi chạy Audio Background Worker
    worker_task = asyncio.create_task(
        process_audio_tasks_loop(pool),
        name="audio-background-worker",
    )

    app.state.audio_worker_task = worker_task

    print("Audio Background Worker task đã được khởi chạy.")

    try:
        yield

    finally:
        # 4. Dừng worker trước khi đóng connection pool
        worker_task.cancel()

        try:
            await worker_task
        except asyncio.CancelledError:
            print("Audio Background Worker đã dừng.")

        # 5. Đóng connection pool
        pool.close()
        await pool.wait_closed()

        print("Closed MySQL connection pool.")
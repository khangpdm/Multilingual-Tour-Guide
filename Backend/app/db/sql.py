from contextlib import asynccontextmanager

import asyncmy
from fastapi import FastAPI
from app.core.config import settings

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

    try:
        async with pool.acquire() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute("SELECT 1")
        print(" Connected to MySQL successfully!")
    except Exception as e:
        print(f" Failed to connect to MySQL: {e}")
        raise e

    app.state.db_pool = pool

    try:
        yield
    finally:
        pool.close()
        await pool.wait_closed()
        print(" Closed MySQL connection pool.")

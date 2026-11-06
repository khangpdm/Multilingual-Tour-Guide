import os
from contextlib import asynccontextmanager

import asyncmy
from dotenv import load_dotenv
from fastapi import FastAPI

load_dotenv()

# Cấu hình kết nối MySQL từ biến môi trường (hoặc giá trị mặc định)
MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", 3306))
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
MYSQL_DB_NAME = os.getenv("MYSQL_DB_NAME", "tourism_db")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi tạo connection pool sử dụng asyncmy cho MySQL 8.4 (InnoDB)
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
        # Kiểm tra kết nối nhanh bằng cách ping pool/connection
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
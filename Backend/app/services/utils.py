from datetime import datetime, timezone

def utc_now():
    return datetime.now(timezone.utc)

async def get_active_languages(pool) -> set[str]:
    async with pool.acquire() as conn:
        async with conn.cursor() as cursor:
            await cursor.execute("SELECT code FROM languages WHERE is_active = 1")
            rows = await cursor.fetchall()
            return {row[0] for row in rows}
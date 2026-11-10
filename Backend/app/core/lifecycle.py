from contextlib import asynccontextmanager

from app.db.connection import database
from app.modules.auth.seed import seed_admin


@asynccontextmanager
async def lifespan(app):
    database.command("ping")
    database.initialize()
    with database.connection() as connection, connection.cursor() as cursor:
        cursor.execute("UPDATE audio_tasks SET state='FAILED',error='Server restarted. Retry this task.',finished_at=UTC_TIMESTAMP(3) WHERE state IN ('QUEUED','PROCESSING')")
        cursor.execute("UPDATE offline_pack_releases SET status='failed',error='Server restarted. Create a new version.' WHERE status='building'")
        cursor.execute("UPDATE offline_pack_languages SET status='failed' WHERE status='building'")
    seed_admin()
    yield
    database.close()

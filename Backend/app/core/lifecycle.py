from contextlib import asynccontextmanager

from app.db.connection import database
from app.modules.auth.seed import seed_admin
from app.modules.auth.service import initialize_auth


@asynccontextmanager
async def lifespan(app):
    database.command("ping")
    database.initialize()
    initialize_auth()
    with database.connection() as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE audio_tasks
            SET
                state = 'QUEUED',
                progress = 0,
                started_at = NULL,
                finished_at = NULL,
                error = NULL
            WHERE state = 'PROCESSING'
            """
        )
        cursor.execute("UPDATE offline_pack_releases SET status='failed',error='Server restarted. Create a new version.' WHERE status='building'")
        cursor.execute("UPDATE offline_pack_languages SET status='failed' WHERE status='building'")
    seed_admin()
    yield
    database.close()

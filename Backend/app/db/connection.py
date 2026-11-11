from app.core.config import settings
from app.db.mysql_store import MySQLDatabase

database = MySQLDatabase(settings)
import argparse

from app.core.config import settings
from app.core.security import password_hash
from app.core.utils import identifier
from app.db.connection import database
from app.modules.auth.schemas import Login


def seed_admin(reset_password=False):
    credentials = Login(username=settings.get("ADMIN_USERNAME", "admin"), password=settings.get("ADMIN_PASSWORD", "Admin123!"))
    email = settings.get("ADMIN_EMAIL", "admin@tour.local").strip().lower()
    password = credentials.password
    with database.connection() as connection, connection.cursor() as cursor:
        connection.begin()
        try:
            cursor.execute("SELECT id,username,role_id,status FROM users WHERE username=%s FOR UPDATE", (credentials.username,))
            user = cursor.fetchone()
            assigned = False
            if not user:
                cursor.execute("SELECT id,username,role_id,status FROM users WHERE email=%s FOR UPDATE", (email,))
                user = cursor.fetchone()
                if user and user["username"]:
                    raise RuntimeError("ADMIN_EMAIL already belongs to a different username. Choose a distinct seed email.")
                assigned = bool(user)
            if user and user["role_id"] != "local_admin":
                raise RuntimeError("Seed account conflicts with a non-local-admin account; no account was changed.")
            if not user or reset_password:
                if len(password) < 8 or len(password.encode()) > 72 or password == "replace_with_a_unique_password":
                    raise RuntimeError("ADMIN_PASSWORD must contain at least 8 characters and at most 72 UTF-8 bytes.")
                hashed = password_hash(password)
            if not user:
                user_id = identifier("user")
                cursor.execute("INSERT INTO users (id,username,email,password_hash,full_name,role_id,status) VALUES (%s,%s,%s,%s,'Local Admin','local_admin','ACTIVE')", (user_id, credentials.username, email, hashed))
            else:
                user_id = user["id"]
                if assigned:
                    cursor.execute("UPDATE users SET username=%s WHERE id=%s", (credentials.username, user_id))
                if reset_password:
                    cursor.execute("UPDATE users SET password_hash=%s,password_salt=NULL WHERE id=%s", (hashed, user_id))
                    cursor.execute("DELETE FROM admin_sessions WHERE user_id=%s", (user_id,))
            connection.commit()
            return {"created": not bool(user), "username_assigned": assigned, "password_reset": bool(user) and reset_password, "username": credentials.username}
        except Exception:
            connection.rollback()
            raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create the local Admin seed without overwriting an existing password.")
    parser.add_argument("--reset-password", action="store_true", help="Explicitly reset only the configured local Admin password and revoke its sessions.")
    arguments = parser.parse_args()
    database.initialize()
    print(seed_admin(reset_password=arguments.reset_password))

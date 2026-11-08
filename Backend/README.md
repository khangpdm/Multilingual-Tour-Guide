# Local Admin API

The Admin dashboard uses MySQL in `tourism_db` and the relational tables in `app/db/admin_mysql.sql`. The schema is idempotent and creates only missing tables; it does not drop existing data. This is a local Admin API, not the complete production API specification.

## Configure

Copy `Backend/.env.example` to `Backend/.env`. Set `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DB_NAME` (default `tourism_db`). Use a dedicated MySQL application account with privileges only on this database; do not put credentials in frontend variables or commit `.env`. Set a unique `ADMIN_PASSWORD` of at least 16 characters.

Install and run from PowerShell:

```powershell
python -m venv Backend/.venv
Backend/.venv/Scripts/python.exe -m pip install -r Backend/requirements.txt
cd Backend
.venv/Scripts/python.exe -m uvicorn admin_api.main:app --host 127.0.0.1 --port 8000
```

On startup the API checks MySQL, applies the safe `CREATE TABLE IF NOT EXISTS` schema and additive Admin columns, creates the local Admin role/permissions, and creates the configured Admin user if it does not already exist. Existing passwords are not overwritten. Passwords use bcrypt; seeded bcrypt accounts are accepted.

Run the UI separately from `Frontend/Admin` using `npm run dev`. Keep `VITE_API_BASE_URL` empty to use the Vite proxy. API health: `http://127.0.0.1:8000/health`. Bind to loopback for local development.

## Data and limitations

Admin data maps to `users`, `roles`, `permissions`, `role_permissions`, `languages`, `zone`, `poi`, `poi_content`, and `audit_logs`. Hashed sessions use `admin_sessions`. POI coordinates use MySQL `POINT SRID 4326`; localized content is stored per language. Archive metadata uses additive columns so existing rows are retained.

The local role exposes only the currently implemented Admin endpoints. Media upload, translation/TTS, advanced user and role management, analytics, SSE, and offline packs remain unimplemented. Cookies are HttpOnly and SameSite=Strict; local HTTP means Secure is disabled. Do not expose this setup publicly; production needs HTTPS, secure cookies, centralized rate limiting, and transactionally coupled audit writes.

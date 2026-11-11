# Local Admin API

The Admin dashboard uses MySQL in `tourism_db` and the relational tables in `app/db/admin_mysql.sql`. The schema is idempotent and creates only missing tables; it does not drop existing data. This backend serves both the local Admin API and the Mobile API; it is not the complete production API specification.

## Configure

Copy `Backend/.env.example` to `Backend/.env`. Set `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DB_NAME` (default `tourism_db`). Use a dedicated MySQL application account with privileges only on this database; do not put credentials in frontend variables or commit `.env`. The requested development seed is `ADMIN_USERNAME=admin` and `ADMIN_PASSWORD=Admin123!`. This is a public, local-demo credential: replace it with a unique strong password before deploying or sharing the server. `ADMIN_EMAIL` remains contact/audit data, not a login identifier.

Install and run from PowerShell:

```powershell
python -m venv Backend/.venv
Backend/.venv/Scripts/python.exe -m pip install -r Backend/requirements.txt
cd Backend
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

On startup the API checks MySQL, applies the safe `CREATE TABLE IF NOT EXISTS` schema and additive Admin columns, creates the system Super Admin role/permissions, and seeds the configured username. The migration adds a nullable, case-insensitively unique `users.username`; existing email data is retained. An existing local Admin matching `ADMIN_EMAIL` without a username is assigned `ADMIN_USERNAME`, preserving its password and status. Unrelated old users are not renamed; provision a unique username for them before username login. Conflicting usernames, emails or unrelated roles fail without taking over another account. Passwords use bcrypt.

Normal startup and repeated seeding never reset an existing password. To explicitly set the configured Admin password and invalidate that account's existing sessions, run from `Backend`:

```powershell
.venv/Scripts/python.exe -m app.modules.auth.seed --reset-password
```

Omit `--reset-password` to create or assign the seed username without changing an existing password. The command reads `ADMIN_USERNAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the backend environment. It never reactivates a disabled account. Only the matching legacy local Admin seed is promoted to Super Admin; unrelated accounts retain their roles.

Run the UI separately from `Frontend/Admin` using `npm run dev`. Keep `VITE_API_BASE_URL` empty to use the Vite proxy. API health: `http://127.0.0.1:8000/health`. Bind to loopback for local development.

## Data and limitations

Admin data maps to `users`, `roles`, `permissions`, `role_permissions`, `languages`, `zone`, `poi`, `poi_content`, and `audit_logs`. Hashed sessions use `admin_sessions`. POI coordinates use MySQL `POINT SRID 4326`; localized content is stored per language. Archive metadata uses additive columns so existing rows are retained.

The local role exposes only implemented endpoints. Account invitations, role assignment and custom role permissions are implemented. Analytics and automatic translation remain outside this local API. Audio progress is polled, not SSE. Cookies are HttpOnly and SameSite=Strict; local HTTP defaults to Secure disabled. Set `ADMIN_COOKIE_SECURE=true` only when serving through HTTPS. Do not expose this setup publicly; production also needs centralized rate limiting and transactionally coupled audit writes.

## Admin authentication and authorization

- `POST /auth/login` accepts `username` and `password`, for example `{"username":"admin","password":"Admin123!"}`. Email login is no longer accepted. Username is trimmed and lowercased, starts with a letter or digit, and contains 3-50 ASCII letters, digits, dots, underscores or hyphens. Password whitespace is significant. Seed passwords need at least 8 characters and at most 72 UTF-8 bytes. Existing bcrypt and legacy scrypt hashes remain supported; invalid hashes and oversized bcrypt inputs fail authentication instead of raising server errors.
- Login requires an active account, a role with level greater than zero, and at least one implemented Admin permission. Only the reserved system `super_admin` role at level 3 receives all implemented permissions; other roles use their explicitly assigned grants. `/admin/me/permissions` returns a safe user profile, effective permissions and capabilities; capabilities describe server features, not authorization grants.
- Each request reloads account status and role permissions. Revoking a permission immediately blocks its endpoint. Removing all Admin permissions blocks the Admin session with 403. Startup preserves revoked grants for ordinary roles. It maintains all implemented grants for Super Admin; management permissions are not automatically added to legacy local admins.
- Tokens are random; only SHA-256 token hashes are stored in `admin_sessions`. Login replaces the session cookie presented by that browser and records last login in one transaction. It does not sign out other browsers. Expired sessions are removed during login.
- `POST /auth/refresh` rotates a still-valid token, invalidates the old token and renews both database expiry and the cookie. Concurrent refreshes of one token have one winner. An expired session cannot be refreshed: sign in again. There is no separate long-lived refresh token. Default expiry is eight hours; configure `ADMIN_SESSION_TTL_SECONDS` between 300 and 86400. The existing frontend does not periodically refresh, so an expired browser session still requires login.
- `POST /auth/logout` is idempotent: it removes the presented token and clears its cookie. Other browser sessions remain valid. Auth responses and permission responses use `Cache-Control: no-store`.
- Writes require an allowed `Origin` from `ADMIN_ORIGINS`; API clients must send it along with cookies. Use the same hostname consistently (do not mix localhost and 127.0.0.1). For local curl testing use a cookie jar with `-c` on login/refresh and `-b` on later requests.
- Login is limited to five attempts per client IP plus normalized username and thirty attempts per client IP per minute, including successful attempts; 429 includes `Retry-After`. Missing users undergo a dummy password check. This in-memory limiter assumes a single worker and a trusted proxy configuration; do not trust arbitrary forwarded client IP headers.

Expected errors: 401 for invalid credentials or missing/expired session, 403 for an inactive account, no Admin access, missing endpoint permission or disallowed Origin, 422 for invalid input, 429 for throttling, and 503 for database failure. Public registration and password reset remain unavailable.

## Super Admin and account management

The configured seed account is now a system `super_admin` (level 3), with every
implemented backend permission. Startup upgrades the matching legacy `local_admin`
seed only when both its configured username/email identity and role match; it
preserves its password and status, and revokes old sessions on promotion. Other
local admins are not promoted. Restart the backend and sign in again after this
upgrade. Identity conflicts fail rather than taking over another account.

Super Admin permissions cannot be edited. Custom roles have level 1 or 2;
non-Super Admin actors may manage only lower-level roles/accounts and cannot
grant permissions they do not hold. Self-demotion, self-deactivation and removal
of the last active Super Admin are rejected. Role/account mutations and their
audit records commit together; role changes and deactivation revoke sessions.

- `GET /admin/roles`: roles and effective permission lists.
- `POST /admin/roles`: `{role_id, name, level, permission_ids}`.
- `POST /admin/roles/{role_id}/permissions`: `{grant, revoke}`.
- `GET /admin/users`: paginated Admin accounts, without password/token hashes.
- `POST /admin/users/invite`: `{email, full_name, role_id}`.
- `PUT /admin/users/{user_id}`: `{full_name, role_id?}`; email is immutable.
- `PUT /admin/users/{user_id}/deactivate`: deactivate and revoke sessions/invitation.
- `POST /auth/activate`: `{token, password, full_name}`; one-use, seven-day invitation.

Local invitations are delivered manually, not by email: the invite response
contains a generated `username` and relative `activation_path`, displayed once
in the Admin dialog. Share both privately with the intended recipient. The
database stores only the invitation token hash; audit records never contain the
token or password. After activation the recipient signs in with that username.
Responses under `/auth` and `/admin` are not cacheable.

`capabilities.permission_catalog` lists implemented permissions for the live UI.
Super Admin has all of these; planned analytics/heatmap and other unavailable
APIs are not advertised as functional. Demo permissions remain separate.

## Content, media and publication

New POIs start as `unpublished`. The canonical category codes are `heritage`, `museum`, `religion`, `architecture`, `park`, and `food`. Existing category values are preserved in storage; select a supported value before saving or publishing an old record.

Localized fields are `name`, `address`, `description` (short card summary, preserved from existing data), `introduction` (new long article), and `text` (spoken script). Startup adds `poi_content.introduction` and `poi.cover_image` without rewriting old descriptions. Fill the new article field explicitly for old POIs. Images remain an ordered array; `cover_image` must refer to one of them. Vietnamese name, summary, article, script, audio with checksum, a cover image and an active zone are required on explicit publication. Other locales may be incomplete until selected for an offline pack. Editing an already published POI does not automatically withdraw it; review/unpublish it when changing content.

Uploads use `python-multipart`, Pillow and mutagen to validate actual file contents. Images are decoded, resized to at most 1600px and re-encoded as JPEG; MP3s are limited to 15 MB and images to 5 MB. `ADMIN_MEDIA_ROOT` defaults to `Backend/media` (ignored by Git). Keep this directory on persistent storage and back it up with MySQL. Removing an image unlinks it from the POI, rather than deleting files used by historical snapshots. Orphan-file retention/cleanup is a separate operational task.

Media endpoints under `/admin/assets` require `poi.view`. QR PNG generation is at `/admin/pois/{id}/qr/image`; the dashboard displays it, downloads it and prints a name card. It encodes the exact assigned QR token, not an invented Enduser deep link.

## Audio provider and tasks

MP3 upload and playback work without a TTS provider. To enable generation, configure `TTS_ENDPOINT` to a trusted adapter that accepts `POST {"text": "...", "language": "vi"}` and returns raw MP3 bytes. HTTPS is required except for loopback development; redirects are rejected. Optional `TTS_API_KEY` is sent as a Bearer token. Never expose it via Vite. The adapter, provider account and any charges are not provisioned by this code. The endpoint receives the selected narration script; configure it only for an approved provider.

Tasks persist in `audio_tasks`, support retry/cancel and protect uploaded MP3s unless overwrite is explicitly selected. A result is discarded if the script/audio changes while synthesis runs. Editing a script clears its stale TTS audio, but preserves uploaded audio for manual review. Translation is manual: generate speech from each locale's saved script.

## Offline releases

`/admin/offline-packs` lists and creates versioned releases per zone. Each release contains a common ZIP (POI metadata and images) and one ZIP per selected language (localized content and MP3). Every ZIP contains `manifest.json`; asset paths in the manifest are relative to that ZIP. This is content/audio packaging, not offline map-tile packaging.

Creation snapshots published, non-archived POIs, validates all selected locales and accepts only files uploaded to this Admin storage (no remote URL fetching). Each part is limited to 250 MB. SHA-256, size, version, build status and source fingerprint are persisted. A ready version can be published only while its source fingerprint is unchanged and all ZIP checksums match. Publication transactionally supersedes the previous release for the same zone. Withdraw marks a release superseded; previously downloaded files cannot be erased remotely. After changing or unpublishing source POIs, manually withdraw old releases and build a new version. Historical ZIPs remain immutable.

Startup adds `source_hash`, `error`, and `poi_count` to existing release tables. Permissions are `offline.view`, `offline.manage`, and `offline.publish`; users also need `poi.view` for zone/language lookups in the UI.

## Local worker limits

Run exactly one Uvicorn worker for this local implementation, without reload during active builds. Audio/pack work uses in-process background tasks and a process-local mutation lock. On restart, interrupted jobs become failed and must be retried or rebuilt. Multi-process deployment needs a durable queue and cross-process locking; do not scale this implementation as-is. Public Enduser content/manifest endpoints remain outside this local implementation.

## Mobile API integration

The same FastAPI app also serves the Mobile API routes: `GET /languages`, `/poi/poi/load-all`, telemetry endpoints, and static media at `/images` and `/audio`. These routes use the async MySQL pool configured by `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DB_NAME`; Admin endpoints use the synchronous MySQL store with the same database settings. Both lifecycles start and stop with the app. Keep the mobile schema and Admin schema provisioned in the same database; startup does not drop existing data.

The mobile media directories are `Backend/static/images` and `Backend/static/audio`. Admin uploads use `ADMIN_MEDIA_ROOT` (default `Backend/media`).


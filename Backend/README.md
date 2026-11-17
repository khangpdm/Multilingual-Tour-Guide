# Local Admin API

## Mobile integration

See `MOBILE_INTEGRATION.md` for the develop merge, shared POI/media endpoints,
real mobile offline downloads, QR playback and device acceptance steps.
Use `start_local.py --mobile-lan` to expose only the public mobile API on port
8002 while keeping Admin and TTS loopback-only. Do not bind the local-bypass
Admin API to a public/LAN interface.

## PRD v2 update (2026-11-17)

The current POI/Zone/language contract and migration notes are in
`PRD_V2_IMPLEMENTATION.md`. They supersede the older POI publication workflow
described below. Read the backup and configuration notes before restarting
against an existing database.

The Admin dashboard uses MySQL in `tourism_db` and the relational tables in `app/db/admin_mysql.sql`. The schema is idempotent and creates only missing tables; it does not drop existing data. This is a local Admin API, not the complete production API specification.

## Configure

Copy `Backend/.env.example` to `Backend/.env`. Set `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DB_NAME` (default `tourism_db`). Use a dedicated MySQL application account with privileges only on this database; do not put credentials in frontend variables or commit `.env`. The requested development seed is `ADMIN_USERNAME=admin` and `ADMIN_PASSWORD=Admin123!`. This is a public, local-demo credential: replace it with a unique strong password before deploying or sharing the server. `ADMIN_EMAIL` is now the email login identifier. Configure SMTP and the trusted frontend URL using `.env.auth.example`; see `HUY_H1_PRD_V2.md` before restarting. Super Admin requires emailed OTP; missing SMTP does not bypass MFA.

Install and run from PowerShell:

```powershell
python -m venv Backend/.venv
Backend/.venv/Scripts/python.exe -m pip install -r Backend/requirements.txt
cd Backend
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

On startup the API checks MySQL, applies the safe `CREATE TABLE IF NOT EXISTS` schema and additive Admin columns, creates the system Super Admin role/permissions, and seeds the configured username. The migration adds a nullable, case-insensitively unique `users.username`; existing email data is retained. An existing local Admin matching `ADMIN_EMAIL` without a username is assigned `ADMIN_USERNAME`, preserving its password and status. Existing users now log in with their email; usernames remain only for seed/backward-compatible account identity. The additive auth migration creates three authentication tables without changing existing passwords. Old sessions require fresh login. Conflicting usernames, emails or unrelated roles fail without taking over another account. Passwords use bcrypt.

Normal startup and repeated seeding never reset an existing password. To explicitly set the configured Admin password and invalidate that account's existing sessions, run from `Backend`:

```powershell
.venv/Scripts/python.exe -m app.modules.auth.seed --reset-password
```

Omit `--reset-password` to create or assign the seed username without changing an existing password. The command reads `ADMIN_USERNAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the backend environment. It never reactivates a disabled account. Only the matching legacy local Admin seed is promoted to Super Admin; unrelated accounts retain their roles.

Run the UI separately from `Frontend/Admin` using `npm run dev`. Keep `VITE_API_BASE_URL` empty to use the Vite proxy. API health: `http://127.0.0.1:8000/health`. Bind to loopback for local development.

## Data and limitations

### Local Windows TTS (English and Vietnamese)

This optional service uses installed Windows speech voices, converts PCM to
128 kbps MP3 with LAME, and implements the existing backend speech-provider
contract. It does not send scripts to a cloud provider or require a cloud key.
Only languages with an installed Windows voice are supported; no substitute
language is silently selected. This is a local development service, not a
production/distributed worker.

Install the optional dependencies from `Backend`:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-local-tts.txt
```

Set `TTS_ENDPOINT=http://127.0.0.1:8001/speech` and a random `TTS_API_KEY` in
`Backend/.env` (see `.env.tts.example`). Both servers read the same local secret;
restart both after changes. Never put this key in frontend variables or Git.
Start both backend and TTS with one command from the repository root:

```powershell
.\Backend\.venv\Scripts\python.exe .\Backend\start_local.py
```

Or from `Backend`, run `.\.venv\Scripts\python.exe start_local.py`.
Stop any previously started backend/TTS instances first. The launcher refuses
occupied ports rather than killing existing processes. It waits for authenticated
TTS health before starting the backend, keeps both servers in the current
terminal, and stops its own servers on Ctrl+C or if either server exits.
Keep this terminal open. The Admin frontend still runs separately.
To run only TTS, use `.\.venv\Scripts\python.exe -m uvicorn local_tts.server:app --host 127.0.0.1 --port 8001 --no-proxy-headers` from `Backend`.

The local TTS server requires this bearer secret and loopback requests, has
no CORS access for browser clients, limits scripts to 5000 characters, and
serializes synthesis. Keep it bound to loopback, with proxy headers disabled.
Authenticated GET `/health` lists installed voices. Windows PowerShell is
launched hidden with a process-only execution-policy override for the bundled
script; no persistent policy or registry changes are made.

Then restart the main backend and reload Admin. Create a POI or request audio
generation from its saved script. Earlier failed jobs remain in history and
can be retried if their script/audio fingerprint still matches. Existing uploaded
MP3 is protected unless the administrator explicitly allows replacement. For
an unambiguous test, create a separate POI rather than overwrite uploaded audio.

### Local development without email OTP

For loopback-only development, set `APP_ENV=development` and
`ADMIN_LOCAL_MFA_BYPASS=true` in `Backend/.env`, then restart the backend.
Email/password validation, rate limits and account locks still apply. This
exception requires both a loopback client address and a localhost/loopback URL.
Local bypass sessions are not marked MFA-verified and are rejected when the
exception is disabled or the request is not local. The login audit records the
bypass. Password-reset email still requires SMTP.

Keep `ADMIN_LOCAL_MFA_BYPASS=false` (the default) in production. Do not expose
this development server through a tunnel or reverse proxy while bypass is on.
Before deployment, disable bypass, configure SMTP and use a strong password.

Admin data maps to `users`, `roles`, `permissions`, `role_permissions`, `languages`, `zone`, `poi`, `poi_content`, and `audit_logs`. Hashed sessions use `admin_sessions`. POI coordinates use MySQL `POINT SRID 4326`; localized content is stored per language. Archive metadata uses additive columns so existing rows are retained.

The local role exposes only implemented endpoints. Account invitations, role assignment and custom role permissions are implemented. Analytics and automatic translation remain outside this local API. Audio progress is polled, not SSE. Cookies are HttpOnly and SameSite=Strict; local HTTP defaults to Secure disabled. Set `ADMIN_COOKIE_SECURE=true` only when serving through HTTPS. Do not expose this setup publicly; production also needs centralized rate limiting and transactionally coupled audit writes.

## Admin authentication and authorization

- `POST /auth/login` accepts `{email,password}`. Email is normalized, password whitespace is significant. Ordinary Admins receive a session; Super Admin receives a five-minute MFA challenge and must call `POST /auth/mfa/verify` with `{challenge_token,code}` before a session is issued. Password creation/reset requires at least eight characters, letters and digits, and at most 72 UTF-8 bytes. Bcrypt and legacy scrypt verification remain supported.
- Login requires an active account, a role with level greater than zero, and at least one implemented Admin permission. Only the reserved system `super_admin` role at level 3 receives all implemented permissions; other roles use their explicitly assigned grants. `/admin/me/permissions` returns a safe user profile, effective permissions and capabilities; capabilities describe server features, not authorization grants.
- Each request reloads account status and role permissions. Revoking a permission immediately blocks its endpoint. Removing all Admin permissions blocks the Admin session with 403. Startup preserves revoked grants for ordinary roles. It maintains all implemented grants for Super Admin; management permissions are not automatically added to legacy local admins.
- Tokens are random; only SHA-256 token hashes are stored in `admin_sessions`. Login replaces the session cookie presented by that browser and records last login in one transaction. It does not sign out other browsers. Expired sessions are removed during login.
- `POST /auth/refresh` rotates a still-valid token, invalidates the old token and renews both database expiry and the cookie. Concurrent refreshes of one token have one winner. An expired session cannot be refreshed: sign in again. There is no separate long-lived refresh token. Default expiry is eight hours; configure `ADMIN_SESSION_TTL_SECONDS` between 300 and 86400. The existing frontend does not periodically refresh, so an expired browser session still requires login.
- `POST /auth/logout` is idempotent: it removes the presented token and clears its cookie. Other browser sessions remain valid. Auth responses and permission responses use `Cache-Control: no-store`.
- Writes require an allowed `Origin` from `ADMIN_ORIGINS`; API clients must send it along with cookies. Use the same hostname consistently (do not mix localhost and 127.0.0.1). For local curl testing use a cookie jar with `-c` on login/refresh and `-b` on later requests.
- Five consecutive incorrect passwords lock the account for fifteen minutes (configurable), persisted in MySQL. A supplementary single-process limiter allows ten attempts per endpoint/IP/hashed identity and sixty auth attempts per IP per minute; 429 includes `Retry-After`. Missing users undergo a dummy password check. See `HUY_H1_PRD_V2.md` for expiry, audit, reset and multi-worker deployment details.

Expected auth errors: 401 for invalid credentials/session/OTP, 403 for disabled accounts, missing permissions or disallowed Origin, 423 for temporary account lock, 400 for invalid reset links, 422 for invalid input, 429 for throttling, and 503 for unavailable MFA email/database. Password reset uses `POST /auth/forgot-password` and `POST /auth/reset-password`. Public registration remains unavailable.

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
token or password. After activation the recipient signs in with their email. Invitation email delivery remains outside the H1 scope; see the account-management limitations here.
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

Source fingerprints include the actual bytes of images and audio, not only their URLs. Builds verify each asset against its captured checksum and include an `asset_sha256` map in each ZIP manifest. Publishing and downloading also check ZIP integrity and the manifest release ID. Ready packs built before this fingerprint change must be rebuilt before publication; existing published ZIPs are not rewritten.

Startup adds `source_hash`, `error`, and `poi_count` to existing release tables. Permissions are `offline.view`, `offline.manage`, and `offline.publish`; users also need `poi.view` for zone/language lookups in the UI.

## Local worker limits

Run exactly one Uvicorn worker for this local implementation, without reload during active builds. Audio/pack work uses in-process background tasks and a process-local mutation lock. On restart, interrupted jobs become failed and must be retried or rebuilt. Multi-process deployment needs a durable queue and cross-process locking; do not scale this implementation as-is. Public Enduser content/manifest endpoints and mobile integration are intentionally not changed here.

## Huy backend verification

See [HUY_H1_PRD_V2.md](HUY_H1_PRD_V2.md) for the current H1 scope and rollout checklist. Audit snapshots and legacy audit responses omit nested secret fields. Audit date filters reject a start date after the end date. Audio retry rejects inactive languages and protected uploaded audio before scheduling work; queued tasks validate their source again before contacting TTS. Local test reports and disposable test data are not required for deployment.

# Local Admin API

This is a local-only FastAPI adapter for the existing Admin dashboard, not the
complete production API_SPEC implementation. It uses the MongoDB instance in
`../infra/mongodb`. It does not replace or merge the mobile API branch.

## Start

From the repository root (PowerShell):

```powershell
docker compose -f infra/mongodb/compose.yaml up -d --wait
python -m venv Backend/.venv
Backend/.venv/Scripts/python.exe -m pip install -r Backend/requirements.lock.txt
```

Copy Backend/.env.example to Backend/.env on a new machine and set a unique
ADMIN_PASSWORD (at least 16 characters). The current machine already has a
generated password. Never commit .env or expose it in a VITE variable.
Database credentials are loaded from infra/mongodb/.env. Process environment
variables override file settings. The default MongoDB database is tourism_db.

In terminal 1:

```powershell
cd Backend
.venv/Scripts/python.exe -m uvicorn admin_api.main:app --host 127.0.0.1 --port 8000
```

In terminal 2:

```powershell
cd Frontend/Admin
npm run dev
```

Open http://127.0.0.1:3000. Sign in with ADMIN_EMAIL and ADMIN_PASSWORD from
Backend/.env. Do not choose demo mode if you want persistent MongoDB data.
Leave VITE_API_BASE_URL unset/empty for Vite's same-origin development proxy.
No MongoDB password is sent to the frontend. The current local account email
is admin@tour.local. Existing user passwords are not overwritten on startup.

API health: http://127.0.0.1:8000/health
Interactive API docs: http://127.0.0.1:8000/docs
Write requests require an Origin matching ADMIN_ORIGINS, including API clients.
If using Swagger locally, add its origin explicitly to ADMIN_ORIGINS first.

## Implemented

- Login, logout, session lookup and permission checks against users/roles.
- Read/create/update zones and languages; Vietnamese and default-language guards.
- Read/create/update POIs, localized text, unpublish/republish, soft archive, QR.
- Audit entries for those writes, filtering and pagination (no export).
- Startup bootstrap of the local_admin account/role, session TTL and geo index.

The local role only exposes these features. Media uploads, translation/TTS,
advanced user/role administration, analytics, SSE and offline packs are not
implemented. The UI declares local limitations and disables media upload.
No fake successful jobs or analytics are returned.

## MongoDB compatibility

POI locations stay GeoJSON in MongoDB and become lat/lng in Admin responses.
Database active/inactive maps to Admin published/unpublished. Archiving writes
status=inactive with is_archived=true, so the mobile delta sync can see a removal;
Admin reads it as archived and rejects subsequent edits. Data is not hard-deleted.
The other branch's telemetry API still needs its published-vs-active query fixed
before fully sharing this database. Test fixtures remain explicitly labeled demo.

## Security and limits

Bind to loopback only. Passwords use salted scrypt; only hashes are stored in
MongoDB. Session tokens are random, stored hashed, expire after eight hours,
and use HttpOnly/SameSite=Strict cookies. Logout revokes the stored session.
The local /auth/refresh only checks an existing valid session; it does not extend
or revive an expired session. Log in again after expiry. No automatic login.
Cookies are not Secure because local development uses HTTP; do not deploy this
configuration publicly. Production needs HTTPS/Secure cookies, rotating refresh
sessions, shared rate limits and the full API specification.

Run one worker. This standalone MongoDB setup does not provide multi-document
transactions: business writes and audit writes are separate, and language default
switches are serialized only within this process. Production needs a replica set,
transactional writes, stronger concurrency controls and backup policy.
The requirements lock records versions validated on this machine.

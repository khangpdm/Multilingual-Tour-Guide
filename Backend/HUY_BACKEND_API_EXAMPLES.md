# Huy backend API verification examples

Historical local-assignment examples: the session rows below describe the old
username-login interface, not the current PRD-v2 auth API. For current email
login, mandatory Super Admin OTP, account lockout and password-reset requests,
use HUY_H1_PRD_V2.md and HUY_H1_PRD_V2_RESULT.json. H2-H4 examples remain relevant.

Verified locally on 2026-11-16 using FastAPI TestClient, real MySQL in an isolated
database, dedicated media and a deterministic loopback TTS HTTP adapter.
The assertions and cleanup outcome are recorded in
`HUY_BACKEND_INTEGRATION_RESULT.json`. IDs and credentials below are placeholders,
not real account details or literal runnable fixtures. Responses show selected
fields only. Error messages are localized; use the stable error code.

## Session and authorization

Writes require an Origin listed in `ADMIN_ORIGINS`. Authenticated requests need
the `tour_admin_session` cookie. Do not log or commit cookie values or passwords.

| Request | Input | Verified result |
| --- | --- | --- |
| POST /auth/login | `{"username":"<test-admin>","password":"<local-only-password>"}` | 200, user/permissions and HttpOnly session cookie; no password hash in response. |
| POST /auth/login | Incorrect password | 401 `INVALID_CREDENTIALS`. |
| POST /auth/refresh | Valid session cookie | 204 and rotated cookie; the previous token no longer authenticates. |
| GET /admin/me/permissions | Missing or expired cookie | 401 `UNAUTHENTICATED`. |
| GET /admin/audit-logs | Active account with only `poi.view` | 403 `FORBIDDEN`. |
| POST /auth/logout | Valid session cookie and allowed Origin | 204; token hash row deleted. |
| POST /auth/login | Sixth attempt for the same test username within a minute | 429 `RATE_LIMITED` and `Retry-After: 60`. |

## Audio upload and tasks

| Request | Input | Verified result |
| --- | --- | --- |
| POST /admin/pois/{poi_id}/content/vi/audio | Multipart field `file`, valid MP3 | 200, content has `audio_url`, matching `audio_sha256`, `audio_source: UPLOADED`; download bytes match. |
| Same upload endpoint | Empty file, non-MP3 bytes or file above 15 MiB | 422 `INVALID_AUDIO`. |
| Same upload endpoint | Nonexistent POI / inactive or absent locale | 404 / 422 respectively. |
| POST /admin/pois/{poi_id}/audio/regenerate | `{"locales":["en"]}` with no provider configured | 503 `TTS_NOT_CONFIGURED`. |
| Same regenerate endpoint | `{"locales":["en"]}` with loopback adapter | 200 with `tasks_created`; persisted task reaches COMPLETED and content source becomes TTS. |
| Same regenerate endpoint | Locale has uploaded MP3, overwrite not selected | 200 with empty `tasks_created` and a `skipped` entry; MP3 remains unchanged. |
| POST /admin/audio-tasks/{task_id}/cancel | Task is PROCESSING | 200; state remains CANCELLED after the blocked provider returns. |
| POST /admin/audio-tasks/{task_id}/retry | FAILED task and active locale | 200; task completes and `retry_count` increments. |
| Same retry endpoint | Inactive locale / protected uploaded MP3 | 422 `INVALID_LANGUAGE` / 409 `UPLOADED_AUDIO_PROTECTED`. |

Concurrent checks changed scripts or archived the POI while synthesis was
blocked. Changed-script tasks failed; archived-POI tasks were cancelled. Neither
case wrote the late provider result into content. The loopback adapter returned
synthetic MP3 frames; actual voice quality was not assessed.

## Offline packages

| Request | Input | Verified result |
| --- | --- | --- |
| POST /admin/offline-packs | `{"zone_id":"<fixture-zone>","locales":["vi","en"]}` | 201 with release `id`; background build persists ready state, version and checksums. |
| GET /admin/offline-packs/{release_id}/files/common | Ready release | 200 ZIP; SHA-256 matches MySQL and every `asset_sha256` entry matches archived bytes. |
| Same files endpoint with `vi` or `en` | Ready language pack | 200 ZIP with matching release ID and per-asset manifest hashes. |
| POST /admin/offline-packs/{release_id}/publish | Valid ready release, unchanged source | 200; new release published and previous published release superseded. |
| Same publish endpoint | Source content/image bytes changed | 409 `STALE_PACK`. |
| Same publish endpoint | ZIP bytes no longer match stored hash | 409 `PACK_MISSING`. |
| Same publish endpoint | Invalid ZIP with matching stored hash | 409 `PACK_INVALID`. |
| POST /admin/offline-packs/{release_id}/withdraw | Published release | 200; release becomes superseded. |
| POST /admin/offline-packs | Selected locale lacks audio / image file missing | 422; no valid release is created. |

## Audit and database summary

- `GET /admin/audit-logs?action=huy.secret_check&page_size=1`: 200 with one
  matching item and total 1. Nested credentials are absent in both persisted
  new audit snapshots and the API view of legacy snapshots.
- `GET /admin/audit-logs?from=2026-11-17T00:00:00Z&to=2026-11-16T00:00:00Z`:
  422 `INVALID_DATE` because the start date is after the end date.
- `GET /admin/database/summary`: 200 with `tables`; every reported table count
  matched an independent SQL COUNT query during verification.
- A new application lifespan converted persisted QUEUED/PROCESSING audio and
  building offline rows to failed states with explanatory errors. Retrying the
  interrupted audio and creating a fresh offline version succeeded afterward.

## Remaining manual acceptance

Nhat's upload-module handover, the joint demonstration and actual external TTS
compatibility/listening remain separate from this isolated automated run.
No production or shared application records were changed.

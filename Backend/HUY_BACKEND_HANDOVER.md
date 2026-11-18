# Huy backend verification and handover

H1 scope update: this report describes the earlier local assignment. The newer
PRD-v2 US4 implementation, rollout and verification are documented separately
in HUY_H1_PRD_V2.md; the old H1 result is not full PRD-v2 acceptance evidence.

Verification date: 2026-11-16. Scope: backend Admin H1-H4 only.

The existing implementation was inspected and focused fixes were applied.
After local credentials were supplied, real MySQL integration was verified in
an isolated disposable database. The configured `tourism_db` and existing media
were not written or migrated. This is local integration evidence, not final
approval of an external TTS provider or the joint handover with Nhat.

## Environment status

- A Python virtual environment was created at `Backend/.venv` using the locked
  backend dependencies. HTTP test tooling was installed only in that environment.
- The local MySQL service is running and TCP port 3306 is reachable.
- `Backend/.env` is now present and the configured MySQL authentication succeeds.
  Credentials were not printed, modified or added to Git.
- Each integration run overrode the database/media settings in memory, created
  a unique test database, and removed that database and its media after the run.
- The supplied environment has no TTS endpoint. Integration used a loopback HTTP
  adapter returning deterministic MP3 bytes, exercising real HTTP and task logic
  without sending text or API keys to an external service.

## Changes delivered

| Group | Change |
| --- | --- |
| H1 | Existing login, permission and session behavior checked with mocked storage and real MySQL; no auth feature rewrite. |
| H2 | Retry refuses inactive languages or protected uploaded MP3s before queuing. Queued jobs check language, source hashes and upload protection before calling the provider. |
| H3 | Source fingerprints cover image/audio bytes. Packing verifies exact snapshot bytes and records per-asset SHA-256 in the manifest. Publish/download validate ZIP integrity and manifest release identity. |
| H4 | Shared audit writing and audit reading remove nested credential fields, including legacy records in responses. Reversed date ranges return 422. Empty before/after objects are preserved. |

Offline HTTP URLs are unchanged. The new `asset_sha256` manifest field is additive.
Ready packs created with the old fingerprint need rebuilding before publication.
Historical published ZIP files are not modified. Audit redaction does not delete
old database records or attempt to detect secrets pasted into arbitrary text;
callers must never put raw credentials into descriptions or free-form messages.

## Executed verification

A temporary Python unittest harness ran 40 checks successfully using FastAPI
TestClient, mocked storage/provider calls and temporary ZIP files. The harness
does not constitute a new committed test suite or a real MySQL/TTS integration run.

| Area | Checks | Coverage |
| --- | ---: | --- |
| H1 and system | 14 | Password matching, login cookie and response privacy, wrong password, absent/expired session, inactive account, missing permission, invalid Origin, refresh/replayed refresh, logout, health success/database failure, summary counts. |
| H4 | 5 | Nested redaction without input mutation, sanitized writes, preserved empty snapshots, sanitized legacy responses, reversed dates. |
| H2 | 12 | Valid/invalid MP3, missing/unsafe provider configuration, protected/inactive retry, allowed retry scheduling, stale queued source, cancel, simulated success, cancel during generation, provider timeout privacy. |
| H3 | 9 | Valid ZIP, invalid ZIP despite matching hash, absent/invalid/wrong manifest, changed ZIP checksum, exact asset bytes and manifest checksums, changed asset during build, image fingerprint changes, stale publication rejection, publication transaction calls. |

Test tooling emitted an upstream TestClient deprecation warning; the checks passed.

### Real MySQL integration results

The final isolated integration run passed 115 assertions: 21 H1, 35 H2, 33 H3,
8 H4, 17 fixture preparation checks and 1 restart health check. These are
assertions in an integration scenario, not 115 independent test cases.
The complete sanitized list is in `HUY_BACKEND_INTEGRATION_RESULT.json`.

- H1: actual bcrypt password storage, hashed session tokens, refresh invalidating
  the old cookie, real expiry and logout, inactive/limited accounts, forbidden
  Origin, missing permissions and login rate limits.
- H2: real multipart upload, MP3 parsing, MySQL fields and matching downloaded
  bytes; empty/fake/oversized files, nonexistent POI and invalid locale rejected.
  Loopback TTS HTTP success/failure, retry, duplicate prevention and protection
  of uploaded audio passed. Cancelling, editing a script or archiving a POI
  during a blocked provider call prevented late audio writes.
- H3: common/vi/en ZIPs built with real files and persisted checksums; manifest
  asset hashes matched ZIP bytes. Real publication/replacement/withdrawal passed.
  Stale content, same-URL image changes, missing resources, incomplete locales,
  corrupted ZIPs and malformed ZIPs with a matching stored hash were rejected.
- H4: audit snapshots were checked in MySQL, filtered/paginated reads passed,
  legacy secret fields were hidden, and all summary counts matched SQL counts.
- Restart: a fresh application lifespan marked queued/processing audio and
  building releases/language packs failed with explanations. Subsequent audio
  retry and offline rebuild completed successfully. This exercises startup
  recovery against persisted rows; it is not an operating-system crash test.

The final test database and media directory were removed; database removal was
confirmed against INFORMATION_SCHEMA. No server, external TTS service, fixture
account or test database was left running. Real MySQL writes were exercised,
but concurrent multi-worker behavior and fault-injected transaction rollback
were not tested; the supported deployment remains one local worker.

## Isolated integration setup

1. Keep existing local configuration if one is added by another developer. If
   `.env` is absent, copy `.env.example` to `.env` and edit it locally.
2. Have a database administrator create a separate `tour_guide_huy_test` database
   and an authorized test user. Set `MYSQL_DB_NAME`, `MYSQL_USER` and
   `MYSQL_PASSWORD` in `.env`. Do not use or migrate the shared/production database.
3. Set `ADMIN_MEDIA_ROOT` to an absolute, dedicated test directory, for example
   `D:/Seminar/Multilingual-Tour-Guide/Backend/.logs/huy-media`. Use disposable
   fixtures only and do not point it at existing media.
4. Set a unique local `ADMIN_PASSWORD` of 8 or more characters and at most 72
   UTF-8 bytes. Choose a permitted `ADMIN_ORIGINS` value matching the API client.
   Never commit `.env` or send database credentials in a chat or screenshot.
5. Start from `Backend` with `.venv/Scripts/python.exe -m uvicorn app.main:app
   --host 127.0.0.1 --port 8000 --workers 1` (one command, one worker, no reload).
   Startup initializes schema and seeds the configured Admin, so verify the
   isolated database name before starting. Coordinate shared-schema changes with Nhat.
6. Confirm `GET /health` succeeds, then complete the following checklist using
   a cookie jar and the allowed Origin header for write requests.

## Acceptance checklist

- [x] H1 local integration: login, refresh invalidates the previous cookie, logout invalidates the
  session, expired session returns 401, missing permission returns 403. Use real
  session rows and test accounts; confirm login rate limits and cookie settings.
- [x] H4 local integration: mutate a fixture, inspect persisted audit rows and paginated/filter
  responses, compare summary counts to MySQL, and confirm no credentials appear.
- [ ] Upload handover: Nhat moves MP3 upload/validation from media into audio,
  preserving the URL/behavior; Huy registers the router and owns further fixes.
  This change intentionally does not edit Nhat's media, POI or MySQL adapter files.
- [x] H2 upload local integration: valid MP3, empty/fake/oversized file, invalid
  POI/locale and missing permission. URL/source/checksum persisted correctly and
  downloaded MP3 bytes matched the uploaded bytes. Human listening is separate.
- [x] H2 loopback integration: HTTP success/failure, duplicate tasks, cancel/retry,
  script changes and POI archival prevented invalid or late audio writes.
- [ ] H2 external provider: configure an approved endpoint, verify its actual
  request/response contract, timeout handling and narration quality by listening.
- [x] H3 fixture integration: use existing zone/language/POI APIs and the shared
  readiness function; inspect common/language ZIP manifests and SHA-256 values.
- [x] H3 local integration: reject missing content/resources, stale sources, changed image bytes,
  bad ZIPs and unauthorized users. Publish a new version, verify old-version
  replacement, withdraw and download with real database transactions.
- [x] Startup recovery: persisted interrupted audio/offline rows become failed
  with explanations; subsequent retry/rebuild succeeds.
- [ ] Run the joint demo: login, zone/language, POI/content/images, audio,
  readiness/publication, QR, offline build/publication, ZIP download/checksum.
- [x] Record sanitized request/response examples and results for H1-H4 in
  `HUY_BACKEND_API_EXAMPLES.md` and `HUY_BACKEND_INTEGRATION_RESULT.json`.
- [ ] Final handover: agree any SQL/migrations with Nhat, confirm fixture inputs
  together, and sign off the joint demo. No new schema migration was needed in
  this integration run.

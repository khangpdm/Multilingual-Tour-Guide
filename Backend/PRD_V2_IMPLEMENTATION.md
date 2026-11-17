# Backend Admin - PRD v2 contract

## Scope and precedence

The November 17, 2026 decision makes PRD.docx v2 the business authority for the
reviewed Admin features. API_SPEC.md remains a reference only where it does not
conflict. MySQL remains the database. This change does not merge the separate
Huy authentication branch or implement Mobile/Enduser, analytics, automatic
translation, distributed queues, or PMTiles.

## POI lifecycle and content

- Public Admin DTO status is only `active` or `archived`. Creation immediately
  activates the POI; there is no approval/publication step. The old POI
  unpublish/republish endpoints are removed. Offline pack publication is separate
  and remains supported.
- English `content.en.name` and `content.en.text` are mandatory for creation.
  Other locales are manually authored; enabling a locale never invents a
  translation. Description, introduction and narration remain separate fields.
- Coordinates must lie inside the active Zone. `boundary` is an optional closed,
  non-self-intersecting list of `[longitude, latitude]` pairs inside `map_region.bbox`.
  Existing Zones without polygons use their bbox as the boundary. Changing a
  boundary cannot exclude an active POI.
- `priority` is an integer from 0 to 10000. Geofence radius is global: GET/PUT
  `/admin/settings/geofence`, body `{"radius_m":45}`. Writes require
  `system.manage_constants`, update every affected POI and create history/audit.
  A POI editor cannot override an individual radius.
- The list supports `q`, `zone_id`, `category`, `status`, `sort`, `page`, and
  `page_size`, returning `items`, `total`, `page`, and `page_size`. Search covers
  all authored locale names. Sort names prefer English, then Vietnamese.
- `content_status` distinguishes ready/pending/failed/missing; detail includes
  unfinished tasks and `default_audio_missing`. Readiness is informative, not a
  publication gate. Offline uses the shared backend readiness check.

## Versions and concurrent editing

Every POI content/media/status/global-radius write stores the old document in
`poi_versions` and increments `content_version`, including worker audio results.
Parent POI writes, child content, version and audit share one transaction.

Client-originated POI mutations (except creation and the read-only QR POST) must
send `If-Match: <content_version>`. Missing versions return 428; stale versions
return 409 with the current document. The frontend preserves unsaved edits and
shows local/server values before the user discards and reloads. It does not
automatically retry a stale write with a new version.

- GET `/admin/pois/{id}/versions?page=1&page_size=20`: paginated old documents.
- POST `/admin/pois/{id}/versions/{old_version}/restore`: restore saved content
  as a new version; preserve the current QR token, lifecycle and global radius.
  Referenced assets must still exist; restored content must meet current rules.
- DELETE `/admin/pois/{id}`: archive and cancel queued/processing tasks atomically.
- POST `/admin/pois/{id}/restore`: reactivate an archived POI and enqueue missing
  English audio. Requires English content and valid Zone coordinates.
- Archived legacy POIs may have their locale content repaired using the normal
  versioned content PUT; they remain archived and no audio jobs run until restore.

## Audio and offline integration

Saving a POI queues missing English audio; saving a locale queues audio for that
locale if it has a script. Enabling a language backfills only existing scripts
on active POIs. Disabling it cancels unfinished jobs and retains saved content.
English and Vietnamese cannot be disabled. Locale metadata PUT is partial and
preserves omitted flags. Switching default language is atomic.

The existing TTS adapter POSTs `{"text":"...","language":"en"}` to
`TTS_ENDPOINT`, optionally using `TTS_API_KEY`, and requires a genuine MP3 response.
Without a configured provider, POI saves still succeed and create an explicit
failed task (`TTS_NOT_CONFIGURED`); upload MP3 or configure the service and retry.
Real provider availability is not established by local verification.

The MP3 validator now belongs to `modules/audio/storage.py`. Script edits clear
old TTS audio but preserve uploaded MP3. Upload cancels in-flight jobs; a late
worker cannot overwrite an upload or archived POI. Background results are
versioned and audited in the same transaction as task completion.

Offline packs always include English. A requested locale without audio uses
the POI's English audio and marks `audio_fallback_locale: "en"`. Uploaded files
are checksum-verified; unlinking images never deletes files referenced by history
or existing offline snapshots. Content/global-radius changes invalidate the
source fingerprint, preventing publication of an obsolete ready pack.
Release DTOs expose `outdated` so already-published packs are visibly marked
when their source changes; existing downloads are retained until replaced.

## QR and configuration

QR tokens are random, unique, auto-created, immutable across edits/archive/restore.
POST `/admin/pois/{id}/qr` reads the existing token; `regenerate:true` returns 409.
PNG includes the POI name and encodes `PUBLIC_APP_URL + /q/{token}`, not the token
alone. The public base URL must be a real HTTPS application URL. Missing/invalid
configuration returns 503 in production rather than printing a misleading QR. Archived QR
image requests return 410. Public/mobile resolution of `/q/{token}` remains an
Enduser integration, not an Admin endpoint in this change.

GET `/admin/pois/{id}/qr/info` returns the encoded `target_url`, `qr_code`,
`poi_name` and `is_local_preview`. It has the same POI-view permission and
archive checks as the PNG endpoint.

For Admin-only testing, `APP_ENV=development` plus a loopback client and
localhost/loopback request URL allows a local QR preview without `PUBLIC_APP_URL`.
The preview uses a loopback `ADMIN_PUBLIC_URL` (default `http://localhost:3000`)
and the same `/q/{token}` path. It does not implement that public resolver.
The UI and downloaded PNG explicitly label the QR as a local test; it is not
usable by customers or phones. HTTP is accepted only for loopback development.
Non-local requests and production still require a non-loopback HTTPS
`PUBLIC_APP_URL`. The preview never changes or regenerates the stored QR token.

Add these values to the local environment without committing secrets:

```dotenv
PUBLIC_APP_URL=https://your-guide-domain.example
# Optional: Unicode TrueType font for printable QR captions.
QR_FONT_PATH=
# Existing speech provider contract, not a browser API key.
TTS_ENDPOINT=
TTS_API_KEY=
```

## Migration and rollout

`database.initialize()` adds `poi.content_version`, `poi.priority`, `zone.boundary`,
`poi_versions` and `admin_settings` idempotently. It seeds en/vi and selects English
as the UI default only if no default exists. Existing default-language choices,
language data and POI content are not replaced. English audio fallback is
independent of the selected UI default language.

Legacy inactive/non-archived POIs become archived, with their complete prior
document saved first, to avoid silently exposing former drafts. Existing QR
tokens are preserved; only missing tokens receive a random token. Existing
active POIs without English remain intact and visibly incomplete; add English
manually before creating an offline pack. Archived drafts can be repaired then
restored, retaining their QR.

Back up the real MySQL database and media before the first application restart.
MySQL DDL is not transactionally reversible; do not treat rollback of a request
as rollback of a schema migration. The migrations were verified on disposable
MySQL databases, not applied to the user's real database during this review.

## Verification

See `PRD_V2_VERIFICATION.json` for the sanitized assertion report and
`fixtures/prd_v2_admin.json` for synthetic API request bodies. Verification uses
real MySQL, real JPEG/PNG and valid MP3 bytes, with isolated media and deliberate
write failures. TTS network output is mocked, never described as live provider
verification. Test databases/media are removed after the run. No production
credentials or local media are included in these artifacts.

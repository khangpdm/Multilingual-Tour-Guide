# Admin dashboard - API_SPEC integration

The dashboard follows `D:/Seminar/md/API_SPEC.md`. That document is the API
contract; `MONGODB_EXPRESS.md` is a database setup example, not a UI contract.
In particular, POI status is `published | unpublished | archived`, not `active`.

## Run

Run `npm run dev` in this directory. Type-check with
`node node_modules/typescript/bin/tsc --noEmit --incremental false` and build
with `npm run build`.

Set `VITE_API_BASE_URL` to the backend origin, or leave it empty when API and
dashboard share an origin through a reverse proxy. No backend is included in
this repository. A Vite-only server cannot answer the API requests.

Production requires HTTPS and the cookie/CORS setup from the spec:
HttpOnly, Secure, SameSite=Strict, refresh cookie Path=/auth, credentials allowed
for the dashboard origin. Prefer same-origin or same-site hosting. Cross-site
cookies will not work with SameSite=Strict. Never put secrets in VITE variables.

## Live mode

- Login, refresh, logout and invitation activation call `/auth/*`.
- Session permissions come from `/admin/me/permissions`; tokens are never
  written to localStorage. Every mutation still requires backend authorization.
- POIs support lifecycle transitions, Vietnamese source content, locale edits,
  MP3 uploads, TTS regeneration options, image upload/removal and server-issued QR.
- Audio tasks use credentialed SSE snapshots/updates, retry and cancellation.
- Users are invited, not manually activated. Email is immutable. Role assignment
  and deactivation enforce the UI's known role levels; the backend is authoritative.
- Roles expose all 32 permissions in 9 groups and support custom roles.
- Languages protect Vietnamese; zones may be disabled without disabling POIs.
- Reports use aggregate analytics endpoints, not raw event-list endpoints.
  Heatmap renders a coordinate plot (not a tiled street map) and the backend's
  baseline levels. Report export downloads the server's CSV/XLSX/JSON response.
- Audit supports date/actor/action/target filters and CSV/JSON export.
- Phase-2 on-demand TTS and presence screens, OTP/reset-password routes, and a
  writable global settings screen are intentionally not exposed without APIs.
- `description` is not sent: it exists only in the setup seed, not PoiContent.

## Demo mode

Select "Kham pha ban demo" on the login page to explicitly enter demo mode.
It uses a separate `tour-guide.admin.api-spec.v2` localStorage key; the old ERD
prototype data is not overwritten or migrated. Do not enter real personal data.
Role switching is available only here. Demo writes and audit entries persist
together, with no network writes. Email, activation links, binary uploads and
translation/TTS execution are not simulated as successes. Jobs remain queued.
Only the content-gap report can be calculated from demo POIs; other reports
require real telemetry from the backend. Demo IDs are opaque prefixed UUIDs;
live IDs always come from the server. CSV/JSON demo exports are available;
XLSX export requires the backend.

## Integration notes and limitations

The initial workspace hydrates authorized lists in API pages of 100, then
fetches POI detail in batches of eight because the list endpoint returns summaries.
UI lists paginate/filter the hydrated data. For large deployments, replace this
with server-driven per-screen pagination and lazy detail loading. Audit filters
and analytics requests already execute on the server. Audit initially covers
the API's default 30-day window.

Permissions for dependent lookups should be assigned together: POI editing needs
`poi.view` to read POIs/zones/languages, and role editing needs `role.view`.
Users with account-edit rights but no role-view rights can still edit a name;
the backend remains responsible for validating role changes and protecting the
last active Super Admin. Custom role levels require the roles lookup.

The spec omits a daily audio-play timeseries endpoint, an admin configuration
write endpoint, a raw telemetry list, and export IDs for top QR/visit rankings.
The UI does not invent those endpoints. No manual offline-pack publish step is
needed because manifests are generated dynamically.

## Acceptance checklist

1. Login/refresh/logout, expired session, invalid and expired invitation tokens.
2. View-only roles cannot mutate; POI Manager cannot invite or regenerate audio.
3. Create a POI with Vietnamese name/text, radius 10-200 m, then unpublish with
   a reason, republish, and archive. Archived POIs remain read-only.
4. Edit a locale, preserve uploaded audio, upload MP3 <=15 MB, regenerate with
   explicit overwrite options; inspect SSE updates and duplicate-task handling.
5. Upload JPG/PNG/WebP <=5 MB, max 10 files, and remove an image.
6. Generate/regenerate QR; previous code becomes invalid on the backend.
7. Keep Vietnamese enabled, switch the default locale, and verify backfill/cancel.
8. Disable a zone containing published POIs; reject bbox spans greater than 1 degree.
9. Invite/edit/deactivate users, protect self/last Super Admin, create a custom role.
10. Filter/export audit and each report, verify UTC+7, missing heatmap data and
    minimum five visits; verify hour trends reject ranges longer than 14 days.
11. Check desktop/mobile navigation, dialogs, keyboard focus and empty/error states.

Existing legacy stylesheet optimizer warnings are independent of these screens.

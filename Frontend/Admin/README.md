# Admin dashboard

The dashboard uses the local FastAPI/MySQL API documented in `../../Backend/README.md`.
POI status is `published | unpublished | archived`, not the storage values `active | inactive`.
The seed Super Admin can manage accounts and roles. Analytics and other screens without local APIs remain unavailable.

## Run

Install dependencies with `pnpm install` (the package manager declared in
`package.json`); commit `pnpm-lock.yaml` when adding dependencies.

Run `npm run dev` in this directory. Type-check with
`node node_modules/typescript/bin/tsc --noEmit --incremental false` and build
with `npm run build`.

Set `VITE_API_BASE_URL` to the backend origin, or leave it empty when API and
dashboard share an origin through a reverse proxy. A local FastAPI backend is available in `../../Backend`; see its README.
Vite proxies `/auth`, `/admin` and `/health` to 127.0.0.1:8000 when
VITE_API_BASE_URL is empty. This implements the local database-editing subset,
not the full production API contract.

Production requires HTTPS and the cookie/CORS setup from the spec:
HttpOnly, Secure, SameSite=Strict, refresh cookie Path=/auth, credentials allowed
for the dashboard origin. Prefer same-origin or same-site hosting. Cross-site
cookies will not work with SameSite=Strict. Never put secrets in VITE variables.

## Notifications

Sonner displays transient action feedback throughout the admin dashboard.
All user-facing notifications use Vietnamese. The shared toaster places its close button on the right with the accessible label `Đóng thông báo`; content reserves space for the button, including inside dialogs. API validation returns Vietnamese field labels and reasons; network and non-JSON failures use Vietnamese fallbacks.
Use `toast.success`, `toast.error`, or `toast.info` from `sonner` in action
handlers, after the operation completes. The shared `AdminToaster` stays
mounted across navigation, uses a five-second duration, and has a close button.
`CrudDialog` temporarily moves its portal container into the native dialog's
top layer so notifications remain visible and interactive without remounting.
Keep persistent guidance, connection errors, and polling failures inline with
`Notice`; background polling must not create repeated error toasts.

## Live mode

- Sign in with a username, not an email. The local development seed is `admin` / `Admin123!`; change the seed password before deployment. Login sends `{ username, password }` to the backend. Email remains available for account contact/audit data.
- Login, refresh, logout and invitation activation call `/auth/*`.
- Session permissions come from `/admin/me/permissions`; tokens are never
  written to localStorage. Every mutation still requires backend authorization.
- POIs support lifecycle transitions, Vietnamese source content, locale edits,
  MP3 uploads, TTS regeneration options, image upload/removal and server-issued QR.
- Audio tasks poll every three seconds and support retry/cancellation. Generation is enabled only when the backend reports a configured TTS adapter.
- Users are invited, not manually activated. Local invitations return a username and one-use activation link for private manual delivery; the application does not send email. Email is immutable. Role assignment
  and deactivation enforce the UI's known role levels; the backend is authoritative.
- The frontend groups permissions by feature and filters the live editor by `capabilities.permission_catalog`. The seed Super Admin has all implemented permissions; unavailable analytics/heatmap APIs are not shown as working features.
- Languages protect Vietnamese; zones may be disabled without disabling POIs.
- Reports use aggregate analytics endpoints, not raw event-list endpoints.
  Heatmap renders a coordinate plot (not a tiled street map) and the backend's
  baseline levels. Report export downloads the server's CSV/XLSX/JSON response.
- Audit supports date/actor/action/target filters and CSV/JSON export.
- Phase-2 on-demand TTS and presence screens, OTP/reset-password routes, and a
  writable global settings screen are intentionally not exposed without APIs.
- `description` stores the short summary, `introduction` stores the full article, and `text` stores narration, independently per locale.
- POIs use canonical categories, an explicit cover image, and ordered galleries. New records start unpublished; the Review/preview tab shows publication blockers and per-language completeness.
- The QR tab shows the server-generated PNG, downloads it, and prints it with the POI name. Binary assets and offline actions require live mode.
- The offline page creates versioned common/language ZIPs, displays sizes/checksums/build errors, and publishes or withdraws releases. It does not package map tiles or change Enduser code.

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
The UI does not invent analytics data. Offline manifests are now versioned snapshots with an explicit Admin publication step; see the backend README for the new local contract.

## Acceptance checklist

1. Login/refresh/logout, expired session, invalid and expired invitation tokens.
2. View-only roles cannot mutate; POI Manager cannot invite or regenerate audio.
3. Create an unpublished POI with Vietnamese content and radius 10-200 m. Add a cover image and MP3, check the preview, publish, unpublish with a reason, and archive. Incomplete publication must fail on both UI and API. Archived POIs remain read-only.
4. Edit a locale, preserve uploaded audio, upload MP3 <=15 MB, regenerate with
   explicit overwrite options; inspect polling updates and duplicate-task handling.
5. Upload JPG/PNG/WebP <=5 MB, max 10 files, and remove an image.
6. Generate/regenerate QR; previous code becomes invalid on the backend.
7. Keep Vietnamese enabled, switch the default locale, and verify backfill/cancel.
8. Disable a zone containing published POIs; reject bbox spans greater than 1 degree.
9. Invite/edit/deactivate users, protect self/last Super Admin, create a custom role.
10. Filter/export audit and each report, verify UTC+7, missing heatmap data and
    minimum five visits; verify hour trends reject ranges longer than 14 days.
11. Check desktop/mobile navigation, dialogs, keyboard focus and empty/error states.
12. Create an offline release, download common/language ZIPs, verify manifests and checksums, publish a new version and withdraw it. Editing source data before publication must reject the stale release. Unsupported legacy screens are not acceptance criteria for the local role.

Existing legacy stylesheet optimizer warnings are independent of these screens.

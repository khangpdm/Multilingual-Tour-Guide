# Admin ERD prototype

Run `npm run dev` from this directory. Build with `npm run build`; type-check with
`npx tsc --noEmit --incremental false`.

## Implemented screens

- `/`: overview calculated from the shared demo dataset.
- `/pois`, `/pois/new`, `/pois/:id`: POI fields, language-specific content,
  image attachments, HTTPS audio preview, QR identifier, and audit history.
- `/zones`, `/zones/new`, `/zones/:id/edit`: bounding boxes and zoom limits.
- `/languages`: active/default language and ordering.
- `/accounts`: email, role, activation status; protects the current demo account.
- `/roles`: editable capability matrix, immutable Super Admin grants.
- `/audio-tasks`: filters, retry, cancellation, progress and error details.
- `/audit-logs`: actor/action/date filters and before/after snapshots.
- `/analytics`: event filters, CSV export, and hourly visit-density heatmap.
- `/settings`: default radius for newly created POIs only.

## Data and integration boundaries

State persists in browser localStorage under `tour-guide.admin.erd.v1`.
Successful edits and their audit entries are persisted together. If storage fails,
the operation is rejected and an error is shown. Images are limited to six files
of 350 KB each; audit snapshots record image sizes rather than copying binary data.
Do not store real customer information in this prototype.

Role switching is a preview control, NOT authentication or a security boundary.
Permissions are grouped UI capabilities such as `poi.write`; an API adapter must
map them to backend permission IDs and enforce authorization server-side.
Role display names must likewise be mapped to `role_id`. Nested POI content must
be mapped to the separate `POI_CONTENT` records when integrating the backend.

No email, OTP, password, TTS generation, offline-pack publish, or analytics ingestion
is performed. Audio jobs remain queued until a real worker is connected. Audio
checksums require backend verification. QR identifiers can be edited/copied, but
QR image generation awaits the visitor application's canonical deep-link format.
Bounding boxes are edited numerically, with a schematic preview, not a map service.
Analytics use synthetic events and visit counts, not real tourist activity.
No listening-duration metrics or POI version snapshots are invented from the ERD.

## Manual acceptance checks

1. Add a language; reload and verify it persists and appears in POI language choices.
2. Verify duplicate codes and disabling the default language are rejected.
3. Edit a POI radius and localized content; save, reopen, and inspect its audit entry.
4. Reject duplicate QR IDs, out-of-zone coordinates, and missing default-language names.
5. Reject inverted zone bounds, bounds excluding existing POIs, and disabling a zone
   with active POIs.
6. Create an audio task from saved narration. Verify duplicate tasks/retries are
   rejected; cancel then retry and inspect the audit log.
7. Change the preview role to POI Manager on `/audit-logs`; verify access is blocked.
8. Create/edit a demo account; reject duplicate emails and disabling the current actor.
9. Filter analytics by zone/POI/event/language/source/tier and export the filtered CSV.
10. Verify density filters use only date, zone and POI, and distinguish missing data
    from zero visits. Check navigation and form layout at mobile and desktop sizes.

The existing stylesheet contains two malformed legacy selectors (`......home-analytics`
and `...chart-card`) that produce CSS optimizer warnings; they are unrelated to these
screens and do not prevent a production build.

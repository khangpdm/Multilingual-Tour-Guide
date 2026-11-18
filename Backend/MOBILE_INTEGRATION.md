# Admin and mobile integration

## Merge and data ownership

`origin/develop` was merged into `feat/backend-admin` in `8ec0531`.
Conflicting older Admin implementations were resolved in favor of the current
PRD-v2 Admin: email/MFA, optimistic versions, archive/restore, immutable QR,
uploaded MP3 protection and offline releases are retained. Mobile UI and its
dependencies come from develop. The pre-merge working edits were restored;
the safety stash `pre-develop-merge-local-admin-20261117` is retained.

The mobile endpoints use the same MySQL adapter and managed media root as
Admin. They do not use the legacy hardcoded Linux audio directory. The old
mobile translation/audio worker is not started: it must not compete with the
Admin queue or overwrite uploaded audio. Public audio requests return existing
audio (with English fallback), and do not enqueue unbounded anonymous TTS.
New narration is generated or uploaded by an authorized Admin.

## Run safely on a physical device

Stop the previous backend/TTS processes, then run from the repository root:

```powershell
.\Backend\.venv\Scripts\python.exe .\Backend\start_local.py --mobile-lan
```

- Admin backend: `127.0.0.1:8000`, loopback only.
- Windows TTS: `127.0.0.1:8001`, loopback only, secret required.
- Public-only mobile API: `0.0.0.0:8002`, no Admin/auth routes mounted.
- Admin frontend remains a separate `npm run dev` command.

Do not expose the combined Admin app on LAN while local MFA bypass is enabled.
The public app only reads the existing schema; start it after the Admin backend
has completed initialization. Windows Firewall may need to allow port 8002 on
the trusted private network; the launcher does not change firewall rules.

Set `EXPO_PUBLIC_API_URL=http://<PC-LAN-IP>:8002` in
`Frontend/MobileApp/.env` for a physical phone on the same trusted Wi-Fi.
Use `http://10.0.2.2:8000` for an Android emulator, or
`http://localhost:8000` for an iOS simulator/web preview on the same host.
`EXPO_PUBLIC_*` values are public client configuration, never secrets.
Restart Metro after changing environment values.

From `Frontend/MobileApp` run `npm start`, then open an SDK-57-compatible
development build. The project uses native Mapbox, so Expo Go is not sufficient.
Keep the existing Mapbox configuration and use the project's EAS development
build workflow; do not commit private download tokens. Rebuild the native app
after adding native dependencies. No native Android/iOS folders are generated
by this change. Plain HTTP is for local testing only; deployed applications and
public camera QR links require HTTPS and appropriate native transport settings.

## Endpoints

- `GET /languages`: active Admin languages.
- `GET /poi/load-all`: active POIs in active zones, optional language and time
  filters, ETag/304, and tombstones for hidden records on incremental sync.
- `GET /poi/{id}`, `/poi/by-qr/{token}`, `/poi/hotset`: public detail,
  immutable QR lookup and nearby prefetch metadata.
- `GET /media/{name}`: strictly validated managed asset name and active POI
  reference check. No directory listing or Admin cookie required.
- `GET /audio/{id}/{locale}.mp3`: existing requested audio or English fallback.
- `POST /audio/synthesize`: compatibility lookup, returns existing audio only.
- `GET /offline-packs`: only published releases in active zones.
- `GET /offline-packs/{id}/files/{part}`: verified published ZIP.
- `GET /offline-packs/{id}/manifest/{part}` and `/assets/{part}/{name}`:
  immutable snapshot content, per-file SHA-256, and membership-checked files.
- `GET /q/{token}`: escaped, public browser audio page for an active POI.

Admin Vite proxies `/q` and `/media` to the local backend, so its local QR URL
now works on the PC. A phone's normal camera cannot open a localhost URL.
The mobile app scanner extracts the token and resolves it against its configured
backend, without fetching the arbitrary URL embedded in a scanned QR. Thus a
local Admin test QR can be tested inside the connected mobile app. Production
camera links need `PUBLIC_APP_URL` pointing at the reachable HTTPS public app.
Do not expose the local Admin Vite server just to make QR accessible.

## Offline behavior

The download screen now lists actual Admin releases rather than sample cards.
It downloads common assets, English, and the selected locale; verifies every
file SHA-256; and only writes the installed index after all files succeed.
Failed replacement retains the previous pack. Downloads persist under the
native document directory; deleting a pack removes only its owned folder.
Wi-Fi-only settings are enforced. The service stores relative snapshot paths
as local image/audio URIs, not authenticated Admin URLs. Indexes are separated
by API origin to avoid mixing different backends.

On network failure the app loads installed POIs and plays local audio. QR can
resolve installed tokens offline, but an explicit server 404 is not overridden
by the cache. Withdrawals stop new server downloads; already downloaded content
cannot be remotely erased. There are no offline basemap/PMTiles downloads yet.
Offline download is native Android/iOS only, not the browser preview.

## Acceptance

1. Restart both services with the launcher, and restart Admin Vite.
2. Configure the device API URL; open `/health` on port 8002 from the phone.
3. Launch the mobile development build. Verify the Admin POI names, images,
   coordinates and language list; no sample POIs silently replace API errors.
4. Open a POI and listen to VI/EN narration. Scan its Admin QR inside the app.
5. Download the published zone/locale. Wait for the installed status.
6. Disable device networking, reload the app, open the downloaded POI and listen.
   Basemap tiles may be unavailable; downloaded content and MP3 should remain.
7. Reconnect, archive a test POI and confirm online sync/QR hide it; restore it.
8. Remove the downloaded pack and verify storage totals update.

Verified without modifying the real database: 48 read-only API/real-media checks
(including the published common/EN/VI package) and 16 mocked visibility, QR,
fallback and escaping checks. Fourteen Node checks exercise simulated native
file/crypto/network/storage behavior, checksum rollback, Wi-Fi rules and removal.
Device camera, transport permissions, real native storage/playback and airplane
mode still require acceptance on a physical/emulated development build.

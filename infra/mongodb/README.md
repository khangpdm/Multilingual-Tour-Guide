# Local MongoDB

Run commands from this directory. This Compose project is independent of SportHub.
Copy `.env.example` to `.env` and set two different random passwords for a new setup.
The local `.env` is ignored by Git. Never expose credentials in frontend VITE variables.

```powershell
docker compose up -d --wait --wait-timeout 180
docker compose ps
docker compose stop
docker compose start
```

MongoDB is exposed only on localhost, port 27017 by default.
The initializer creates tourism_db, an application user with readWrite access,
and five empty collections: languages, zones, pois, analytics_events, poi_density_hourly.
It does not seed data or implement the complete application schema or indexes.

## Compass or backend connection

Use actual values from `.env` in this URI:

```text
mongodb://<MONGO_APP_USERNAME>:<MONGO_APP_PASSWORD>@127.0.0.1:27017/tourism_db?authSource=tourism_db
```

URL-encode credentials containing reserved characters. Generated local passwords
use hexadecimal characters and do not require encoding.
For the existing backend, set MONGODB_URL to the URI and MONGODB_DB_NAME to tourism_db.
Frontend Admin must access the database through backend APIs, not directly.

Data is stored in project-specific named volumes. Do not use `docker compose down -v`
or factory reset unless you intend to delete data. Back up important data separately.
Initialization runs only with an empty data volume. Editing `.env` later does not
change existing database passwords; rotate them inside MongoDB instead.

## Optional demo data

From the repository root in PowerShell:

```powershell
Get-Content -Raw infra/mongodb/seed.js | docker compose -f infra/mongodb/compose.yaml exec -T mongodb mongosh --quiet
```

This inserts three languages (vi/en/ja), two fictional zones and four fictional
POIs. Records are marked is_demo=true and seed_tag=tourism-local-demo-v1.
Re-running only inserts missing IDs and does not overwrite existing records.
Language IDs use standard locale codes required by the existing API; zone and
POI IDs use the demo_ prefix. No audio, images or analytics events are invented.
Coordinates are test fixtures, not verified real destinations.

POIs use GeoJSON and status=active to match the current mobile POI API.
The Admin API still needs to map GeoJSON to lat/lng and reconcile its
published/unpublished/archived states. This seed does not connect the Admin UI
or add the geospatial indexes required for nearby searches.

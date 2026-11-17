# Active mobile devices

The dashboard replaces only the queued/processing audio card with active devices.
Other audio statistics and task management are unchanged.

- Mobile sends `POST /mobile/heartbeat` with an installation UUID every 30 seconds
  while the app is foregrounded, and when returning to the foreground.
- The UUID persists in AsyncStorage. No hardware identifier, location or account
  details are sent. Reinstalling or clearing app data can create a new UUID.
- Backend upserts one `mobile_presence` row per installation using server UTC time.
- `GET /admin/mobile/active-devices` requires `poi.view` and counts rows seen within
  120 seconds. Admin refreshes this card every 15 seconds; failures show a dash,
  not a misleading zero.
- This is an approximate online-installation count, not authenticated users or
  verified physical devices. Offline/background apps expire after two minutes.
  Public heartbeat identifiers can be spoofed; do not use the count for billing.

Restart the main backend to create the table through its existing schema initializer,
then reload mobile and Admin. The public mobile service shares the same database.

Manual check: open one mobile installation and wait for the Admin refresh; reload
mobile and verify the count does not increase; open another installation to increase
the count; background both and wait over two minutes plus one dashboard refresh.

Run focused tests from Backend: `.venv\Scripts\python.exe -m unittest tests.test_mobile_presence`.

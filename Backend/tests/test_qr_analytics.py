import unittest
from unittest.mock import MagicMock, patch
from uuid import UUID

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.modules.mobile import routes as mobile


class QRAnalyticsTests(unittest.TestCase):
    def setUp(self):
        self.database = MagicMock()
        self.cursor = self.database.connection.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        self.poi = {
            'poi_id': '0191a000-0000-7000-a000-000000000001',
            'content': {'vi': {'name': 'Test POI', 'text': 'Narration', 'audio_url': None}},
        }
        self.enterContext(patch.object(mobile, 'database', self.database))
        self.find_poi = self.enterContext(patch.object(mobile, 'find_poi', return_value=self.poi))
        self.enterContext(patch.object(mobile, 'active_languages', return_value={'vi'}))
        self.enterContext(patch.object(mobile, 'public_poi', return_value=self.poi))
        app = FastAPI()
        app.include_router(mobile.router)
        self.client = self.enterContext(TestClient(app))

    def test_app_and_browser_each_record_one_scan(self):
        for route in ('/poi/by-qr/test-token', '/q/test-token'):
            with self.subTest(route=route):
                self.cursor.reset_mock()
                response = self.client.get(route)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.headers['cache-control'], 'no-store')
                self.cursor.execute.assert_called_once()
                statement, values = self.cursor.execute.call_args.args
                self.assertIn('INSERT INTO analytics_events', statement)
                self.assertIn('UTC_TIMESTAMP(3)', statement)
                self.assertEqual(values[1:5], ('QR_SCAN', self.poi['poi_id'], 'vi', 'qr_scan'))
                self.assertEqual(UUID(values[0]).version, 4)
                self.assertEqual(UUID(values[5]).version, 4)

    def test_separate_scans_have_unique_events_and_reuse_device_cookie(self):
        self.client.get('/poi/by-qr/test-token')
        self.client.get('/poi/by-qr/test-token')
        first, second = [call.args[1] for call in self.cursor.execute.call_args_list]
        self.assertNotEqual(first[0], second[0])
        self.assertEqual(first[5], second[5])

    def test_device_header_overrides_cookie_and_preserves_identity(self):
        first_device = '50efbc60-c4d8-44d3-b1dc-2ee7f065b944'
        second_device = '60efbc60-c4d8-44d3-b1dc-2ee7f065b944'
        for device_id in (first_device, first_device, second_device):
            for route in ('/poi/by-qr/test-token', '/q/test-token'):
                response = self.client.get(route, headers={'X-Device-Id': device_id})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(self.cursor.execute.call_args.args[1][5], device_id)
        recorded_ids = {call.args[1][5] for call in self.cursor.execute.call_args_list}
        self.assertEqual(recorded_ids, {first_device, second_device})

    def test_invalid_device_header_does_not_create_event(self):
        for device_id in ('invalid', '', '00000000-0000-0000-0000-000000000000'):
            for route in ('/poi/by-qr/test-token', '/q/test-token'):
                response = self.client.get(route, headers={'X-Device-Id': device_id})
                self.assertEqual(response.status_code, 422)
        self.cursor.execute.assert_not_called()

    def test_invalid_qr_is_not_recorded(self):
        self.find_poi.side_effect = HTTPException(404, 'POI not found')
        for route in ('/poi/by-qr/missing', '/q/missing'):
            self.assertEqual(self.client.get(route).status_code, 404)
        self.cursor.execute.assert_not_called()

    def test_inactive_language_is_not_recorded(self):
        for route in ('/poi/by-qr/test-token', '/q/test-token'):
            self.assertEqual(self.client.get(route, params={'lang': 'invalid'}).status_code, 422)
        self.cursor.execute.assert_not_called()

    def test_invalid_cookie_is_replaced(self):
        self.client.cookies.set('qr-device-id', 'invalid')
        response = self.client.get('/q/test-token')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(UUID(self.cursor.execute.call_args.args[1][5]).version, 4)
        self.assertIn('HttpOnly', response.headers['set-cookie'])

    def test_analytics_failure_does_not_block_poi_content(self):
        self.cursor.execute.side_effect = RuntimeError('database unavailable')
        for route in ('/poi/by-qr/test-token', '/q/test-token'):
            with self.assertLogs(mobile.logger, level='ERROR'):
                response = self.client.get(route)
            self.assertEqual(response.status_code, 200)
            self.assertIn('Test POI', response.text)

    def test_manual_poi_open_does_not_record_scan(self):
        response = self.client.get('/poi/' + self.poi['poi_id'])
        self.assertEqual(response.status_code, 200)
        self.cursor.execute.assert_not_called()


if __name__ == '__main__':
    unittest.main()

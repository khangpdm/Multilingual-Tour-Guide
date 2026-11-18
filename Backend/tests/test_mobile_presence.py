import unittest
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.modules.mobile import routes as mobile
from app.modules.system import routes as system


class MobilePresenceTests(unittest.TestCase):
    def setUp(self):
        self.database = MagicMock()
        self.cursor = self.database.connection.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        self.app = FastAPI()
        self.app.include_router(mobile.router)
        self.client = TestClient(self.app)

    def test_heartbeat_uses_stable_id_and_server_time(self):
        identifier = '50efbc60-c4d8-44d3-b1dc-2ee7f065b944'
        with patch.object(mobile, 'database', self.database):
            for attempt in range(2):
                response = self.client.post('/mobile/heartbeat', json={'installation_id': identifier})
                self.assertEqual(response.status_code, 200)
        statement, parameters = self.cursor.execute.call_args.args
        self.assertIn('ON DUPLICATE KEY UPDATE', statement)
        self.assertIn('UTC_TIMESTAMP(3)', statement)
        self.assertEqual(parameters, (identifier,))

    def test_invalid_id_rejected_before_database_access(self):
        with patch.object(mobile, 'database', self.database):
            for body in ({}, {'installation_id': 'invalid'}, {'installation_id': 'x' * 1000}):
                self.assertEqual(self.client.post('/mobile/heartbeat', json=body).status_code, 422)
        self.database.connection.assert_not_called()

    def test_count_filters_expired_devices(self):
        self.cursor.fetchone.return_value = {'active_devices': 2}
        with patch.object(system, 'database', self.database):
            result = system.active_devices(user={})
        self.assertEqual(result, {'active_devices': 2, 'window_seconds': 120})
        statement = self.cursor.execute.call_args.args[0]
        self.assertIn('last_seen_at >= UTC_TIMESTAMP(3) - INTERVAL 2 MINUTE', statement)

    def test_count_requires_admin_permission(self):
        route = next(route for route in system.router.routes if route.path == '/admin/mobile/active-devices')
        self.assertTrue(route.dependant.dependencies)


if __name__ == '__main__':
    unittest.main()

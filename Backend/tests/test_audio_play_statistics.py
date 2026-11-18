import sqlite3
import unittest
from unittest.mock import MagicMock, patch

from app.modules.system import routes as system


class AudioPlayStatisticsTests(unittest.TestCase):
    def test_unique_devices_counts_ids_instead_of_events(self):
        connection = sqlite3.connect(':memory:')
        self.addCleanup(connection.close)
        connection.row_factory = sqlite3.Row
        connection.execute('CREATE TABLE analytics_events (event_type TEXT, device_id TEXT)')
        database = MagicMock()
        cursor = database.connection.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value

        def execute(statement, values):
            cursor.execute.return_value = connection.execute(statement.replace('%s', '?'), values)

        cursor.execute.side_effect = execute
        cursor.fetchone.side_effect = lambda: dict(cursor.execute.return_value.fetchone())
        with patch.object(system, 'database', database):
            self.assertEqual(system.analytics_summary(user={}), {'audio_plays': 0, 'unique_devices': 0})
            for event_type in ('QR_SCAN', 'QR_SCAN', 'AUDIO_PLAY', 'PACK_DOWNLOAD'):
                connection.execute('INSERT INTO analytics_events VALUES (?, ?)', (event_type, 'device-a'))
            self.assertEqual(system.analytics_summary(user={}), {'audio_plays': 1, 'unique_devices': 1})
            connection.execute('INSERT INTO analytics_events VALUES (?, ?)', ('QR_SCAN', 'device-b'))
            self.assertEqual(system.analytics_summary(user={}), {'audio_plays': 1, 'unique_devices': 2})
            self.assertEqual(connection.execute('SELECT COUNT(*) FROM analytics_events').fetchone()[0], 5)

    def test_summary_requires_admin_permission(self):
        route = next(route for route in system.router.routes if route.path == '/admin/analytics/summary')
        self.assertTrue(route.dependant.dependencies)


if __name__ == '__main__':
    unittest.main()

import importlib
import os
import tempfile
import unittest
import uuid
from datetime import datetime, timedelta


class PreorderTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ['TIHO_DB'] = self.tmp.name + '/test.db'
        os.environ['TIHO_CONSENT_VERSION'] = 'test-v1'
        os.environ['TIHO_ADMIN_TOKEN'] = 'test-secret'
        import app
        self.app = importlib.reload(app)
        self.payload = {'id': str(uuid.uuid4()), 'name': 'Тест', 'phone': '+7 900 123-45-67', 'quantity': 2,
                        'date': datetime.now(self.app.MOSCOW).date().isoformat(), 'time': '12:00',
                        'comment': '', 'consent': True, 'consent_version': 'test-v1'}

    def tearDown(self):
        self.tmp.cleanup()

    def test_save_retry_and_auth(self):
        self.assertTrue(self.app.create_order(self.payload)['saved'])
        self.assertTrue(self.app.create_order(self.payload)['saved'])
        with self.app.database() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM orders').fetchone()[0], 1)
            self.assertEqual(db.execute('SELECT consent_version FROM orders').fetchone()[0], 'test-v1')
        self.assertTrue(self.app.authorized('Bearer test-secret'))
        self.assertFalse(self.app.authorized('Bearer wrong'))

    def test_invalid_data(self):
        for field, value in [('phone', '123'), ('quantity', 21), ('consent', False), ('consent_version', 'old'),
                             ('date', (datetime.now(self.app.MOSCOW).date() + timedelta(days=2)).isoformat())]:
            data = dict(self.payload, **{field: value})
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.app.create_order(data)


if __name__ == '__main__':
    unittest.main()

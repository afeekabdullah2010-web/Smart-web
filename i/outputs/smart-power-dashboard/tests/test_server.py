"""Run with python -m unittest discover -s tests. No network or real database used."""
import base64
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('smart_power_server', ROOT / 'server.py')
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.previous_db, self.previous_legacy = app.DB, app.LEGACY_DB
        app.DB = Path(self.temp.name) / 'permanent.db'
        app.LEGACY_DB = Path(self.temp.name) / 'missing-legacy.db'
        app.init_db()
        with app.connection() as db:
            for uid, role in enumerate(['Admin', 'Staff', 'Staff'], 1):
                db.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)', (uid, f'{role} {uid}', f'user{uid}@example.test', role, app.hash_password('Test-password-123'), 1, int(time.time())))
                db.execute('INSERT INTO sessions VALUES(?,?,?,?)', (app.token_hash(str(uid)), uid, 'csrf', int(time.time()) + 600))

    def tearDown(self):
        app.DB, app.LEGACY_DB = self.previous_db, self.previous_legacy
        self.temp.cleanup()

    def request(self, path, data=None, uid=1, csrf='csrf', method=None, form=False):
        from urllib.parse import urlencode
        handler = object.__new__(app.Handler)
        handler.path = path
        handler.command = method or ('POST' if data is not None else 'GET')
        handler.headers = {'Cookie': f'sp_session={uid}'} if uid else {}
        payload = dict(data, csrf=csrf) if data is not None else None
        body = (urlencode(payload).encode() if form else json.dumps(payload).encode()) if payload is not None else b''
        handler.headers['Content-Length'] = str(len(body))
        handler.rfile, handler.wfile = io.BytesIO(body), io.BytesIO()
        codes, headers = [], {}
        handler.send_response = lambda status, *args: codes.append(int(status))
        handler.send_header = lambda name, value: headers.update({name: value})
        handler.end_headers = lambda: None
        handler.send_error = lambda status, *args: codes.append(int(status))
        getattr(handler, 'do_' + handler.command)()
        return codes[0], headers, handler.wfile.getvalue()

    def test_position_must_match_login_role(self):
        data = dict(position='Staff', email='user1@example.test', password='Test-password-123')
        status, headers, body = self.request('/auth/login', data, uid=None, form=True)
        self.assertEqual(status, 200)
        self.assertNotIn('Set-Cookie', headers)
        self.assertIn(b'Incorrect position', body)
        data['position'] = 'Admin'
        status, headers, _ = self.request('/auth/login', data, uid=None, form=True)
        self.assertEqual(status, 303)
        self.assertEqual(headers['Location'], '/admin.html')

    def test_team_survives_database_reopen_and_init(self):
        data = dict(name='Persistent Staff', email='', phone='0771234567', role='Engineer', site='Site', salary=90000, status='Active')
        self.assertEqual(self.request('/api/admin/team', {'data': data})[0], 200)
        app.init_db()
        rows = json.loads(self.request('/api/admin/team')[2])
        self.assertEqual(rows[0]['name'], data['name'])
        self.assertEqual(rows[0]['salary'], 90000)

    def test_report_csv_headers_dates_and_permissions(self):
        self.test_team_survives_database_reopen_and_init()
        status, headers, body = self.request('/api/admin/reports?kind=team')
        self.assertEqual(status, 200)
        self.assertIn('attachment', headers['Content-Disposition'])
        self.assertIn('Persistent Staff', body.decode('utf-8-sig'))
        self.assertEqual(len(self.request('/api/admin/reports?kind=team&from=2099-01-01')[2].decode('utf-8-sig').splitlines()), 1)
        self.assertEqual(self.request('/api/admin/reports?kind=team', uid=2)[0], 403)
        self.assertEqual(self.request('/api/admin/reports?kind=team&from=bad')[0], 400)
        self.assertEqual(self.request('/api/admin/reports?kind=team', method='HEAD')[2], b'')

    def test_profile_isolation_csrf_persistence_and_validation(self):
        data = dict(name='Updated Staff', email='user2@example.test', nic='200012345678', dob='2000-01-01', phone='0771234567', address='தமிழ் සිංහල')
        self.assertEqual(self.request('/api/profile', {'data': data}, uid=2, csrf='wrong')[0], 403)
        self.assertEqual(self.request('/api/profile?user=1', uid=2)[0], 403)
        self.assertEqual(self.request('/api/profile?user=3', {'data': data}, uid=2)[0], 403)
        self.assertEqual(self.request('/api/profile', {'data': data}, uid=2)[0], 200)
        app.init_db()
        profile = json.loads(self.request('/api/profile', uid=2)[2])
        self.assertEqual(profile['nic'], data['nic'])
        self.assertEqual(profile['name'], data['name'])
        self.assertEqual(json.loads(self.request('/api/profile?user=2')[2])['address'], data['address'])
        for invalid in ({'role': 'Admin'}, {'dob': '2999-01-01'}, {'photo': 'data:image/svg+xml;base64,AAAA'}, {'email': 'user1@example.test'}):
            self.assertIn(self.request('/api/profile', {'data': invalid}, uid=2)[0], (400, 409))

    def test_support_reply_and_staff_isolation(self):
        status, _, body = self.request('/api/support', {'subject': 'Help request', 'message': 'Please help me.'}, uid=2)
        self.assertEqual(status, 201)
        self.assertEqual(json.loads(self.request('/api/support', uid=3)[2])['requests'], [])
        rows = json.loads(self.request('/api/admin/support')[2])
        row = rows[0]
        row.update(status='Resolved', response='Office reply')
        self.assertEqual(self.request('/api/admin/support', {'id': row['id'], 'data': row})[0], 200)
        self.assertEqual(json.loads(self.request('/api/support', uid=2)[2])['requests'][0]['response'], 'Office reply')

    def test_logout_invalidates_session(self):
        self.assertEqual(self.request('/auth/logout', {}, uid=2, csrf='wrong', form=True)[0], 403)
        self.assertEqual(self.request('/api/me', uid=2)[0], 200)
        self.assertEqual(self.request('/auth/logout', {}, uid=2, form=True)[0], 303)
        self.assertEqual(self.request('/api/me', uid=2)[0], 303)

    def test_legacy_migration_keeps_users_and_records(self):
        self.test_team_survives_database_reopen_and_init()
        app.LEGACY_DB = app.DB
        app.DB = Path(self.temp.name) / 'appdata' / 'smart_power.db'
        with patch.dict(os.environ, {}, clear=False):
            old = os.environ.pop('SMART_POWER_DB', None)
            try:
                app.init_db()
                app.init_db()
            finally:
                if old is not None:
                    os.environ['SMART_POWER_DB'] = old
        self.assertEqual(len(json.loads(self.request('/api/admin/team')[2])), 1)
        self.assertEqual(json.loads(self.request('/api/me')[2])['role'], 'Admin')


    def test_registration_persists_and_cannot_create_admin(self):
        details = dict(name='Registered Staff', email='new@example.test', password='Register-pass-123', confirm='Register-pass-123', role='Admin')
        status, _, body = self.request('/auth/register', details, uid=None, form=True)
        self.assertEqual(status, 200)
        self.assertIn(b'Account created', body)
        app.init_db()
        with app.connection() as db:
            row = db.execute("SELECT role,password_hash FROM users WHERE email='new@example.test'").fetchone()
        self.assertEqual(row['role'], 'Staff')
        self.assertNotEqual(row['password_hash'], details['password'])
        login = dict(email=details['email'],password=details['password'],position='Staff')
        self.assertEqual(self.request('/auth/login', login, uid=None, form=True)[0], 303)
        login['position'] = 'Admin'
        self.assertEqual(self.request('/auth/login', login, uid=None, form=True)[0], 200)
        duplicate = self.request('/auth/register', details, uid=None, form=True)[2]
        self.assertIn(b'already has an account', duplicate)
        details.update(email='mismatch@example.test', confirm='wrong-password')
        self.assertIn(b'Passwords must match', self.request('/auth/register', details, uid=None, form=True)[2])

    def test_image_limit_accepts_3_point_5_mb_rejects_larger(self):
        # A complete PNG plus trailing padding exercises the actual decoded-byte
        # limit and combined JSON/base64 request size without a large fixture.
        png = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082')
        image = png + b'\0' * (3_500_000 - len(png))
        value = 'data:image/png;base64,' + base64.b64encode(image).decode()
        self.assertEqual(self.request('/api/profile', {'data': {'photo': value, 'signature': value}}, uid=2)[0], 200)
        app.init_db()
        profile = json.loads(self.request('/api/profile', uid=2)[2])
        self.assertEqual(profile['photo'], value)
        larger = 'data:image/png;base64,' + base64.b64encode(image + b'0').decode()
        self.assertEqual(self.request('/api/profile', {'data': {'photo': larger}}, uid=2)[0], 400)


if __name__ == '__main__':
    unittest.main()

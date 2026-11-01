# Smart Power Engineering Works — Secure local server

The public company website is served at `http://127.0.0.1:8000/`. Protected dashboards deliberately do not work when their HTML files are double-clicked; use the server URL.

## Start

1. Open PowerShell in this folder.
2. Run: `python server.py`
3. Open `http://127.0.0.1:8000` in a browser.
4. On the first run, open `/auth/setup` and create the first Admin account using a password of at least 12 characters.

The application saves users, hashed passwords, CSRF tokens, and server-side session records in `smart_power.db`. Do not upload this database to a public repository.

## Security implemented

- PBKDF2-HMAC-SHA-256 password hashing with 600,000 rounds
- Random server-side sessions stored in SQLite
- HttpOnly, SameSite cookies
- CSRF token validation for sign-out and Admin user creation
- Server-side role guards: Admin has full control; Staff can access only their own workspace
- Admin-only user-management page: `/admin/users`

Client portal login is currently disabled and can be added later when required.

For deployment, run behind HTTPS and add `Secure` to the session cookie. Configure backups and a production database before publishing.

## Access policy

- Admin can open every enabled workspace and create Admin/Staff accounts.
- Staff can open only the Staff workspace and their own signed-in identity; company management pages are forbidden.
- Client login and Client sessions are disabled, including existing Client accounts. Client records remain available to Admin.
- Only listed website assets are served; the database, Python source and other internal files cannot be downloaded through this server. GET and HEAD use the same access checks.
- Staff attendance, salary and task panels currently contain sample data, not personal records. Per-user storage and editing still need implementation before operational use.

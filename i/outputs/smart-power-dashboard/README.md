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
- Staff Attendance, My Tasks and Salary pages now use account-owned records; see the Staff workspace section below.

## Company Administration update

- Header/footer Company Administration links share `/auth/login`; login routes Admin and Staff by their account role. The old Hidden entry and warning/password overlays are removed.
- The public site, login, and common administration controls support English, Tamil and Sinhala. The language selector remembers the browser choice. Company names, user-entered records, and some operational/error messages retain their source text.
- Admin pages now use persisted SQLite records instead of illustrative totals. Projects include code, client, site, type, status, start/end dates, budget, progress, manager and notes.
- Staff directory, attendance, material requisitions, invoices, clients, reminders and consultation requests support create, edit and delete. Invoice statuses track payment; there is no online payment processor.
- Notifications show saved changes and new consultation requests. They are an internal inbox, not email/SMS delivery.
- Settings support company details and user accounts (create, edit, reset password and deactivate); Admin cannot deactivate or demote their own account. Directory records do not create login accounts automatically.
- Reports export actual records to CSV, optionally filtered by creation date. No sample PDF/XLSX downloads are advertised.
- Consultation requests from the public website are saved for Admin follow-up; the form reports failures accurately.
- Start the existing server normally. New tables are created automatically without deleting existing accounts. Restart the server after updating files.
- Staff workspace business panels were replaced with account-linked records in the Staff workspace update below.

Earlier validation: 26 access checks, 66 workflow requests against a temporary database, and JavaScript syntax checks. The profile/reports update below also passed real Chromium browser checks.


## Login, profiles, reports and support

- Company Administration opens `/auth/login?next=%2Fadmin.html`. Choose Position **Admin** or **Staffs**; the position must match the stored account role. Choosing Admin never upgrades a Staff account.
- My profile is available to both roles. It saves name/login email, phone, NIC, DOB, address, blood group, employee ID, department, job title, employment type, joining date, qualifications, emergency contact, and bank details. Photo/signature uploads accept PNG, JPEG or WebP up to 3.5 MB each. Signatures can also be drawn; the stored image is not a cryptographic signature.
- Staff can read/edit only their own profile. Admin can open another account's profile from User administration → Profile. Role and account activation remain Admin controls.
- Office support provides the configured office phone/email and a request inbox. Requests persist in SQLite, create Admin notifications, and can receive an office reply/status. Staff see only their own requests. No email or SMS is sent automatically.
- Reports now download CSV directly from the server with an attachment filename, UTF-8 BOM and Excel-safe cells. Empty exports contain the column headers. Optional dates refer to record creation in Sri Lanka time.
- Log out is visible on desktop and mobile and deletes the server-side session.

### Keep saved records when updating

On Windows, the default database is now `%LOCALAPPDATA%\SmartPowerEngineering\smart_power.db`, outside ZIP extraction folders. On the first upgrade, the existing `smart_power.db` in this project folder is copied using SQLite backup if the permanent database does not exist yet. **Update and run your existing project folder first** to import your existing accounts and Team records. Subsequent upgrades reuse the permanent database. Startup prints its actual path.

Other platforms keep the original project-folder database by default. Set `SMART_POWER_DB` to an absolute persistent database path when deploying or choosing a separate data directory. Back up the database before moving it. Profile identity/bank information is accessible only through authenticated endpoints; the database is never served as a static file.

Restart `python server.py` after installing the new code. Profiles and support tables are added automatically without resetting existing tables.

### Regression checks

From this folder, run `python -m unittest discover -s tests` (standard library only). Nine regression tests cover position matching, Team persistence, CSV downloads, profile access/validation, support replies, logout and legacy-database migration. Tests use a temporary database.

For a real browser check, install Playwright and Chromium, then run `python tests/check_browser.py`. This checks Admin/Staff sign-in, Team persistence after refresh/server restart and Tamil edits, CSV/date downloads, profile photo/drawn signature persistence, support/replies, logout and mobile Staff controls. It uses a temporary database and localhost server. Both checks passed during this update.


## Account registration and image/status fixes

Secure sign in includes Create account. New public registrations are permanently saved as Staff accounts with hashed passwords; their chosen position on later sign-ins must be Staffs. Duplicate emails and mismatched/short passwords show errors. The existing first-Admin setup and Admin-managed account roles remain unchanged; a submitted role cannot grant Admin access.

Status filters now list every valid status for each workspace, even if no records exist in that status. The Users page filters Active/Inactive accounts. Pages without a status field do not show an empty status filter. Search and status selection work together.

Photo and signature limits are 3,500,000 bytes (3.5 MB) **each**, enforced in both the browser and server. The profile request limit permits both images after base64 encoding. Nine server tests and the complete Chromium browser workflow passed, including repeat sign-in after registration, all status choices, and a 3.5 MB image persisted after reload.


## Staff workspace: real attendance, tasks, updates and payroll

Staff navigation now opens separate Today, Attendance, My Tasks and Salary pages. All `/api/staff/` reads and writes derive ownership from the signed-in account; browser-supplied user IDs cannot access another Staff account's records. There are no seeded salary, attendance or task values.

- Attendance supports one shift per Sri Lanka calendar day, check-in with a site, and check-out using server timestamps. An overnight open shift can be checked out the next day. Duplicate check-in/check-out is rejected and elapsed hours are calculated from recorded timestamps.
- Admin → Staff tasks assigns work to an active Staff login account, with site, due date, priority, instructions and status. Staff can start and complete their own tasks. Completed tasks cannot be reopened by Staff.
- Add work update saves site, work details, optional assigned task and optional photo. Upload site photo requires an image. PNG/JPEG/WebP up to 3.5 MB are accepted. Staff see their own updates; Admin → Staff work updates shows submissions/photos. Updates are append-only from Staff.
- Admin → Staff payroll creates one payroll record per Staff/month, with basic salary, allowances, deductions and paid amount. Drafts stay private to Admin. Set status **Issued** to publish to the Staff Salary page. Net pay and balance are calculated; no banking transfer is performed.
- Salary supports a printable payslip (use Print / Save as PDF) and an explicitly labelled downloadable HTML payslip. Both use issued payroll data and enforce ownership. Opening or downloading another Staff's payslip is blocked.
- Admin → Staff time logs shows Staff check-in/out records. These are separate from the existing manual attendance ledger. Team records do not automatically assign login-account payroll/tasks; choose the Staff account explicitly.

Admin can reach these controls from Company overview and the Team page. Existing users and records are preserved; startup adds the new attendance table. Restart `python server.py` after updating.

Validation: 13 standard-library server regression tests, plus `python tests/check_staff_browser.py` for the complete real-browser flow (Admin task/payroll creation; Staff check-in/out, separate pages, task transitions, work updates/photos, payslip download, restart persistence and cross-account isolation). The earlier full browser regression is also retained.

## Public website pages and motion

The public header is larger and links to separate Home (`index.html`), About Us (`about.html`), Services (`services.html`), Projects (`our-projects.html`) and Contact (`contact.html`) pages. The public Projects filename intentionally differs from the protected Admin `projects.html` route.

Company Administration was removed from the header and remains in the footer. The footer's About/Services/Projects/Contact navigation group was removed. Every public page shares the logo, active navigation, language selector and footer. The consultation form is on Contact; other pages link to it.

Page entry/exit, scroll reveals, card hover and subtle construction-art motion work across the public pages. Reduced-motion preferences disable animation and smooth scrolling. The keyboard skip link focuses main content; mobile navigation supports Escape, and sticky-header offsets adapt to the actual header height. Content remains visible without animation support.

Validated with `python tests/check_public_browser.py`: five page routes, enlarged header and footer cleanup, active navigation, scroll reveals, navigation transitions, keyboard skip, Tamil/Sinhala/English persistence, contact submission storage, mobile layout/menu and reduced motion. The 13 server regression tests also pass.

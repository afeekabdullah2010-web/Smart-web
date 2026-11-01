# Smart Power Engineering Works

Public website and complete Admin/Staff application for Netlify, with managed Postgres and private image storage. The local Python/SQLite version is retained under `i/outputs/smart-power-dashboard`.

[Deploy to Netlify](https://app.netlify.com/start/deploy?repository=https://github.com/afeekabdullah2010-web/Smart-web&branch=main)

## Deploy the complete application

1. Import this repository in Netlify using the link above, or **Add new project → Import an existing project → GitHub → Smart-web**. Leave the base directory empty. The root `netlify.toml` sets the build command and `dist/site` publish directory automatically.
2. Set `SMART_POWER_SETUP_KEY` to a new private random value of at least 24 characters. It must be available to **Functions**. The deploy-template prompt can collect this value; confirm its scope in Environment variables before deploying. Do not put the value in GitHub or share it in chat.
3. Deploy. `@netlify/database` provisions managed Postgres and the committed SQL migration is applied by Netlify before publishing. Netlify Database requires an eligible Credit-based plan; if Netlify reports that the database is unavailable for the account, resolve the plan/account requirement in Netlify before continuing. No paid plan is changed by this repository.
4. On the deployed domain open `/auth/setup`, enter your private setup key and create the first Admin account. This route closes once an Admin exists. Admin can create Staff accounts; public Create account always creates Staff.
5. Sign in and create records. Local SQLite accounts/data are not automatically copied to the new hosted database. Your local database remains unchanged.

Do not drag-and-drop the old project folder: that does not deploy functions or provision the database. Use Git-connected deployment for this complete application.

## What is connected

- Server-verified Admin/Staff login, registration, 12-hour Secure/HttpOnly sessions, CSRF checks and role guards.
- Projects, Team, clients, inventory, invoices, internal notifications, settings and CSV exports in Postgres.
- Private profiles, owner-scoped photos/signatures, attendance, assigned tasks, work updates, payroll and printable/downloadable payslips.
- Public contact, service and career enquiries saved in the same database for Admin follow-up. Netlify Forms is not used by the complete-app build.
- Uploaded images use Netlify Blobs behind authenticated file endpoints. Each image is limited to 3.5 MB. Photo and signature are uploaded separately to stay within function request limits. Production and preview file stores are isolated.
- Only public HTML/assets are in `dist/site`. Protected HTML is packaged as a server module and returned only after authentication. SQLite, Python source, tests and development files are excluded from the published directory.

The database connection is supplied by Netlify, not embedded in browser code. No existing online database is reset or seeded by the application. Never edit a migration after it has been deployed; add a new migration instead.

## Recheck locally

```bash
npm ci
npm run build
python3 scripts/check_netlify.py
npm test
python3 -m unittest discover -s i/outputs/smart-power-dashboard/tests
```

`npm test` exercises the hosted backend against a real isolated PostgreSQL-compatible engine (PGlite), including role/CSRF guards, registration, private 3.5 MB uploads, every Admin CRUD workspace, public enquiries, payroll, tasks, support and attendance. It uses temporary data only.

For browser checks, install Playwright/Chromium and run:

```bash
python3 tests-netlify/browser.py
```

This runs the built website over local HTTPS with the hosted-style backend, persistent test Postgres and private test files. It checks authentication, Team data, downloads, uploads, attendance/tasks/payroll and restart persistence. It requires OpenSSL to create a temporary local test certificate. Existing public, company, profile and Staff browser suites remain under the source project's `tests/` directory.

## Hosting notes

The initial Netlify build and live database provisioning must complete before the online app is usable. A successful local test is not confirmation that a production deployment has finished. Check the Netlify deploy log and test login/enquiry submission on the actual live domain after deploying.

Netlify static response headers are configured in `netlify.toml`; function responses set their own cache/security headers in code. Site-link metadata (`.netlify/`), generated private templates, dependencies, build output and environment files are gitignored.

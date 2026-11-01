# Smart Power Engineering Works

Public website and complete Admin/Staff application for Netlify, with external PostgreSQL and private image storage. The local Python/SQLite version is retained under `i/outputs/smart-power-dashboard`.

[Deploy to Netlify](https://app.netlify.com/start/deploy?repository=https://github.com/afeekabdullah2010-web/Smart-web&branch=main)

## Connect external PostgreSQL and deploy

The Netlify account used by this project does not provide Netlify Database. This version uses **Neon or another hosted PostgreSQL provider** through `DATABASE_URL`; it does not request a Netlify database or require a Netlify Database plan.

For the already-created Netlify project `smpowenginnworks`:

1. Create a PostgreSQL project at [Neon](https://console.neon.tech/). Use a new empty database for Smart Power. Open **Connect** and copy the PostgreSQL connection string from your chosen database/role. A pooled connection is suitable for the app. Do not copy a JavaScript example or a `psql` command; copy only the `postgresql://...` URL.
2. In Netlify → Environment variables, add **`DATABASE_URL`** with that private URL. Select **Contains secret values** and ensure it is available to both **Builds** and **Functions**, in the production context. A site variable scoped only to Builds is not available to Functions. Do not paste the value into GitHub, screenshots or chat.
3. Keep the existing **`SMART_POWER_SETUP_KEY`** unchanged and available to Functions. Retry the production deploy after saving the new variable. The root config runs the public build and then the external schema migration before publishing. Tables are created once; later deploys check migration checksums and preserve existing records.
4. After a successful deploy, open `/auth/setup`, enter your private setup key and create the first Admin account. This route closes once an Admin exists. Admin can create Staff accounts; public Create account always creates Staff.

The committed migrations are under **`database/migrations/`**, outside Netlify's auto-provisioning directory. The `@netlify/database` package has been removed. Your existing local SQLite database remains unchanged; its users/data are not automatically copied to the new external database.

A manual first deployment from a new account can use the deploy link above. The build command and `dist/site` publish directory are in `netlify.toml`; leave base directory empty. Do not drag-and-drop the old project folder: that does not deploy the backend function.

### Migrations and preview isolation

`node scripts/migrate-postgres.mjs` applies pending migrations in a transaction, uses a migration lock, records checksums and rejects changed/missing/out-of-order applied migrations. It never resets existing application data. With `--netlify-build`, migrations run only for production deploys; preview builds never migrate a production database.

The online company function is disabled on previews unless `SMART_POWER_PREVIEW_DATABASE=isolated` is explicitly set and an independent preview `DATABASE_URL` is supplied for that context. Initialise that separate database using the migration command before testing the preview. Do not reuse the production database for preview tests.

The database driver enforces TLS with certificate verification. Standard Neon PostgreSQL URLs with `sslmode=require` are accepted; custom client-certificate configurations need separate setup.

## What is connected

- Server-verified Admin/Staff login, registration, 12-hour Secure/HttpOnly sessions, CSRF checks and role guards.
- Projects, Team, clients, inventory, invoices, internal notifications, settings and CSV exports in external PostgreSQL.
- Staff registration, profile changes, attendance, work/task updates and support requests notify Admin. Staff receive private in-app notifications for their assigned tasks, issued payslips, office replies and account/profile updates, with read status and a 30-second unread-count refresh. Notifications are restricted by the signed-in user ID.
- Private profiles, owner-scoped photos/signatures, attendance, assigned tasks, work updates, payroll and printable/downloadable payslips.
- Public contact, service and career enquiries saved in the same database for Admin follow-up. Netlify Forms is not used by the complete-app build.
- Uploaded images use Netlify Blobs behind authenticated file endpoints. Each image is limited to 3.5 MB. Photo and signature are uploaded separately to stay within function request limits. Production and preview file stores are isolated.
- Only public HTML/assets are in `dist/site`. Protected HTML is packaged as a server module and returned only after authentication. SQLite, Python source, tests and development files are excluded from the published directory.

The database connection is supplied by the private DATABASE_URL environment variable, not embedded in browser code. No existing online database is reset or seeded by the application. Never edit a migration after it has been deployed; add a new migration instead.

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

The external database must exist, DATABASE_URL must be configured, and the initial Netlify build/migration must finish before the online app is usable. A successful local test is not confirmation that a production deployment has finished. Check the Netlify deploy log and test login/enquiry submission on the actual live domain after deploying.

Netlify static response headers are configured in `netlify.toml`; function responses set their own cache/security headers in code. Site-link metadata (`.netlify/`), generated private templates, dependencies, build output and environment files are gitignored.

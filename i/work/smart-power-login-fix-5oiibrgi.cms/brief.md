# Smart Power Engineering Works — Login Repair

## Objective
Diagnose and fix the user-reported non-working login flow in the existing standalone Smart Power Engineering Works web prototype. The solution must work when `index.html` is opened locally by double-clicking in a mainstream Windows browser, not only from a dev server.

## Existing output
`C:/Users/ranza/Documents/Codex/2026-07-29/i/outputs/smart-power-dashboard/`

## Required behaviour
- The sign-in form must reliably respond to both button click and Enter key.
- For the static demo, any non-empty valid-looking email plus password should sign in, visibly show the dashboard, and save demo session state. Clearly show useful inline validation for blank fields rather than failing silently.
- Demo Google sign-in must also work reliably and enter the dashboard.
- Create-account must show/submit reliably, validate required fields, show errors in the UI if missing, and enter dashboard when complete.
- Avoid fragile `localStorage` assumptions: wrap storage access in a safe fallback that lets the current tab function even if local file storage is restricted.
- Do not use form default submission that reloads the file unexpectedly. Prevent default explicitly.
- Ensure dashboard must not remain hidden due to stale state. Add a small, visible reset/demo-session control on login if appropriate.
- Retain current branding, existing tabs/pages, settings and user management.

## Deliverable
Patch the existing prototype in place. Verify source wiring and interaction logic carefully; report the likely original cause and exact resolution.

# Smart Power Engineering Works — Role Dashboards & Entry Repair

## Objective
Repair the standalone local prototype so a new app launch reliably begins on the login page (never immediately exposes the dashboard), then routes users to a clearly different experience based on their selected role: Admin, Staff, or Client.

## Existing output
`C:/Users/ranza/Documents/Codex/2026-07-29/i/outputs/smart-power-dashboard/`

## Critical app-entry behaviour
- Opening `index.html` should always display the login screen initially, even if an earlier demo session exists. Do not auto-bypass login from old storage.
- After a successful sign-in/create-account/demo Google sign-in, route to the appropriate role dashboard (or reveal the appropriate role dashboard reliably).
- Sign out must clear current session and show login.
- Since this is a static local demo, use honest demo wording and safe storage fallback. Do not claim real Google OAuth.

## Admin experience
Admin has full company control and uses the existing premium control-centre dashboard, with access to:
- All projects, staff, attendance, salary overview, materials, finance, clients, reports, users/settings.
- Add/update project controls and prominent alerts: approvals, overdue payment, low stock.
- Maintain all existing rich admin page links. Sidebar must clearly identify the user as Admin.

## Staff experience
Create a dedicated staff dashboard/page (e.g. `staff-dashboard.html`) that does NOT show admin finance/user controls. It must include:
- Today’s attendance: check-in/out or status, total hours, weekly attendance calendar/summary.
- Salary detail: current month salary, paid amount, pending amount, recent payslip/payment history.
- Assigned project(s), today’s task list, safety/site notices and work-update action.
- A concise personal profile/settings link and sign out.

## Client experience
Create a dedicated client dashboard/page (e.g. `client-dashboard.html`) focused only on that client’s project:
- Project name, location, progress percentage/milestone timeline, current status and recent site updates/photos placeholders.
- Payment summary: contract value, amount paid, pending amount, next due date, payment history and a clear payment action with demo feedback.
- Project maps: a meaningful project-location map panel using a CSS/inline SVG schematic or local static visual; do not rely on Google Maps network embeds.
- Documents/approvals and contact-project-team actions with feedback. No access to employees, other projects, overall company finance or user management.

## Login/UI changes
- Make role choice unambiguous in create account and provide role demo shortcuts/labels if helpful for testing.
- The sign-in login screen should offer a visible role selector (Admin, Staff, Client) for the static demo so the user can test each dashboard. It should remain professionally branded, not a hacky debug control.
- Login form button and Enter must work. Empty fields show validation errors.

## Design
Preserve Smart Power brand: deep navy, electric blue, white/ice surfaces, high-quality responsive UI. Each role must feel tailored to its user and visibly different in navigation plus content, while remaining coherent in brand.

## Technical requirements
- Plain linked HTML/CSS/JS only; must work when double-clicking local `index.html`.
- Use `apply_patch` for edits.
- Keep existing admin pages intact and properly secured from staff/client menu flows.
- Add visible feedback to demo actions.
- Verify links and all three role paths carefully.

# Smart Power Engineering Works — Functional Page Expansion

## Objective
Extend the existing premium standalone dashboard into a multi-page clickable admin prototype. Every sidebar navigation tab must lead to a dedicated page, not an inert placeholder. Retain the current dashboard as the Overview home page.

## Existing deliverable
- Root: `C:/Users/ranza/Documents/Codex/2026-07-29/i/outputs/smart-power-dashboard/`
- Existing home: `index.html`
- Existing logo: `assets/smart-power-logo.png`
- Preserve the navy/electric-blue premium engineering visual system and shared responsive layout.

## Required pages and content
Create real linked pages for these sidebar items:
- `projects.html` — project portfolio, project status cards, search/filter controls, project list with budget/progress/type (residential & commercial), and "New project" action with lightweight visible feedback.
- `team.html` — team directory, attendance summary, on-site/off-site status, roles, and a weekly attendance panel.
- `materials.html` — materials inventory, low-stock alerts, supplier snapshot, stock progress, requisition action with visible feedback.
- `finance.html` — financial summary, income/expense/budget cards, cash-flow graphic, pending invoice list, payment status.
- `clients.html` — client directory, project association, payment/approval status, client message action with visible feedback.
- `reports.html` — report centre: project progress, financial summary, material usage and team attendance report cards, date range selector, and downloadable/report-generation feedback state.

The existing Overview page should have every navigation link wired to these pages. Each new page must have the same sidebar/top header, the selected navigation state, working `Overview` link back to `index.html`, and a responsive mobile nav. Use the existing logo local asset. All side-nav links must work consistently on every page.

## UX standard
This is a static front-end prototype, so actions do not need a backend. However, every primary action must visibly react: a concise toast, modal, or inline confirmation is enough. Buttons must never look clickable while doing nothing. On mobile, avoid cramped desktop tables: turn relevant rows into easily readable stacked cards or horizontally manageable summaries.

## Aesthetic and technical constraints
- Keep the purposeful premium engineering-control-room look: white/ice-blue workspace, deep navy sidebar, electric blue highlights, restrained amber alerts, architectural/blueprint motifs where appropriate.
- No remote images, icon libraries, or build system. Use inline SVG/CSS simple icons and the bundled local logo.
- Keep all output in `C:/Users/ranza/Documents/Codex/2026-07-29/i/outputs/smart-power-dashboard/`; do not remove current assets.
- Implement as plain linked HTML/CSS/JS pages. Shared CSS/JS files are encouraged to avoid duplication, but the pages must be double-click runnable.

## Quality bar
Make each page content-specific and substantial: no cloned generic card grid. Keep information scannable and professionally structured. The prototype should demonstrate a believable complete admin system for Smart Power Engineering Works.

## Added authentication and account-management requirements
- The default entry (`index.html`) must open to an authentication view before the dashboard. Provide email/password sign-in and a visually prominent Google sign-in choice. This is a static demo, so label any simulated Google option honestly and provide clear feedback rather than implying real OAuth.
- Add a create-account path for users without an account. It should collect a name, email, password and a role choice (Client, Staff, Admin), then enter the dashboard in a believable demo state.
- Persist a simple demo signed-in state locally if useful. App pages must not silently expose the dashboard before sign-in; redirect/return to the login state when unauthenticated. Provide a Sign out control.
- Add an editable Profile & User Administration page. It must include editable profile/company fields and a management list for users with roles (Admin, Project Manager, Engineer, Staff, Client), plus add/edit/deactivate controls and visible confirmation feedback.

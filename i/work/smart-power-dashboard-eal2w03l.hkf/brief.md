# Smart Power Engineering Works — Premium Dashboard

## Objective
Create a polished, self-contained, responsive web-dashboard mockup (`index.html`) for Smart Power Engineering Works. It is the administrator's project-control home, used by a construction company serving both residential and commercial projects. The page must also look excellent on a narrow mobile screen.

## Audience
Construction-business owner, office administrator, engineers, and project managers. Clients will eventually have a separate portal; this first screen is the internal admin overview.

## Brand inputs
- Company: Smart Power Engineering Works
- Address: 2/3, Sinna Aalim Road, Nintavur-15, 32340
- Phone: 077 358 7109
- Logo source supplied by user: `C:/Users/ranza/Downloads/SMART POWER.png`
- Email is intentionally omitted for now.

## Aesthetic direction
Use a confident, premium engineering-control-room aesthetic: bright white canvas, a deep midnight/navy navigation rail, strong electric-blue data highlights, restrained ice-blue surfaces and rounded cards. Avoid a generic template feel. The supplied logo has a white background and large vertical composition; crop/display it thoughtfully in the sidebar header so it feels intentional, not enormous. Use softly architectural dividers, crisp spacing, subtle shadows, and a single orange/amber warning accent only when useful.

## Typography
Use a modern high-legibility sans-serif system stack or an appropriate web font if it remains usable offline. Strong compact headings; clean readable tables and labels. English UI is appropriate in this admin dashboard.

## Color direction
- Navy: #071C33
- Electric blue: #078EE8 / #0AA4F6
- Ice surface: #F4F8FC
- White: #FFFFFF
- Text: #15243A
- Optional alert amber: #F7A928

## Content structure
Build one rich dashboard screen with:
1. Collapsible-feeling left navigation: logo, "Control Centre", overview selected, Projects, Team, Materials, Finance, Clients, Reports, plus a support card and compact user profile.
2. Top header: breadcrumb/title "Project Overview", current-day date, notification icon/badge, and a clear "New project" button.
3. Welcome/summary area with a blue hero panel: "Good morning, Abdul" and a compact company/portfolio summary. Use an abstract architectural line/blueprint motif made in CSS — do not use external imagery.
4. Four KPI cards: Active Projects (12), Completion Rate (78%), Pending Approvals (8), Total Budget (LKR 84.6M). Give each a subtle icon treatment and meaningful comparison text.
5. Main content: "Live projects" panel/table with four realistic project rows, location/type, progress bar, due date, lead engineer, and status. Include a link or button for all projects.
6. Right-side "Today on site" vertical agenda and a concise "Action required" panel with two approvals.
7. Lower row: budget-spend chart made in CSS/SVG, material stock card, and an "Activity" feed.
8. A client-ready polished visual hierarchy. Do not make it overly dense.

## Interaction and technical needs
- Deliver exactly `C:/Users/ranza/Documents/Codex/2026-07-29/i/outputs/smart-power-dashboard/index.html`, with any local assets under `.../assets/`.
- Make sidebar and desktop grid responsive; on phone, sidebar becomes a top compact brand bar and columns stack elegantly.
- Include only lightweight inline JavaScript for interaction if useful (e.g. mobile nav and date/filter state); no build tooling or server is needed.
- Do not depend on remote images, icon libraries, or external assets except any font loading only if a graceful offline fallback exists. Use inline SVG for simple interface icons.
- Copy the provided logo to the output assets folder if needed; handle it without breaking if it cannot be read.

## What makes it memorable
The blue welcome panel should include an elegant CSS blueprint/structural-grid motif and the dashboard should feel tailored to a real engineering firm rather than a reusable admin template.

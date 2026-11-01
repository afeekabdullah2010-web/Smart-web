# Smart Power Engineering Works — Public Company Website + Hidden Admin Entry

## Objective
Transform the primary entry point into a premium public-facing company website for Smart Power Engineering Works. When a visitor opens the root `index.html`, they must see the company website first — never an application login/dashboard.

## Existing output
`C:/Users/ranza/Documents/Codex/2026-07-29/i/outputs/smart-power-dashboard/`

## Public website requirements
Create a polished multi-section responsive company site under the Smart Power brand (blue/white/navy), using the supplied local logo. Its fixed/top navigation must visibly support all website sections/pages so users always know where to go:
- Home
- About Us
- Services
- Projects
- Contact

Use either distinct linked pages or a single-page website with reliable section links. If sections are used, nav should remain consistent and every link must work.

Content:
- Home hero: company name, short construction/engineering value proposition, prominent Request a Consultation and Explore Projects actions.
- About: local company identity, address: 2/3, Sinna Aalim Road, Nintavur-15, 32340; phone: 077 358 7109.
- Services: residential construction, commercial construction, structural / engineering works, renovations and project management.
- Projects: showcase cards for residential and commercial examples, with clear project status / quality cues.
- Contact: phone, address, consultation form that gives honest local-demo feedback (no email is currently provided; do not invent one).
- A clean CTA to a Client/Staff portal is okay, but do not expose any Admin item in visible main navigation.
- Provide high-end constructed-environment visuals with CSS/inline visual treatments or locally generated/simple placeholders; do not use external image URLs.

## Hidden admin flow
Admin must not be shown in normal navigation. In the footer, include an intentionally subtle text link called `Hidden`.

Click flow:
1. Clicking `Hidden` opens a polished restricted-area warning state/modal saying: `Restricted area. Please go back if you are not authorised.`
2. It must provide a clear continue action such as `I understand the risk`, and a back/cancel action.
3. Continuing reveals a password form with password field and a clear `Open Admin Control Centre` action.
4. For this local demo only, password `1980` grants access. Invalid entries must show inline error. Correct entry must open the admin control page.
5. The existing admin role dashboard should remain accessible after password success. Rename/move/wire it sensibly (e.g. `admin.html`) because root `index.html` is now the public website.
6. Admin dashboard must have working sign-out/back-to-website behaviour. Preserve Admin's full management pages.

## Important security disclosure
This is only a static demo. A password embedded in client HTML/JS is not real security. Add a small non-intrusive note in the admin/implementation or a code comment if appropriate; do NOT make alarming public website copy. Do not claim real protection. A deployed site needs a server-side authentication service with hashed passwords.

## Existing role portals
Preserve Staff and Client dashboards. Ensure direct page opening cannot casually bypass the public site's hidden admin requirement. Add normal public website buttons that can navigate to client/staff portal only if useful, but do not expose admin.

## Technical requirements
- Plain HTML/CSS/JS, compatible with double-click local browser opening.
- Use safe local storage fallbacks if storage is blocked.
- Use apply_patch for edits.
- All buttons need meaningful navigation or visible feedback.
- Keep visual system cohesive, responsive, modern, and premium.

## Deliverables
Modify public entry in place, add any sensible separate public pages/shared CSS/JS, and ensure existing app links are migrated/wired. Do not delete the role dashboards.

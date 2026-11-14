# Smart Power for Windows

Windows 10/11 x64 installer for the existing Smart Power Client, Staff, Guest and Admin application. It uses the same live backend and secure sign-in cookies as the mobile app.

## Shared with the phone app

The Windows renderer imports `Welcome.tsx` and `Dashboard.tsx` directly from `mobile/src/components`, including Guest company browsing and the Admin People list. Account routing, download policy and the in-page bridge also build directly from the phone sources. There is no copied second set of account/dashboard screens. `MobileShell.web.tsx` supplies the Windows window adapter; the Android/iPhone shell remains in `MobileShell.tsx`.

The Windows build workflow runs whenever `mobile/**` or `desktop/**` changes on main. Each build records shared file hashes and its commit in `runtime/shared-source.json`. Live account/data/backend updates appear in both applications. Screen code is packaged in the Windows EXE: install the newer installer to update existing Windows installations. This version does not silently auto-update or publish installers to a public release feed.

## Download the EXE

In GitHub, open **Actions → Build Windows EXE → latest successful run → Artifacts → Smart-Power-Windows**. Download and extract the ZIP, then run `Smart-Power-Setup-<version>.exe`. The installer supports per-user installation, a desktop shortcut and Start menu entry. It is separate from the Android APK and iPhone build.

The workflow may also be started manually using **Run workflow**. It runs a real Electron welcome/preload smoke test on Windows before creating the installer. GitHub retains the download artifact for 30 days. The installer is unsigned until the owner configures a Windows code-signing certificate; no signing credentials are stored in this repository.

## Build on a Windows computer

Install Node.js 24, then from the repository root:

```sh
npm ci --prefix mobile
npm ci --prefix desktop
node desktop/node_modules/electron/install.js
npm run prepare:ui --prefix desktop
npm test --prefix desktop
npm run smoke --prefix desktop
npm run dist:win --prefix desktop
```

Find the installer in `desktop/release/`. `npm start --prefix desktop` runs the prepared application. The runtime download and Windows packaging need access to the official Electron/electron-builder downloads. Native executable smoke tests run on Windows; renderer browser tests also run locally with `python3 desktop/tests/ui-browser.py` after preparing the UI.

## Desktop isolation

The packaged UI uses a local secure protocol and a narrow context-isolated preload API. The company workspace runs in a separate sandboxed WebContentsView without Node integration or a filesystem preload. Only the configured company HTTPS origin stays inside that view. External HTTPS links require confirmation; file, JavaScript and other app-launch schemes are blocked. Role and customer ownership remain enforced by the server.

CSV/payslip saves require the user's save dialog and only accept the existing report/payslip endpoints. Camera access requires a native prompt. Passwords and CSRF tokens stay in the company browser session; only sanitized session/dashboard messages reach the shared renderer. The app needs internet access for company records.

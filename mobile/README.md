# Smart Power mobile

Android and iPhone app for customers, Admin and Staff, connected to https://smpowenginnworks.netlify.app. Expo project: `46643a71-a257-4649-b510-18b21a89fbfd`.

The native shell provides Home, Services, Projects, Contact and Workspace tabs. A single cookie-persistent WebView uses the existing website and PostgreSQL accounts, so there is no separate mobile database or password storage. Website content, roles, attendance, tasks, uploads, payslips, support replies and private in-app notifications use the same server authorization as the website. Company pages retain the website's English/Tamil/Sinhala selector.

The app adds safe-area layout, native back navigation, offline/retry handling, external browser/call/email links, native document sharing and payslip printing. CSV and payslip downloads fetch inside the authenticated website session before sharing a temporary file. Private files are removed from the app's cache when sharing closes. Only the configured HTTPS origin can load inside the app; external web links ask before opening in the browser.

## Run and verify

Use Node.js 24 LTS. From this directory:

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run export
npm start
```

The export command generates Android and iOS JavaScript/Hermes bundles in `dist/`. These bundles are not an installable APK or IPA. The application needs internet access for company data. Existing site notifications refresh while the app is open; operating-system push notifications have not been added.

`npm start` starts the development server. Run a development build on your device or simulator using the compatible Expo tooling. Native modules may require a development build rather than Expo Go. `npm run android` needs an Android SDK; `npm run ios` needs macOS/Xcode. `npm run prebuild` generates native projects from `app.json`; generated `android/` and `ios/` folders are not committed.

## Build installable apps with Expo

The Expo project ID is already set in `app.json`. Sign in as a member of that project; never commit Expo tokens, database URLs, setup keys or signing credentials.

Connect GitHub repository `afeekabdullah2010-web/Smart-web` in the Expo project dashboard. **Set the app/base directory to `mobile`**, not the repository root. The website's root package is a different application.

From a computer terminal, these equivalent commands run builds:

```sh
npx eas-cli@latest login
npx eas-cli@latest project:info
npm run build:android
```

Choose profile **preview** and platform **Android** for an installable APK. The first Android build can generate a signing keystore in the owner's Expo account. Download the APK from the completed build in Expo and install it on the test phone. Cloud build quota and account plan apply.

For iPhone:

```sh
npm run build:ios
```

The **preview** profile is an internal-device build. Apple requires a developer account, signing and registered devices for this distribution. Follow Expo's device registration/signing flow using the account owner's credentials in Expo. The **simulator** profile can produce a build for an iOS simulator on a Mac; it cannot install on a physical iPhone.

The **production** profile creates a store Android App Bundle or signed iOS app; production/store submission is a separate step. Before submission, verify the bundle/package identifiers, privacy disclosures, account-deletion arrangements for public signup, and store metadata. No APK/IPA has been signed or uploaded to stores by this source change.

## Site URL and device testing

`src/navigation.ts` defaults to the live site above. An optional build-time `EXPO_PUBLIC_SITE_URL` must be a single HTTPS origin without a path or credentials. It is public configuration. No backend secret belongs in the mobile application.

Before distribution, test on an Android phone and iPhone: customer contact request, Staff signup/login/logout, Admin login, session expiry, gallery/photo uploads, attendance and task updates, native CSV sharing, payslip printing, notification ownership, back navigation, keyboard and offline recovery. The automated checks cover source types/lint, route/origin/download policy, the WebView bridge, native project generation and both platform bundle exports; they do not replace signing and physical-device tests.

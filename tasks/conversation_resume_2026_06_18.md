# TrainWise — conversation resume (2026-06-15 → 2026-06-18)

Continuation of the coach-analytics/forecast work. This session was mostly
bug-fixes, an Azure re-deploy, two new features, and APK rebuilds. (ADB/USB
detection troubleshooting is intentionally omitted — it led nowhere useful;
sideload-over-MTP is the working install path.)

## Backend moved back to Azure
- The user **re-published the C# API + SQL to Azure** with a NEW URL:
  `https://trainwise01-api-djcfcvcedth8hjgp.israelcentral-01.azurewebsites.net`
  (project/Cloud console project is `test01-496711`). This supersedes the old
  documented Azure URL (`trainwise-api-fuaahua…`).
- Both axios clients now point there: `BASE_URL`/`API_BASE_URL =
  '…azurewebsites.net/api'` in [api/api.js](../TrainWiseExpo/src/api/api.js) and
  [services/api.js](../TrainWiseExpo/src/services/api.js). Endpoint paths must NOT
  re-add `/api`.
- **The Python ML service is NOT on Azure** — still local (`ml/app.py`, port 8000,
  `mlApi.js` carries the PC LAN IP). So the coach Analytics/forecast screen only
  works when the PC service runs and the phone is on the same WiFi; otherwise it
  shows the "analytics offline" fallback. User chose to eventually deploy the ML
  service to Azure **App Service F1 (free)** — that requires rewiring `ml/db.py`
  from pyodbc+Windows-auth to **pymssql + Azure SQL (SQL auth)**; not done yet.

## Bug fixes (all JS)
- **Coach trainee week was a rolling Tue→Mon window.** Switched
  `buildTraineeWeek` in [CoachTraineeDetailScreen.js](../TrainWiseExpo/src/screens/CoachTraineeDetailScreen.js)
  to the shared `getWeekStartDate()` so it matches Home (calendar Sun–Sat).
- **Health Connect workout times were 3h early.** Backend returns SQL `datetime`
  with NO timezone (`"2026-06-15T10:42:28.313"`); the stored instants are UTC, but
  `new Date()` read them as device-local (Jerusalem +3). Added
  [utils/serverDate.js](../TrainWiseExpo/src/utils/serverDate.js) `parseServerDate()`
  (appends `Z` when no zone) and used it in GoogleFitScreen + the coach drill-down.
- **Add Workout: couldn't see typed text** — no keyboard handling. Wrapped in
  `KeyboardAvoidingView` + `keyboardShouldPersistTaps` like CoachTraineeDetail.
- **Bottom tab bar overlapped by the Android 3-button nav bar.** Added
  `useSafeAreaInsets()` to the tab bar in
  [NavigationStack.js](../TrainWiseExpo/src/navigation/NavigationStack.js):
  `height: 60 + insets.bottom`, `paddingBottom: insets.bottom + 5`.

## New features merged from teammate files (added only the missing parts)
- **Onboarding tutorial**: created [components/OnboardingOverlay.js](../TrainWiseExpo/src/components/OnboardingOverlay.js)
  + [utils/onboardingManager.js](../TrainWiseExpo/src/utils/onboardingManager.js)
  (clean emoji — teammate's paste had mojibake), wired into HomeScreen
  (focus-effect check + `<OnboardingOverlay>`), and added the "🔄 Reset Tutorial"
  row + `resetOnboarding` import to the (newer/themed) SettingsScreen.
- **Sign-up reCAPTCHA**: added the captcha-only pieces to
  [SignUpFinal.js](../TrainWiseExpo/src/screens/SignUpFinal.js) — `WebView` import,
  `RECAPTCHA_SITE_KEY`/`RECAPTCHA_HTML`, `captchaState`/`captchaToken`, `canSubmit`
  now requires `captchaState === 'verified'`, the WebView block above Done, and the
  white `recaptchaContainer`/`recaptchaInline` styles. Client-side gate only (no
  server verification, matching the teammate). **`react-native-webview` was in
  package.json but NOT installed** — `npx expo install react-native-webview` fixed
  the bundle error before the build would succeed.

## Maps blank-tile fix (the important one)
- Map showed only the beige grid + Google logo. Root cause: the prebuilt
  `android/app/src/main/AndroidManifest.xml` had the **OLD** Maps key
  (`AIza…asCU`) hardcoded, while `.env` had the **NEW** key (`…LjJsqs`). Local
  gradle builds read the key from the **native manifest, not `.env`/app.config.js**,
  so every APK shipped the stale key. (`android/` is gitignored, so editing the
  manifest doesn't commit the key.) Synced the manifest to the `.env` key →
  rebuilt → map works. Weather/Air-Quality worked the whole time because they read
  the key from the JS bundle (which does evaluate `.env`).

## SQL data export
- Added [ml/export_inserts.py](../ml/export_inserts.py) → writes
  [sql/full_data_insert.sql](../sql/full_data_insert.sql): plain INSERT statements,
  dependency-ordered (parents first), `SET IDENTITY_INSERT` per identity table.
  Run from `ml/`: `./venv/Scripts/python.exe export_inserts.py`.

## Updated PDF spec
- The original `Python Course ML/TrainWise_Smart_Injury_Prevention.pdf` is an
  image-only slide deck (no editable text), so generated a fresh companion:
  `TrainWise_Smart_Injury_Prevention_Updated.pdf` via
  `Python Course ML/build_updated_spec.py` (reportlab) covering the implemented
  forecast feature, PMC/ACWR, the two ML tasks, deployment, and a changelog.

## APK build reality
- Release JS-bundle step **OOMs at Node's default heap**. Build with:
  `cd TrainWiseExpo/android && NODE_OPTIONS=--max-old-space-size=8192 ./gradlew
  assembleRelease --no-parallel` (8 GB is build-time RAM only, NOT in the APK; the
  APK stays ~125 MB). The 8192 is heap on the PC, not app size.
- Install path that works without adb: build APK → copy
  `android/app/build/outputs/apk/release/app-release.apk` to the phone's **Download**
  folder over MTP (File Explorer) → tap to install (same signing key → in-place
  update, data preserved). The APK is also copied to `C:\Users\liron\Desktop\TrainWise.apk`.
- Verifying features in a Hermes APK: the bundle is **Hermes bytecode**; strings
  containing emoji are stored as UTF-16, so an ASCII `grep` for them returns 0 even
  when present. Verify with pure-ASCII strings (e.g. captcha site key `6LcAKyYt`,
  `trainwise01-api`, `This is your dashboard`).

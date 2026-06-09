# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two cooperating projects in one folder, no shared root package manager:

- **`TrainWise/`** — ASP.NET Core 8 Web API (the backend). Open `TrainWise.sln` in Visual Studio 2022 and run with the green play button (Swagger opens at `https://localhost:5249/swagger`). Uses raw ADO.NET (no EF Core) against SQL Server Express.
- **`TrainWiseExpo/`** — Expo (React Native 0.81 / RN New Architecture) mobile app. Installed as APK on a Samsung Galaxy S25+ for testing — the iOS folder is not maintained. JavaScript only, no TypeScript despite the `tsconfig.json`.

## Backend deployment modes

The project supports **two backend modes**. Switching between them is a config change, not a code change. As of 2026-06-06 the project is in **Local LAN mode** because the Azure subscription was disabled when the student credit ran out — Azure mode stays fully documented below in case the subscription is reactivated or migrated.

### Mode A — Azure App Service (the original / preferred long-term setup)

Backend hosted at `https://trainwise-api-fuaahuamcpbxgmeb.israelcentral-01.azurewebsites.net`, Azure SQL at `trainwiseadmin.database.windows.net` / `TrainWiseDB`. Both axios clients point directly at the public URL. Phone reaches the backend over the public internet — no LAN, no firewall, no PC-needs-to-be-on. **As of 2026-06-06 the Azure subscription is DISABLED** (Azure-for-Students $100 credit exhausted at $59.84 actual + $206.97 forecast). To reactivate, add a credit card via portal → Subscription → Upgrade, then immediately scale `trainwisedb` to General Purpose Serverless (max 1 vCore, min 0.5, 1h auto-pause, 2GB storage, locally-redundant backup) to keep ongoing cost at ~$1-3/month.

**BASE_URLs** (both files):
```
const BASE_URL = 'https://trainwise-api-fuaahuamcpbxgmeb.israelcentral-01.azurewebsites.net/api';
```
- [src/api/api.js](TrainWiseExpo/src/api/api.js)
- [src/services/api.js](TrainWiseExpo/src/services/api.js)

**Backend `appsettings.json`** — the local JSON connection string is ignored at runtime in Azure because Azure App Service injects the value via the `Connection strings` blade (Configuration → Connection strings, name=`DefaultConnection`, type=`SQLAzure`). `DBservice.Connect()` reads via `IConfigurationRoot` with `.AddEnvironmentVariables()`, so the App Service value wins over JSON.

**Publishing backend changes (Azure mode)**: open `TrainWise.sln` in VS 2022 → right-click TrainWise project → **Publish** → press **Publish** on the existing profile. Azure App Service auto-restarts on deploy.

**Azure config that must stay correct**:
- **Azure SQL Networking** → "Allow Azure services and resources to access this server" = ON. Without it the App Service cannot reach the DB.
- **Swagger enabled in production** (not gated by `IsDevelopment()` in [Program.cs](TrainWise/TrainWise/TrainWise/Program.cs)) so `/swagger/index.html` works on the Azure URL for ad-hoc debugging. Cold starts on Free F1 take 10-30s after 20min idle.
- **Profile pictures** (`/api/users/{id}/upload`) write to `wwwroot/images` which on Azure may not survive App Service restarts. Migrate to Azure Blob Storage or a persisted disk at `D:\home\data\images` if persistence becomes a problem.

**Diagnosing 4xx/5xx (Azure mode)**: `App Service → Monitoring → App Service logs → Application logging (Filesystem) = On (Level: Information)`. Then `Log stream` shows incoming requests + exceptions live. Controllers return `BadRequest(ex.Message)` — the actual error is in the response body, NOT the log stream (the stream only shows the status code). Check both.

### Mode B — Local LAN (current as of 2026-06-06)

Backend runs in VS 2022 on the user's PC, SQL on the same PC's SQL Express, phone reaches the API over WiFi. **Zero cloud cost but tethered to the user's home WiFi**. Phone and PC must be on the same subnet. PC must be on and the API must be running for the app to work at all.

**BASE_URLs** (both files) — pattern:
```
const BASE_URL = 'http://<PC-LAN-IP>:5249/api';
```
Currently: `http://192.168.1.119:5249/api` (the PC's DHCP-assigned IP at the time of writing — see "PC's IP changes" gotcha below).

**Backend `appsettings.json` connection string**:
```
Data Source=Lirone\SQLEXPRESS;Initial Catalog=TrainWise;Integrated Security=True;Encrypt=False
```
The database name is `TrainWise`, not `TrainWiseDB` — local SQL Express was set up with the shorter name. The migrations that ran on Azure SQL also need to run on the local DB; the up-to-date schema as of 2026-06-08 includes the `IsTrainee` column (2026-06-02 migration), the `Messages` table (2026-06-04 migration), `Messages.ImagePath` for image chat (2026-06-07 migration), the **social layer** (`Friendships`, `Gyms`, `GymCoaches`, `CoachOffers` tables + `Users.LastSeen` / `Latitude` / `Longitude` columns, 2026-06-08 migration), and the `sp_InsertUser` / `sp_LoginUser` proc updates. **Run order on a fresh DB**: `TWDB.sql` (schema+procs) → `2026-06-02_add_is_trainee.sql` → `2026-06-04_add_messages.sql` → `2026-06-07_add_message_image.sql` → `seed_reference_data.sql` → `2026-06-08_add_social.sql` (depends on reference data + ActivityTypes for its fake-user seed). Scripts at `c:\Dev\TrainWise\sql\`.

### Reference / seed data (must run on any fresh DB)

`TWDB.sql` / `TrainWisev0.sql` are **schema + stored procedures only — no data rows**. A fresh DB therefore has empty lookup tables, which breaks the activity/injury/goal dropdowns and the load algorithm until seeded. The canonical seed data lives in [sql/seed_reference_data.sql](TrainWise/sql/seed_reference_data.sql) (run it after the schema + migrations; it's `IF NOT EXISTS`-guarded so it's safe to re-run). Captured 2026-06-07:

- **ActivityTypes** (20 rows) — `TypeName` + `IntensityFactor` (the multiplier used by the load calc):
  ```
  1 Running 1.30 · 2 Walking 0.80 · 3 Cycling 1.20 · 4 Gym 1.30 · 5 HIIT 1.40 ·
  6 Swimming 1.20 · 7 Trail Running 1.30 · 8 Hiking 1.30 · 9 Yoga 1.00 · 10 Pilates 1.00 ·
  11 Rowing 1.20 · 12 CrossFit 1.50 · 13 Elliptical 1.10 · 14 Spin Class 1.20 ·
  15 Nordic Walking 0.80 · 16 Brisk Walk 0.80 · 17 Treadmill Run 1.30 · 18 Powerlifting 1.30 ·
  19 Interval Run 1.30 · 20 Stair Climb 1.10
  ```
- **InjuryTypes** (20 rows): 1 Knee Pain · 2 Shin Splints · 3 Lower Back Pain · 4 Ankle Sprain · 5 Hamstring Strain · 6 ITB Syndrome · 7 Achilles Tendinopathy · 8 Plantar Fasciitis · 9 Shoulder Impingement · 10 Wrist Strain · 11 Neck Strain · 12 Quadriceps Strain · 13 Groin Pull · 14 Hip Flexor Pain · 15 Calf Strain · 16 Rib Stress Injury · 17 Foot Blister · 18 Stress Fracture · 19 Tendonitis · 20 Patellar Tendinopathy
- **InjuryCategories** (20 rows, keyed by matching `InjuryTypeID`): 1 Overload · 2 Running-related · 3 Posture-related · 4 Impact · 5 Muscle · 6 Overuse · 7 Tendon · 8 Plantar · 9 Repetitive · 10 Acute · 11 Tension · 12 Muscle · 13 Groin · 14 Flexor · 15 Muscle · 16 Stress · 17 Friction · 18 Bone · 19 Tendon · 20 Patellar
- **TrainingGoals** (20 rows): 1 Weight Loss · 2 Improve Endurance · 3 Build Muscle · 4 Marathon Preparation · 5 General Fitness · 6 Injury Prevention · 7 Rehabilitation · 8 Speed Improvement · 9 Power Development · 10 Flexibility · 11 Cross Training · 12 5K Preparation · 13 10K Preparation · 14 Half Marathon Prep · 15 Core Strength · 16 Balance & Mobility · 17 HIIT Performance · 18 Long Run Stamina · 19 Cycling Endurance · 20 Improve Recovery
- **LoadParameters** (single tuning row, `ParamID=1`): BeginnerDailyLoad 200, RegularDailyLoad 350, AdvanceDailyLoad 500, BeginnerAcuteLoad 150, RegularAcuteLoad 280, AdvanceAcuteLoad 420, LowLoadRatio 0.8, SafeZoneLowRange 0.8, SafeZoneHighRange 1.3, OverLoad 1.5.

Everything else (`Users`, `Coaches`, `ActivityLogs`, `DailyLoad`, `Messages`, …) is per-user runtime data, not seed data. To dump the live DB's full contents as INSERTs, use [sql/export_all_data.sql](TrainWise/sql/export_all_data.sql) or SSMS → Generate Scripts → "Data only".

**Backend launch profile** must bind to `http://+:5249` or `http://0.0.0.0:5249` (NOT `http://localhost:5249`) — Properties → Debug → "Open debug launch profiles UI" → applicationUrl. Verify on startup that the log says `Now listening on: http://0.0.0.0:5249`.

**Windows Firewall** must allow inbound TCP 5249 on the **Private** profile. One-time setup, in Administrator PowerShell:
```
New-NetFirewallRule -DisplayName "TrainWise API 5249" -Direction Inbound -LocalPort 5249 -Protocol TCP -Action Allow -Profile Private
```
The active WiFi network must be classified as **Private**, not Public (Settings → Network → click WiFi → Network profile type → Private). Public profile = rule doesn't apply.

**Android cleartext HTTP**: the manifest at [TrainWiseExpo/android/app/src/main/AndroidManifest.xml](TrainWiseExpo/android/app/src/main/AndroidManifest.xml) has `android:usesCleartextTraffic="true"` on the `<application>` tag (added 2026-06-06). Android 9+ blocks plain-HTTP requests by default; without this attribute the app silently fails on every API call in Local LAN mode. Azure mode uses HTTPS so this attribute is irrelevant there but doesn't hurt.

**`wwwroot/images` folder** must exist on the local PC at `C:\Dev\TrainWise\TrainWise\TrainWise\wwwroot\images` for profile-pic upload to work. Create it once with `New-Item -ItemType Directory -Force -Path "C:\Dev\TrainWise\TrainWise\TrainWise\wwwroot\images"`.

**The PC's IP changes (Local LAN gotcha)**: DHCP leases expire and the router reassigns IPs. When the PC's IP shifts (e.g. `.117` → `.119`), every API call from the phone times out with `Network Error` because the BASE_URLs point at the old ghost IP. Verify the current IP with `ipconfig | findstr IPv4` before debugging anything else. Long-term fix: reserve a static IP at the router (DHCP reservation against the PC's WiFi MAC) OR use `http://<hostname>.local:5249/api` so Android resolves via mDNS instead of a hardcoded IP.

**Diagnosing connection failures in Local LAN mode** (run in this order):
1. `netstat -an | findstr 5249` on the PC → must show `0.0.0.0:5249 LISTENING`. If `127.0.0.1:5249` only → launch profile bug. If nothing → API isn't running.
2. `http://localhost:5249/swagger/index.html` in PC browser → confirms the API is up at all.
3. `http://<PC-LAN-IP>:5249/swagger/index.html` in PC browser → confirms it's reachable on the LAN interface. If localhost works but LAN doesn't, check (a) firewall rule applied on the right profile, (b) IP hasn't changed.
4. Same URL in the phone's browser (NOT the app) → confirms the phone can reach the PC over WiFi. If PC browser works but phone doesn't, phone is on a different subnet/WiFi.
5. Only after all of the above pass, rebuild the APK and test from the app.

### Switching modes

The switch is mechanical and reversible:

**Azure → Local**:
1. Edit `BASE_URL` in both [src/api/api.js](TrainWiseExpo/src/api/api.js) and [src/services/api.js](TrainWiseExpo/src/services/api.js) to `http://<current-PC-IP>:5249/api`.
2. Verify backend `appsettings.json` `DefaultConnection` points at `Lirone\SQLEXPRESS` (it does by default — Azure-mode override comes from the App Service Connection strings blade, not from the JSON file).
3. Ensure local SQL Express has the latest schema (run any pending scripts from `c:\Dev\TrainWise\sql\`).
4. Confirm `usesCleartextTraffic="true"` is present in AndroidManifest.xml. Rebuild APK.
5. Start API in VS 2022. Verify firewall + network profile + PC IP per the diagnostic steps above.

**Local → Azure**:
1. Edit both `BASE_URL`s back to `https://trainwise-api-fuaahuamcpbxgmeb.israelcentral-01.azurewebsites.net/api`.
2. (Optional) Remove `usesCleartextTraffic="true"` for production hygiene — not strictly required since HTTPS doesn't need it.
3. Reactivate the Azure subscription if it's disabled, scale `trainwisedb` to Serverless as described in Mode A, ensure App Service is started.
4. Rebuild APK.

The C# backend code itself is identical in both modes; nothing in `Controllers/`, `BL/`, or `DAL/` changes when switching.

### Backend architecture notes

- Three-layer: `Controllers → BL → DAL → DBservice` (see Architecture section below).
- SQL Server's `IDENTITY_CACHE` causes ID gaps of ~1000 across service restarts; this is normal SQL Server behavior, not a bug. Disable per-DB with `ALTER DATABASE SCOPED CONFIGURATION SET IDENTITY_CACHE = OFF;` if it bothers you.
- Backend uses raw ADO.NET (no EF Core). In Azure mode, schema lives in Azure SQL; manage it with SSMS connected to `trainwiseadmin.database.windows.net`. In Local LAN mode, manage with SSMS connected to `Lirone\SQLEXPRESS`. The schema must be kept in sync between the two — every migration script in `c:\Dev\TrainWise\sql\` should be run against both DBs.

### Backend architecture notes

- Three-layer: `Controllers → BL → DAL → DBservice` (see Architecture section below).
- SQL Server's `IDENTITY_CACHE` causes ID gaps of ~1000 across service restarts; this is normal SQL Server behavior, not a bug. Disable per-DB with `ALTER DATABASE SCOPED CONFIGURATION SET IDENTITY_CACHE = OFF;` if it bothers you.
- Backend uses raw ADO.NET (no EF Core). Schema lives in Azure SQL; manage it with SSMS connected directly to `trainwiseadmin.database.windows.net`.

## Frontend commands

```
cd TrainWiseExpo
npm install
npx expo run:android        # full native build + install on connected device
npm start                   # Metro only (use `r` to reload JS)
```

Reload bundle (`r` in Metro) for any pure-JS change. Native build (`expo run:android`) is required when:
- Editing files under `android/` (notably `MainActivity.kt`, `AndroidManifest.xml`)
- Adding/upgrading native dependencies
- Changing `app.json`

**Do NOT run `npx expo prebuild --clean`** — it overwrites manual edits in `MainActivity.kt` and `AndroidManifest.xml` that are required for Health Connect to work (see Health Connect notes below).

## Architecture

### Backend three-layer

Everything follows `Controllers → BL → DAL → DBservice`:

- **`Controllers/`** — thin REST surfaces, route `[Route("api/[controller]")]`. Always uses `[FromBody]` for POST/PUT — clients must send `Content-Type: application/json` even for endpoints that "don't really need" a body (e.g. `dailyload/user/{id}/calculate` requires `{ "date": "<ISO>" }` or returns 415).
- **`BL/`** — business logic. `LoadCalculationBL.cs` contains the core training-load algorithm (acute load, AC ratio, stress score, color-coded warning level) — this is the app's reason to exist.
- **`DAL/`** — manual ADO.NET. `DBservice.cs` is the connection helper used by every DAL class.
- **`BL/Models/`** — POCOs shared between layers (no DTOs).

No EF, no migrations folder — schema is managed manually in SSMS.

### Frontend module layout

```
src/
  api/             # Auth context, HC service, sync orchestration, axios client (legacy)
  services/api.js  # **Primary axios client** — all backend HTTP goes here
  navigation/      # Single root NavigationStack, no Expo Router despite Expo defaults
  screens/         # One file per screen, JS class-free
  components/      # Reusable: ComboBox, Card, PrimaryButton, ScreenHeader
  theme/colors.js  # Dark-theme palette — use `Colors.*` not raw hex
```

Note that `src/api/api.js` and `src/services/api.js` both exist. `services/api.js` is the canonical one; `api/api.js` is older and progressively being phased out (still hosts `getActivityLogs`, `registerUser`, device endpoints). New endpoints go in `services/`. **Both files now share the same Azure `BASE_URL` ending in `/api`**, so endpoint paths must NOT also start with `/api` (e.g. write `apiClient.post('/Users', ...)`, not `apiClient.post('/api/Users', ...)`). The doubled-prefix `/api/api/Users` was a 404 bug fixed 2026-05-31.

### Auth model

Session-based, no JWT. [src/api/AuthContext.js](TrainWiseExpo/src/api/AuthContext.js) stores the user object in AsyncStorage and exposes `userId` to the rest of the app. A locally-generated `deviceId` (string `dev-<timestamp>-<rand>`) is also persisted; the backend's `UserDevices` table expects numeric IDs, so the sync service skips device-update calls when the local ID isn't numeric.

### SignUp flow

Two-step: [SignUpScreen.js](TrainWiseExpo/src/screens/SignUpScreen.js) (basic info + gender) → [SignUpFinal.js](TrainWiseExpo/src/screens/SignUpFinal.js) (preferences + terms) → POSTs `/api/Users` via `registerUser(payload)` from `src/api/api.js`. Both screens registered as separate routes in `AuthStack` ([NavigationStack.js:35-36](TrainWiseExpo/src/navigation/NavigationStack.js#L35-L36)).

### Injuries flow

[InjuryReportScreen.js](TrainWiseExpo/src/screens/InjuryReportScreen.js) (record new) → tap the Active Injuries card → [ActiveInjuriesScreen.js](TrainWiseExpo/src/screens/ActiveInjuriesScreen.js) (list with **Mark Recovered** button per row). `markInjuryRecovered(injuryId)` hits `PUT /api/injuryreport/{injuryId}/recover` (`[FromRoute] int injuryId`) which calls `sp_MarkInjuryRecovered`. Severity validator in `InjuryReportBL.Create` accepts **1–10** to match the UI slider.

### Health Connect integration (frontend)

Read-only sync from Google Health Connect → backend ActivityLogs. Three pieces:

1. **[HealthConnectService.js](TrainWiseExpo/src/api/HealthConnectService.js)** — wraps `react-native-health-connect`. `readRecords` returns `{ records, pageToken }` in v3.x; always normalize with `Array.isArray(r) ? r : r?.records || []` before iterating.
2. **[SyncService.js](TrainWiseExpo/src/api/SyncService.js)** — orchestrates: HC permission check → fetch sessions for last N days → fetch existing backend logs → dedupe by startTime → POST new ones → optional `lastSync` housekeeping.
3. **[useSyncWorkouts.js](TrainWiseExpo/src/api/useSyncWorkouts.js)** — React hook exposing `triggerSync`, `requestHCPermissions`, status flags.

The Health page is [GoogleFitScreen.js](TrainWiseExpo/src/api/GoogleFitScreen.js) (legacy filename — it's actually the Health Connect screen). Per-row **Delete** lives here (moved from StatsScreen) with Alert confirm + recalc.

#### Native HC requirements (must not be regressed)

These are required for Health Connect to function and were debugged the hard way. They keep getting wiped by `expo prebuild` / EAS — re-verify them at the start of every session that touches `android/`.

- **[MainActivity.kt](TrainWiseExpo/android/app/src/main/java/com/anonymous/TrainWiseExpo/MainActivity.kt)** must `import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate` and call `HealthConnectPermissionDelegate.setPermissionDelegate(this)` in `onCreate` **after** `super.onCreate(...)`. Without it, `requestPermission()` crashes with `lateinit property requestPermission has not been initialized` on the New Architecture.
- **[AndroidManifest.xml](TrainWiseExpo/android/app/src/main/AndroidManifest.xml)** must declare:
  - `<package android:name="com.google.android.apps.healthdata"/>` inside `<queries>` — required for Android 11+ package visibility, without it deep-links into Health Connect silently fail.
  - The `ACTION_SHOW_PERMISSIONS_RATIONALE` intent-filter declared TWICE: once directly on `MainActivity`, once on a separate `<activity-alias>` targeting MainActivity. Both must include `<category android:name="android.intent.category.DEFAULT"/>`. **This legacy intent is for Android 13 and below ONLY** — it is NOT what makes the app appear in Health Connect on Android 14+.
  - **CRITICAL for Android 14+ (incl. the S25+ / Android 16 test device): a separate `<activity-alias android:name=".ViewPermissionUsageActivity">` targeting MainActivity, with `android:permission="android.permission.START_VIEW_PERMISSION_USAGE"` and an intent-filter for `android.intent.action.VIEW_PERMISSION_USAGE` + category `android.intent.category.HEALTH_PERMISSIONS`.** On Android 14+ Health Connect is part of the OS and builds its "App permissions" list SOLELY from apps that resolve this intent — the legacy rationale alias is ignored for listing. Without this alias the app is INVISIBLE to Health Connect and `requestPermission` returns `[]` with no UI. Verify with `adb shell cmd package query-activities -a android.intent.action.VIEW_PERMISSION_USAGE -c android.intent.category.HEALTH_PERMISSIONS` — TrainWise must appear alongside CASIO/Fit/Samsung Health. This was the true root cause of the months-long "Android 16 wall" (the alias was wiped by a prebuild on 31-05 and not restored until 2026-06-03).
- All six health permissions (`READ_EXERCISE`, `READ_HEART_RATE`, `READ_DISTANCE`, `READ_TOTAL_CALORIES_BURNED`, `READ_ACTIVE_CALORIES_BURNED`, `READ_STEPS`) must be in both `app.json` AND the manifest. Do NOT add `READ_EXERCISE_ROUTE` — it's not a real permission and declaring it makes HC drop the app from its list; routes are read via the per-record consent flow `requestExerciseRoute(recordId)`.

`expo prebuild --clean` and **EAS Build** both regenerate these files from `app.json` + plugins, wiping the manual edits. The bundled `react-native-health-connect` plugin ([node_modules/react-native-health-connect/app.plugin.js](TrainWiseExpo/node_modules/react-native-health-connect/app.plugin.js)) only adds the action without the DEFAULT category and without the activity-alias — its output alone is NOT sufficient for Android 14+/16. Until the manual edits are ported into a custom Expo config plugin, **do not use EAS Build** and do not run `expo prebuild`. Use `npx expo run:android --variant release` for production APKs instead.

#### Health Connect on Android 16 — SOLVED 2026-06-03

The long-standing "Android 16 wall" (app absent from HC's list, `requestPermission` → `[]`, no UI) was **NOT** an OS/library incompatibility. **Root cause: the manifest was missing the Android-14+ `ViewPermissionUsageActivity` alias** (`VIEW_PERMISSION_USAGE` + `HEALTH_PERMISSIONS` category). On Android 14+ Health Connect lives in the OS and lists only apps that resolve that intent; the legacy `ACTION_SHOW_PERMISSIONS_RATIONALE` alias does nothing for listing. The alias was wiped by an EAS/prebuild on 31-05 and the manifest "restore" used an incomplete checklist, so it stayed broken for weeks. The fix is the alias documented in the "Native HC requirements" checklist above.

Diagnostic that nailed it: `adb shell cmd package query-activities -a android.intent.action.VIEW_PERMISSION_USAGE -c android.intent.category.HEALTH_PERMISSIONS` listed CASIO/Fit/Samsung Health/Claude but **not** TrainWise. The misleading `App should support rationale intent, finishing!` log refers to the *legacy* intent and was a red herring on Android 14+.

If HC ever breaks again: first run that `query-activities` check. If TrainWise is missing from the result, the `ViewPermissionUsageActivity` alias was lost (prebuild/EAS) — restore it. The **manual workout flow** (AddWorkoutScreen → POST /activitylog) remains a complete fallback.

**Exact fix (copy-paste into `<application>` of [AndroidManifest.xml](TrainWiseExpo/android/app/src/main/AndroidManifest.xml), as a sibling of `HealthConnectPermissionsRationaleAlias`), then `npx expo run:android --variant release`:**

```xml
<activity-alias
  android:name=".ViewPermissionUsageActivity"
  android:exported="true"
  android:targetActivity=".MainActivity"
  android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
  <intent-filter>
    <action android:name="android.intent.action.VIEW_PERMISSION_USAGE"/>
    <category android:name="android.intent.category.HEALTH_PERMISSIONS"/>
  </intent-filter>
</activity-alias>
```

Confirmed working 2026-06-03: TrainWiseExpo now appears in Health Connect's "Vos applis de santé" list alongside CASIO/Fit/Samsung Health, and `requestPermissions()` returns a granted set. The "Connected" banner shows on the Health tab.

### New Architecture is required

`app.json` has `"newArchEnabled": true`. Do not turn this off — `react-native-reanimated` and `react-native-worklets` both refuse to build without it. Any HC issue caused by New Arch must be solved differently (manifest/MainActivity fixes, library upgrade) — never by disabling New Arch.

## Navigation graph

Single root in [NavigationStack.js](TrainWiseExpo/src/navigation/NavigationStack.js). Four sub-stacks behind a tab navigator (Home / Health / **Connect** / Profile):

- **AuthStack**: `Welcome → Login | SignUp → SignUpFinal`
- **HomeStack**: `HomeMain → Stats | Warnings | AddWorkout | InjuryReport → ActiveInjuries | WorkoutSummary | WorkoutRoute | Settings | ConnectQR | Shop | AIChat | Chat | MyNetwork | CoachTraineeDetail`
- **HealthStack**: `HealthConnectMain` (= GoogleFitScreen) `| WorkoutRoute`
- **ConnectStack** (2026-06-08): `ConnectMain → Requests | MyNetwork | Chat`
- **ProfileStack**: `ProfileMain`

`AppTabs` is wrapped by `HealthSyncProvider` (Health-tab `unconfirmedCount` badge), `MessagesProvider` (chat unread), and `SocialProvider` (Connect-tab `pendingTotal` badge + presence heartbeat). The **Connect tab is visible to coaches too** (not gated like the Health tab) — for a coach-only user it sits between Home and Profile. The "My coach" Home button was renamed **"My network"** and now opens the `MyNetwork` hub (the file is still `MyCoachScreen.js`).

## Shared chart logic

`getBarColor(load)` is exported from [HomeScreen.js:24](TrainWiseExpo/src/screens/HomeScreen.js#L24) and re-imported by StatsScreen. Both Home dashboard and Warnings dashboard use the **same per-day session-load aggregation** with these thresholds:
- `≤ 0` → `#2a2a4a` (empty)
- `< 150` → green `#00e676`
- `< 300` → yellow `#ffee58`
- `< 500` → orange `#ff9800`
- `≥ 500` → red `#f44336`

Use `useFocusEffect` (not `useEffect`) on tab-switched screens so deletes on the Health tab propagate when the user returns Home.

## Time / timezone

The backend stores times exactly as sent (no timezone conversion). The frontend sends UTC via `toISOString()`. Display layers must convert back to local using `toLocaleTimeString('en-US', { ..., timeZone: 'Asia/Jerusalem' })` — do not change the storage format to "fix" displayed times.

## ActivityLog invariants

- Hard-delete only (soft-delete reverted 2026-04-22; `IsDeleted` column dropped from DB; `sp_GetActivityLogsByUser` and `sp_GetActivityLogsForLoad` rewritten without the filter).
- Any screen that creates/updates an ActivityLog MUST set `calculatedLoadForSession = duration × exertion` AND call `calculateDailyLoad(userId, editedDate)` then `calculateDailyLoad(userId, today)` afterwards — otherwise the DailyLoad rows on the server stay stale.
- AC ratio thresholds (strict): `ratio < 0.8` Green, `0.8 ≤ ratio ≤ 1.3` Yellow, `ratio > 1.3` Red.
- Warnings dashboard's status / AC ratio / weekly bars are computed client-side from `ActivityLogs`, never from `DailyLoad` rows (those are 7-day rolling snapshots and leak prior-week data).
- Refresh on Warnings must recalc ALL 7 days of DailyLoad (loop i=6..0).

## Theme system

- [theme/colors.js](TrainWiseExpo/src/theme/colors.js) exports a **mutable** `Colors` singleton that is swapped in place by `applyTheme(name)`. Reading `Colors.x` **inside JSX or inside a function called per-render** (e.g. `screenOptions={() => ...}`) always returns the current value because the object reference doesn't change.
- [theme/palettes.js](TrainWiseExpo/src/theme/palettes.js) holds `darkPalette` (default) and `lightPalette` (logo-derived mint/teal/navy + brand pink accent).
- [theme/ThemeContext.js](TrainWiseExpo/src/theme/ThemeContext.js): `<ThemeProvider>` reads `trainwise.theme` from AsyncStorage on mount, exposes `useTheme()` (`{ theme, setTheme }`), and re-mounts its children via a key prop on theme switch.
- **CRITICAL**: `StyleSheet.create()` reads color values **once at module-load time** and freezes them. Mutating `Colors` later does NOT update existing stylesheets, even after a Fragment-key remount (modules stay cached). Therefore every themed screen must use the [useThemedStyles](TrainWiseExpo/src/theme/useThemedStyles.js) hook:
  ```js
  const MyScreen = () => {
    const styles = useThemedStyles(makeStyles);
    return <View style={styles.bg} />;
  };
  const makeStyles = (Colors) => StyleSheet.create({ bg: { backgroundColor: Colors.background } });
  ```
  The hook is `useMemo`-keyed on the active theme and re-runs `makeStyles(Colors)` after `applyTheme` mutates the singleton. **Do not put `StyleSheet.create({...Colors.x...})` at module level** — it will not theme-switch.
- **Themed screens (use `useThemedStyles`)**: As of 2026-06-04 **every screen is themed** — HomeScreen, StatsScreen, ProfileScreen, WarningsDashboardScreen, SettingsScreen, GoogleFitScreen, AddWorkoutScreen, InjuryReportScreen, ActiveInjuriesScreen, CoachDashboardScreen, CoachTraineeDetailScreen, ChatScreen, MyCoachScreen, ConnectQRScreen, and the formerly-branded WelcomeScreen, LoginScreen, SignUpScreen, SignUpFinal, WorkoutSummaryScreen, ShopScreen, AIChatScreen. All shared components (Card, ScreenHeader, PrimaryButton, ComboBox) + DraggableChatBubble.
- **Mapping the old branded palette → tokens** (applied to the onboarding/auth screens): navy `#13173d`→`background`, white inputs `#fff`→`inputBackground`, mint border `#87ffd7`→`inputBorder`, pink `#ff2c60`/`#ff2d6f`→`primary`, purple `#c524e6`→`primaryDark`, teal/cyan accents→`primaryLight`, navy text `#13173d`→`textPrimary`, gray `#a0a0c0`→`textSecondary`. The brand pink stays the `primary` accent in dark; light mode swaps it for the teal palette. CTA button label text and on-`primary` icons are kept literal `#fff` for contrast; coin gold (`#FFD700`) and semantic green stay fixed. Onboarding screens read `useTheme().theme` to flip `<StatusBar>` between `light`/`dark`.
- **Intentionally hardcoded**: `getBarColor()` thresholds in [HomeScreen.js](TrainWiseExpo/src/screens/HomeScreen.js) — green/yellow/orange/red carry semantic meaning and must stay constant across themes.

## Week start

`src/constants/weekStart.js` — single source of truth for which weekday the rolling charts begin on. `initWeekStart()` runs once in `App.js`; `getWeekStartDate(offset)`, `getWeekDayLabels()`, and `subscribeWeekStart(fn)` are the public API. The picker in SettingsScreen calls `setWeekStartDay(idx)` which persists to AsyncStorage and notifies subscribers (WarningsDashboardScreen reactively re-renders the chart). HomeScreen's `dayIndex` is the **JS day-of-week** (Sun=0..Sat=6), not the array position, so labels stay correct under any week start.

## AI chatbot

[AIChatScreen.js](TrainWiseExpo/src/screens/AIChatScreen.js) calls OpenAI directly from the device via [api/openai.js](TrainWiseExpo/src/api/openai.js) using `EXPO_PUBLIC_OPENAI_API_KEY` read from `.env`. The key is **bundled into the APK in plain text** because of the `EXPO_PUBLIC_` prefix — anyone with the APK file can unzip it and extract the key. Acceptable for the school demo; **do not distribute the APK publicly**. If the project ever ships beyond demos, move the call through the backend so the key lives only on Azure.

`.env` is gitignored. If the chatbot returns "API key not configured", the `.env` file is missing or the build didn't pick it up — env vars are baked in at build time, so changing `.env` requires `npx expo run:android --variant release` to take effect.

Chat history is currently in-memory only (`useState` in [AIChatScreen.js](TrainWiseExpo/src/screens/AIChatScreen.js)) — leaving the screen wipes the conversation. Persisting it (AsyncStorage or backend) is a known open item.

## HC tombstones

Health Connect itself is read-only for third-party apps (TrainWise can't delete records that Samsung Fit wrote). Without intervention, every auto-sync re-imports any HC workout the user just deleted from the backend. [src/constants/hcTombstones.js](TrainWiseExpo/src/constants/hcTombstones.js) keeps a persistent set of normalized HC startTime keys (minute-granular, matching `SyncService.areWorkoutsDuplicate`). When the user deletes an HC-source workout in [GoogleFitScreen.js](TrainWiseExpo/src/api/GoogleFitScreen.js), its key is added to the set; `SyncService.deduplicateWorkouts` filters tombstoned keys before posting. Manual logs bypass tombstoning since they have no HC counterpart.

## User roles (coach / trainee / both)

As of 2026-06-02, the `Users` table has TWO independent role booleans:
- `IsCoach` — user can act as a coach (sees CoachDashboardScreen, can connect to trainees).
- `IsTrainee` — user has training screens (Home dashboard, Health tab, AddWorkout, personal Warnings, training rows on Profile).

Both flags are set at signup from the SignUpScreen role picker (`'trainer' | 'trainee' | 'both'`):
- `'trainer'` → `IsCoach=1, IsTrainee=0` (coach-only)
- `'trainee'` → `IsCoach=0, IsTrainee=1`
- `'both'` → `IsCoach=1, IsTrainee=1`

**Coach-only gating:**
- [NavigationStack.AppTabs](TrainWiseExpo/src/navigation/NavigationStack.js) hides the Health tab when `isCoach && !isTrainee`.
- [HomeRouter](TrainWiseExpo/src/screens/HomeRouter.js) renders CoachDashboardScreen directly (no toggle) for coach-only users.
- [ProfileScreen](TrainWiseExpo/src/screens/ProfileScreen.js) hides Activity Level / Experience Level / Height / Weight rows for coach-only.

Existing rows from before 2026-06-02 default to `IsTrainee=1` via the column's `DEFAULT 1` — they keep all their screens. UserDAL.MapUser uses `SafeReadBool(reader, "IsTrainee", true)` so it tolerates SPs that haven't been updated to include the column in their SELECT lists.

**Coach row caveat (open issue):** `UserBL.Create` only inserts into the `Coaches` table when `IsCoach=true` at signup time. Users who flip to coach later need a manual `INSERT INTO Coaches` or the `getCoachByUserId` 404 leaves their QR Connect flow permanently stuck on "Could not load your coach profile". A lazy-create in CoachBL is the right long-term fix.

## Coach ↔ trainee chat (messages)

Added 2026-06-04 (#6), image support 2026-06-07 (#9). WhatsApp-style chat that is **user↔user, not coach↔trainee** — both `senderID` and `receiverID` are `Users.UserID`. The coach/trainee link only decides who *can* see whom in the UI; the message rows themselves are just between two users.

- **DB**: `Messages` table + `sp_InsertMessage` / `sp_GetConversation` / `sp_MarkMessagesSeen` / `sp_GetUnreadMessageCount` ([sql/2026-06-04_add_messages.sql](TrainWise/sql/2026-06-04_add_messages.sql)). Image chat adds `Messages.ImagePath NVARCHAR(300) NULL` and updates the two read/insert procs ([sql/2026-06-07_add_message_image.sql](TrainWise/sql/2026-06-07_add_message_image.sql)). `SentAt` is stored UTC but serialized **without a 'Z'** — the frontend appends 'Z' before parsing then renders in `Asia/Jerusalem` (mirror the `toLocalTime` helper, don't "fix" storage).
- **Backend**: `MessagesController` — `POST /api/messages`, `GET /api/messages/conversation/{a}/{b}` (oldest first), `PUT /api/messages/seen/{senderId}/{receiverId}`, `GET /api/messages/unread/{userId}`, and `POST /api/messages/upload` (IFormFile → `wwwroot/images/chat_*`, returns `{ path }`, same `WebRootPath` rule as profile upload). **`SendMessageRequest.Text` and `.ImagePath` are `string?`** — nullable refs are ON, so a plain `string` would be implicitly `[Required]` and 400 every text-only message (see lessons 2026-06-07). `MessageBL` allows image-only (empty Text).
- **Frontend client** ([services/api.js](TrainWiseExpo/src/services/api.js)): `sendMessage` (text:'' / imagePath:null defaults), `getConversation`, `markMessagesSeen`, `getUnreadMessageCount`, `uploadChatImage` (raw fetch multipart), `getCoachesForTrainee`. Message field accessors are dual-cased (`m.senderID ?? m.SenderID`, `isSeen ?? IsSeen`, etc.).
- **Chat UI** ([ChatScreen.js](TrainWiseExpo/src/screens/ChatScreen.js)): focus-gated 4s poll, auto-marks incoming messages seen (read receipts), image bubbles + full-screen viewer. `errText()` extracts the real axios error (never render the raw body — it stringifies as "[object Object]").
- **Unread badge / notifications**: [MessagesContext.js](TrainWiseExpo/src/api/MessagesContext.js) is a global 12s poller exposing `unreadCount` + firing a generic local notification when the **total** count rises. It does NOT know the sender — naming the coach in the notification would need an unread-by-sender endpoint.
- **Trainee side — multiple coaches** (2026-06-08): a trainee can be linked to **more than one coach**. [MyCoachScreen.js](TrainWiseExpo/src/screens/MyCoachScreen.js) fetches `getCoachesForTrainee(selfId)` itself: with 2+ coaches it renders a selectable inbox list (avatar + name + last-message preview + **per-coach unread badge**) → tap → per-coach detail (identity / Message / disconnect); with exactly 1 coach it auto-selects to detail; header back returns to the list when multiple. **Per-coach unread is derived client-side** by counting unseen messages from each coach in `getConversation` (cheap — a trainee has few coaches), so there is no backend per-sender endpoint. Don't regress this back to a single `coaches[0]` + global badge.
- **Coach side** lists trainees via `getTraineesByCoach` (CoachDashboardScreen) and opens the same ChatScreen per trainee.
- **Floating bubble**: [DraggableChatBubble.js](TrainWiseExpo/src/components/DraggableChatBubble.js) exists but is OFF (`SHOW_COACH_BUBBLE=false` in HomeScreen) — unread is shown as a badge on the "My coach" button instead. Flip the flag to bring it back.

## Connect / social layer (friends, gyms, presence, coach offers)

Added 2026-06-08 (#3). A whole vertical slice — SQL → C# → RN. Migration:
[sql/2026-06-08_add_social.sql](TrainWise/sql/2026-06-08_add_social.sql) (idempotent;
**must run after `seed_reference_data.sql`** — its fake-user seed references ActivityTypeIDs 1–6).

- **DB**: `Friendships` (RequesterID/AddresseeID/Status pending|accepted|declined — ONE row per pair, either direction), `Gyms` + `GymCoaches` (gym↔coach recommendation link, CoachUserID = Users.UserID), `CoachOffers` (coach→trainee "need a coach?"), and `Users.LastSeen` / `Latitude` / `Longitude`. Distance uses `geography::Point(lat,lng,4326).STDistance(...)`; "online" = `LastSeen` within **5 minutes**. ~20 stored procs, all `CREATE OR ALTER`. The seed adds 6 fake trainees + 4 fake coaches near **Netanya (32.3215, 34.8532)** + **10 REAL Netanya gyms harvested from the Google Places API** (name + Address + Lat/Lng all from Google so the pin and address always agree — fixes the address-mismatch class of bug): Profit Gym, G 24/7, Holmes Place Natanya, Greenbody, Icon Fitness Netanya, FITTR, Collegym, Shmeps Fit, Reborn, Profit Kiryat HaSharon. They cover the user's city and reach Ruppin Academic Center (~6km NE). Gyms are **demo-only reference data** (no UI creates them), so the seed **wipes `Gyms` + `GymCoaches` and reseeds** each run (converges; any coach self-listing is rebuilt). The Connect query radius is **25km** (Netanya + Ruppin, local). `Gyms.City` exists but the Connect filter is now type+sort (see frontend). The fake people are **real loginable accounts, password `demo1234`** (use a second login to demo the accept side of friend/coach flows).
- **Backend**: `SocialController` (`api/social/...`) + `GymsController` (`api/gyms`). Three-layer as usual: `SocialBL`/`SocialDAL`, `GymBL`/`GymDAL`, projection POCOs in [Models/SocialModels.cs](TrainWise/TrainWise/TrainWise/Models/SocialModels.cs). DAL readers use a defensive `Has(reader,col)` so procs whose final SELECT omits a column (e.g. `sp_RespondCoachOffer`) still map. `sp_RespondCoachOffer` lazy-creates the `Coaches` row + the `CoachTrainees` link on accept (mirrors `CoachBL`).
- **Presence is a real heartbeat**: [SocialContext.js](TrainWiseExpo/src/api/SocialContext.js) (global provider in [NavigationStack.AppStack](TrainWiseExpo/src/navigation/NavigationStack.js)) PUTs `/social/presence/{userId}` every 60s while foregrounded, and polls the inbox every 25s. When friend-requests / accepted-friends / coach-offers grow vs the last poll it fires a local push, so **both sides get notified** (the accepter pushes immediately in [RequestsScreen.js](TrainWiseExpo/src/screens/RequestsScreen.js); the requester's poller detects the new friend). Known gap: a coach is NOT pushed when their offer is accepted (the trainee just appears in their dashboard).
- **Frontend**: [ConnectScreen.js](TrainWiseExpo/src/screens/ConnectScreen.js) = the Connect tab. The map plots **gyms only** — other users' exact coordinates are NEVER shown on the map (privacy, 2026-06-09); people appear only as a proximity-sorted LIST without distances. expo-maps is lazy-required like WorkoutRouteScreen so it degrades to a list; gym markers carry `id` `gym-N` and route via `onMarkerClick`; falls back to Netanya center if location denied; **25km query radius** (covers Netanya + Ruppin Academic Center, local). The map is **resizable** (a PanResponder drag handle between the map and the list adjusts map height with a draggable bar). A **filter icon** (not a search box) opens a menu: **Show** Trainees / Coaches / Gyms, **Sort by** Nearest / Name(A-Z). Detail sheets: a user mini-profile (training level + top-3 activities + presence) with Add-friend / Message / Unfriend + (coach viewer) Offer-to-coach; a gym sheet with recommended coaches (tapping a coach **opens their profile to Add-friend — no chat-before-connected**) + (coach viewer) "recommend me here". The smart-suggestion card (AddWorkout) and the coach-recommendations card (Warnings) are **collapsible** (LayoutAnimation, chevron indicator); the coach card shows a red **unseen-count** badge cleared on open (persisted per-account in AsyncStorage). [RequestsScreen.js](TrainWiseExpo/src/screens/RequestsScreen.js) = accept/decline inbox. [MyCoachScreen.js](TrainWiseExpo/src/screens/MyCoachScreen.js) was rewritten as the **My Network hub** — swipe (paged ScrollView) between **Coaches** and **Friends**, per-contact unread badges (derived client-side from `getConversation`, same as before), green presence dots on friends, row→chat, trailing menu→disconnect/unfriend. Friend chat reuses the generic [ChatScreen.js](TrainWiseExpo/src/screens/ChatScreen.js) (`selfId`/`peerId`/`peerName`/`peerImagePath`) — friends are real DB users so it's the same `Messages` backend. Reusable [components/Avatar.js](TrainWiseExpo/src/components/Avatar.js) draws the avatar + optional online dot; [utils/experience.js](TrainWiseExpo/src/utils/experience.js) maps `ExperienceLevel` (tinyint 1/2/3) → Beginner/Regular/Advanced + a `lastSeenText` helper.
- All social API helpers live in [services/api.js](TrainWiseExpo/src/services/api.js) (SOCIAL / FRIENDS / COACH OFFERS / GYMS sections). Field accessors are dual-cased but the backend serializes camelCase.

## Smart workout suggestion (multi-factor)

Reworked 2026-06-08 (#1+#2). [weatherService.js](TrainWiseExpo/src/api/weatherService.js) pulls the Google **Weather API** (temp, feels-like, humidity, wind, UV, precipitation, cloud) AND the Google **Air Quality API** (Universal AQI, 0–100 higher = cleaner) — a **third separate SKU**; both are best-effort (a disabled SKU or missing datum just hides that factor). [utils/smartWorkout.js](TrainWiseExpo/src/utils/smartWorkout.js) scores temp + humidity + UV + wind + air + rain into a 0–100 conditions score (Great/Good/Fair/Poor) with a per-factor traffic-light breakdown; AC ratio > 1.3 still overrides to recovery. [AddWorkoutScreen.js](TrainWiseExpo/src/screens/AddWorkoutScreen.js) renders this as a **distinct accent-bordered glowing card** (not a plain `<Card>`) with a rating pill + factor grid + activity chips, so it clearly stands apart from the form fields.

## Injury scanner + AI advice

Added 2026-06-08 (#4). [InjuryReportScreen.js](TrainWiseExpo/src/screens/InjuryReportScreen.js) symptoms card now has **Scan injury (photo)** (camera or library via expo-image-picker), **AI advice** (builds a prompt from injury type + severity + notes and calls the existing text-only [openai.js](TrainWiseExpo/src/api/openai.js) `getGPTResponse` — returns the "API key not configured" placeholder until the OpenAI key works; swap for a vision call to analyze the photo later), and **Send to coach** (uploads the scan via `uploadChatImage` + sends a summary through the existing chat to every linked coach).

## Profile picture upload

Wired 2026-06-02. End-to-end flow:
- **Backend**: `POST /api/users/{id}/upload` accepts `IFormFile` via multipart. Saves to `wwwroot/images/{id}_{ticks}.{ext}` using `IWebHostEnvironment.WebRootPath` (relative `wwwroot` path doesn't work on Azure — see lesson 2026-06-02). Updates `Users.ProfileImagePath` via existing `sp_UpdateUserProfileImage`. Returns `{ path: "/images/..." }`. Served by `app.UseStaticFiles()` in Program.cs.
- **Frontend**: [services/api.js](TrainWiseExpo/src/services/api.js) exports `uploadProfileImage(userId, localUri)` (raw fetch + FormData, no explicit Content-Type so RN sets the boundary correctly, 60s AbortController timeout) and `resolveProfileImageUrl(path)` (strips `/api` from BASE_URL to hit static-files host root). [AuthContext.login](TrainWiseExpo/src/api/AuthContext.js) carries `profileImagePath`. [ProfileScreen](TrainWiseExpo/src/screens/ProfileScreen.js) has a tappable avatar with ImagePicker + camera badge. [HomeScreen](TrainWiseExpo/src/screens/HomeScreen.js) renders the same URL in the greeting avatar.

**Known limitation**: Azure App Service may wipe `wwwroot/images` on app restart (the deployment overlay replaces it). For production-grade persistence, move to Azure Blob Storage or mount a persisted disk at `D:\home\data\images`.

## Push notifications

Redesigned 2026-06-02. [NotificationService.js](TrainWiseExpo/src/api/NotificationService.js):
- **`scheduleDailyReminder(acRatio, loadLevel)`** — fires every day at 18:00. Body is load-aware (suppressed entirely when level=Red or acRatio>1.5; "keep it moderate" for Yellow; "you're fresh, push hard" for Green). Duolingo-style escalation across 4 tiers based on `daysSinceLastOpened`: friendly nudge → mild guilt → "gains getting cold 🥶" → "TrainWise misses you 😢". Re-scheduled on every app launch (App.js) AND on every HomeScreen load (so the next push reflects the freshest weekly load).
- **`markAppOpened()`** — called from App.js on launch, persists `@trainwise_last_opened` ISO timestamp. Used by `daysSinceLastOpened()` to pick the escalation tier.
- **`sendLoadWarningIfNeeded(acRatio, level)`** — fires on workout confirm. Was previously a TEMP DEBUG OVERRIDE that always fired with body `acRatio=X, level=Red`; this was removed 2026-06-02. Now only fires for genuine Yellow/Red zones.

Daily reminder content can't be mutated after scheduling, so the re-schedule-on-app-open pattern is intentional. iOS limits per-app scheduled count; the implementation cancels all before scheduling to stay safe.

## Expo SDK 54 picker / camera gotchas

- `expo-image-picker` SDK 54 **removed `MediaTypeOptions`**. Only the array form works: `mediaTypes: ['images']`. Grep the project before adding new pickers.
- `expo-camera` 17 exposes `scanFromURLAsync` as a **module-level export**, not a static on `CameraView`. Import it: `import { CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera'`.

## Known pending items

- Teammate's SignUp flow expects gender PNGs `000.png` / `001.png` / `002.png` / `003.png` under `assets/images/` — currently only `wowowow.png` exists; either get the assets or swap to Ionicons.
- HC `ActiveCaloriesBurned` permission is now requested at the SDK level + manifest + `app.json`. After installing the new APK the user must grant it once in Health Connect — until then calories silently fall back to the BMR-corrected `TotalCaloriesBurned` estimate.
- App logo: `app.json` references `assets/images/wowowow.png` for launcher icon, adaptive icon foreground, and notification icon. Notification icons on Android MUST be transparent silhouettes — if the logo is colored, the system status-bar icon may render as a white blob. Make a separate silhouette PNG if that happens.
- **#12 Route maps** for cardio workouts (running / walking / swimming / hiking) is the next planned feature. Decision: use Google Maps via react-native-maps. Requires a Google Cloud project, Maps SDK for Android enabled, API key with restrictions, billing on file. See [tasks/conversation_resume_2026_06_03.md](tasks/conversation_resume_2026_06_03.md) for the full carry-over brief.

## Self-learning

- **At the start of every session**, read [tasks/lessons.md](tasks/lessons.md) before doing anything else.
- **Before modifying any code**, apply every rule in `tasks/lessons.md` that could be relevant to the change.
- **Immediately after the user corrects you** (anything the user calls out as wrong, misguided, or redundant), append one line to `tasks/lessons.md` in this format:
  `[YYYY-MM-DD] | what went wrong | rule to follow next time`
  One entry per correction. Keep each line terse. Do not batch, do not wait for the end of the session.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two cooperating projects in one folder, no shared root package manager:

- **`TrainWise/`** — ASP.NET Core 8 Web API (the backend). Open `TrainWise.sln` in Visual Studio 2022 and run with the green play button (Swagger opens at `https://localhost:5249/swagger`). Uses raw ADO.NET (no EF Core) against SQL Server Express.
- **`TrainWiseExpo/`** — Expo (React Native 0.81 / RN New Architecture) mobile app. Installed as APK on a Samsung Galaxy S25+ for testing — the iOS folder is not maintained. JavaScript only, no TypeScript despite the `tsconfig.json`.

## Backend commands

Backend is run from Visual Studio 2022, not the CLI. The phone connects to the backend via **USB cable using `adb reverse`** — both axios clients use `http://127.0.0.1:5249`. Android forwards `127.0.0.1:5249` on the phone to port 5249 on the PC through the USB tunnel.

The `android` script in `package.json` automatically runs `adb reverse tcp:5249 tcp:5249` after the build. If you run `npx expo run:android` directly instead of `npm run android`, run this afterward manually:
```
adb reverse tcp:5249 tcp:5249
```
The mapping resets on every fresh APK install (not on JS-only reloads). If you see `Network Error` on activity log fetches, re-run the command above.

If you ever switch to WiFi testing, change both base URLs back to the PC's LAN IP and update [TrainWiseExpo/src/services/api.js](TrainWiseExpo/src/services/api.js) and [TrainWiseExpo/src/api/api.js](TrainWiseExpo/src/api/api.js).

`Program.cs` has `app.UseHttpsRedirection()` **commented out** so HTTP requests from the phone aren't redirected to an HTTPS port the phone can't trust. Re-enable only if you switch to HTTPS testing.

DB connection lives in [TrainWise/TrainWise/appsettings.json](TrainWise/TrainWise/appsettings.json) — points to `Lirone\SQLEXPRESS`, database `TrainWise`. SQL Server's `IDENTITY_CACHE` causes ID gaps of ~1000 across service restarts; this is normal Windows SQL Server behavior, not a bug. Disable per-DB with `ALTER DATABASE SCOPED CONFIGURATION SET IDENTITY_CACHE = OFF;` if it bothers you.

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

Note that `src/api/api.js` and `src/services/api.js` both exist. `services/api.js` is the canonical one; `api/api.js` is older and progressively being phased out (still hosts `getActivityLogs`, `registerUser`, device endpoints). New endpoints go in `services/`.

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

These are required for Health Connect to function on Android 14+ and were debugged the hard way:

- **[MainActivity.kt](TrainWiseExpo/android/app/src/main/java/com/anonymous/TrainWiseExpo/MainActivity.kt)** must call `HealthConnectPermissionDelegate.setPermissionDelegate(this)` in `onCreate` after `super.onCreate(...)`. Without it, `requestPermission()` crashes with `lateinit property requestPermission has not been initialized` on the New Architecture.
- **[AndroidManifest.xml](TrainWiseExpo/android/app/src/main/AndroidManifest.xml)** must declare:
  - `<package android:name="com.google.android.apps.healthdata"/>` inside `<queries>`.
  - The `ACTION_SHOW_PERMISSIONS_RATIONALE` intent-filter on a separate `<activity-alias>` (not on MainActivity directly). Without the alias the app won't appear in Health Connect's app permissions list and the dialog silently denies everything.
- All five health permissions (`READ_EXERCISE`, `READ_HEART_RATE`, `READ_DISTANCE`, `READ_TOTAL_CALORIES_BURNED`, `READ_STEPS`) must be in both `app.json` AND the manifest.

`expo prebuild --clean` regenerates these files and will break HC. To make them survive a prebuild, port them into an Expo config plugin.

### New Architecture is required

`app.json` has `"newArchEnabled": true`. Do not turn this off — `react-native-reanimated` and `react-native-worklets` both refuse to build without it. Any HC issue caused by New Arch must be solved differently (manifest/MainActivity fixes, library upgrade) — never by disabling New Arch.

## Navigation graph

Single root in [NavigationStack.js](TrainWiseExpo/src/navigation/NavigationStack.js). Three sub-stacks behind a tab navigator (Home / Health / Profile):

- **AuthStack**: `Welcome → Login | SignUp → SignUpFinal`
- **HomeStack**: `HomeMain → Stats | Warnings | AddWorkout | InjuryReport → ActiveInjuries | WorkoutSummary | Settings | ConnectQR`
- **HealthStack**: `HealthConnectMain` (= GoogleFitScreen)
- **ProfileStack**: `ProfileMain`

`HealthSyncProvider` wraps `AppTabs` so the Health tab can show an `unconfirmedCount` badge.

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
- **Themed screens (use `useThemedStyles`)**: HomeScreen, StatsScreen, ProfileScreen, WarningsDashboardScreen, SettingsScreen, GoogleFitScreen, AddWorkoutScreen, InjuryReportScreen, ActiveInjuriesScreen. All shared components (Card, ScreenHeader, PrimaryButton, ComboBox).
- **Not-yet-themed screens** (intentional own visual style): WelcomeScreen, LoginScreen, SignUpScreen, SignUpFinal, WorkoutSummaryScreen — auth/onboarding flows with their own dark navy + pink/purple branding.
- **Intentionally hardcoded**: `getBarColor()` thresholds in [HomeScreen.js](TrainWiseExpo/src/screens/HomeScreen.js) — green/yellow/orange/red carry semantic meaning and must stay constant across themes.

## Week start

`src/constants/weekStart.js` — single source of truth for which weekday the rolling charts begin on. `initWeekStart()` runs once in `App.js`; `getWeekStartDate(offset)`, `getWeekDayLabels()`, and `subscribeWeekStart(fn)` are the public API. The picker in SettingsScreen calls `setWeekStartDay(idx)` which persists to AsyncStorage and notifies subscribers (WarningsDashboardScreen reactively re-renders the chart). HomeScreen's `dayIndex` is the **JS day-of-week** (Sun=0..Sat=6), not the array position, so labels stay correct under any week start.

## HC tombstones

Health Connect itself is read-only for third-party apps (TrainWise can't delete records that Samsung Fit wrote). Without intervention, every auto-sync re-imports any HC workout the user just deleted from the backend. [src/constants/hcTombstones.js](TrainWiseExpo/src/constants/hcTombstones.js) keeps a persistent set of normalized HC startTime keys (minute-granular, matching `SyncService.areWorkoutsDuplicate`). When the user deletes an HC-source workout in [GoogleFitScreen.js](TrainWiseExpo/src/api/GoogleFitScreen.js), its key is added to the set; `SyncService.deduplicateWorkouts` filters tombstoned keys before posting. Manual logs bypass tombstoning since they have no HC counterpart.

## Known pending items

- Teammate's SignUp flow expects gender PNGs `000.png` / `001.png` / `002.png` / `003.png` under `assets/images/` — currently only `wowowow.png` exists; either get the assets or swap to Ionicons.
- HC `ActiveCaloriesBurned` permission is now requested at the SDK level + manifest + `app.json`. After installing the new APK the user must grant it once in Health Connect — until then calories silently fall back to the BMR-corrected `TotalCaloriesBurned` estimate.

## Self-learning

- **At the start of every session**, read [tasks/lessons.md](tasks/lessons.md) before doing anything else.
- **Before modifying any code**, apply every rule in `tasks/lessons.md` that could be relevant to the change.
- **Immediately after the user corrects you** (anything the user calls out as wrong, misguided, or redundant), append one line to `tasks/lessons.md` in this format:
  `[YYYY-MM-DD] | what went wrong | rule to follow next time`
  One entry per correction. Keep each line terse. Do not batch, do not wait for the end of the session.

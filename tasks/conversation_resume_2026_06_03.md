# Conversation resume — 2026-06-03

Carry-over brief for a fresh Claude session. Anything not in this doc, read CLAUDE.md.

## Why this doc exists

Two long sessions (2026-06-02 and 2026-06-03) shipped 5 of the 7 remaining items from the user's 12-item bug/feature list. The next session picks up at **#12 route maps for cardio workouts**, which needs Google Cloud setup before any code lands. This doc captures the state needed to start that work without re-reading the whole transcript.

## Status of the 12-item list

| # | Item | Status |
|---|------|--------|
| 1 | Profile picture upload + display | ✅ Done — backend `/upload` endpoint live, fetch-based multipart from app, badges + image on Profile + Home. Azure may wipe `wwwroot/images` on restart — move to Blob if it becomes a problem. |
| 2 | QR scanner "could not read" | ✅ Done — was `CameraView.scanFromURLAsync` (doesn't exist) + `ImagePicker.MediaTypeOptions.Images` (removed in SDK 54). Both fixed. |
| 3 | Health Connect on Android 16 | ⏸️ Deferred — manifest passes Google's docs but PermissionsActivity still rejects with `App should support rationale intent`. Likely react-native-health-connect v3.5 / Android 16 incompatibility. See CLAUDE.md "Health Connect on Android 16 — known limitation". |
| 4 | Home/Stats crash | ✅ Done earlier (2026-05-31) — WeeklyBarChart/ZoomedBarChart needed `styles` as prop. |
| 5 | Coach-only role gating | ✅ Done — added `Users.IsTrainee` column, sp_InsertUser + sp_LoginUser updated, NavigationStack hides Health tab, HomeRouter forces CoachDashboardScreen, ProfileScreen hides training rows. Open issue: users who flip to coach after signup have no `Coaches` row; the QR Connect flow blocks until backfilled. |
| 6 | Keyboard hiding injury notes | ✅ Done earlier (2026-05-31) — KeyboardAvoidingView wrap on InjuryReportScreen. |
| 7 | AI chatbot OpenAI key | ⏸️ Deferred — key was leaked twice mid-session and must be rotated. EXPO_PUBLIC_* vars are baked into APK in plaintext; don't redistribute the APK publicly. |
| 8 | Acute load tile on Warnings | ✅ Done 2026-06-03 — third metric between AC Ratio and Stress, colored by level. |
| 9 | Streak / coins relocation | ✅ Done 2026-06-03 — flat icons top-left of HomeScreen (flame + 🪙), no container, still tappable to Shop. |
| 10 | App logo | ✅ Done 2026-06-03 — `wowowow.png` wired as launcher icon, Android adaptive icon (background `#13173d`), and notification icon. May need a separate silhouette PNG if the colored logo renders as a white blob on the status bar. |
| 11.1 | Load-aware daily reminder | ✅ Done 2026-06-03 — `scheduleDailyReminder(acRatio, loadLevel)` fires at 18:00. Body picks "keep it moderate" / "you're fresh" based on load. Suppressed entirely when Red or acRatio>1.5. |
| 11.2 | Duolingo-style escalation | ✅ Done 2026-06-03 — 4 tiers based on `daysSinceLastOpened` (friendly → mild guilt → "gains getting cold" → "TrainWise misses you 😢"). `markAppOpened()` on app launch and HomeScreen focus persists the timestamp. |
| 11.3 | Remove per-workout debug push | ✅ Done 2026-06-03 — `sendLoadWarningIfNeeded` no longer fires the TEMP TEST OVERRIDE. |
| **12** | **Route maps for running/walking/swimming/hiking** | 🟡 **NEXT — Google Maps via react-native-maps. Awaiting user Google Cloud setup before coding.** |

## #12 — Route maps, full brief

### User's intent (verbatim summary)

"Add Strava-style route maps for running / walking / swimming / hiking workouts — accessible via the Health page tapping the workout, using Google Maps or similar."

User chose **Google Maps** over OpenStreetMap when given the choice, accepting the API key + billing setup.

### Where this goes in the app

- Entry point: tapping a cardio workout on [GoogleFitScreen.js](TrainWiseExpo/src/api/GoogleFitScreen.js) (the Health tab — the file name is legacy, it's actually the Health Connect list screen).
- New screen: `WorkoutRouteScreen.js` (or extend the existing `WorkoutSummaryScreen.js`). Pushed onto HomeStack (HealthStack would also work but the existing pattern routes through HomeStack).
- Activity types that should show a map: running, walking, swimming, hiking, cycling. Indoor workouts (gym, weightlifting) should NOT show the map button.

### Data source

The backend has GPS data only if it comes from Health Connect. Health Connect's `ExerciseSessionRecord` includes `route` (a list of `{ time, latitude, longitude, altitude? }` points) when the source app recorded GPS. Manual workouts logged via AddWorkoutScreen have no route data.

**Verify before coding**: does our current [HealthConnectService.js](TrainWiseExpo/src/api/HealthConnectService.js) actually fetch the route? Last time it was checked it pulled session metadata only. Add the route read.

If HC provides no route (manual workout or source didn't record GPS), the map UI should fall back gracefully — show a "No route recorded for this workout" placeholder, not a crash.

### Storage decision (open question for user)

GPS routes are large. Two options:

1. **Pull from Health Connect on view** — never persist, re-fetch the route each time the user taps the workout. Simpler, but the source HC record might be deleted by the user / source app, leaving the workout permanently un-mappable.
2. **Persist to backend** — add a `WorkoutRoutes` table or a JSON column on `ActivityLogs`. Survives HC deletion. Costs DB space (~5KB per workout for a 1hr run sampled every 5s).

Ask user before picking. For now lean toward option 1 (zero schema work) and migrate to option 2 only if HC deletion becomes a problem.

### Google Cloud setup (user does this manually before any code)

The user needs to do this in Google Cloud Console — Claude cannot. Walk them through it at the start of the next session:

1. Go to https://console.cloud.google.com and create a new project (or reuse an existing one). Name it `trainwise-maps` or similar.
2. Enable the **Maps SDK for Android** API: APIs & Services → Library → search "Maps SDK for Android" → Enable.
3. Create an API key: APIs & Services → Credentials → Create Credentials → API key.
4. **Restrict the key**: click the key → Application restrictions → "Android apps" → add the TrainWise app's package name (`com.anonymous.TrainWiseExpo`) and the SHA-1 fingerprint of the signing certificate. For debug builds the SHA-1 is in `~/.android/debug.keystore` (cmd: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`). For release builds, use the release keystore SHA-1.
5. **Enable billing** on the Google Cloud project. Maps SDK requires it even for free-tier usage (Google grants $200/month free credit which covers normal hobby app traffic). User must add a credit card.
6. Copy the API key. They'll paste it into `app.json` under `expo.android.config.googleMaps.apiKey` (next step is mine).

### Implementation plan (when user has the key)

1. `npm install react-native-maps` in TrainWiseExpo. RN-maps works without an Expo config plugin because it's autolinked.
2. Add to `app.json`:
   ```json
   "android": {
     ...
     "config": {
       "googleMaps": {
         "apiKey": "<USER_KEY>"
       }
     }
   }
   ```
3. Update [HealthConnectService.js](TrainWiseExpo/src/api/HealthConnectService.js) to include the `route` field when reading `ExerciseSessionRecord`. Confirm the returned shape matches docs: `route.route: Array<{ time: ISOString, latitude: number, longitude: number, altitude?: number }>`.
4. New screen `src/screens/WorkoutRouteScreen.js`:
   - Receives `workout` via route params (the full ActivityLog object).
   - Pulls route points from HC by matching `startTime` (option 1) OR reads them from a new column (option 2).
   - Renders `<MapView>` with `<Polyline coordinates={points} strokeWidth={4} strokeColor={Colors.primary}>`.
   - Auto-fits the camera to the route bounds.
   - Shows summary stats above the map (distance, pace, calories, time).
   - Empty state when no route is available.
5. Register the screen in [NavigationStack.HomeStack](TrainWiseExpo/src/navigation/NavigationStack.js).
6. Add a tap handler on cardio-type rows in [GoogleFitScreen.js](TrainWiseExpo/src/api/GoogleFitScreen.js) that navigates to `WorkoutRoute` with the workout as a param. Gate the tap by activity type — don't navigate for gym / weightlifting.
7. Native build required (`app.json` change). `npx expo run:android --variant release`.

### Things that WILL bite

- Newer expo-camera / SDK 54 APIs changed call shapes. Verify react-native-maps version compatibility with RN 0.81 / New Architecture (`newArchEnabled: true` in app.json) before committing to a version. Maps 1.18+ supports the new arch.
- Indoor swim workouts won't have a route. Treat swim specially: still try to render, but expect empty.
- HC permission `READ_EXERCISE_ROUTE` may be a separate scope from `READ_EXERCISE`. Check matinzd/react-native-health-connect docs and add it to AndroidManifest + app.json + the SDK permission request if so.
- iOS path isn't maintained (per CLAUDE.md). Don't waste time on iOS Apple Maps fallback.

## Other state worth carrying over

### Most recent backend/SQL state

User ran the IsTrainee migration successfully on 2026-06-02:
- `Users.IsTrainee BIT NOT NULL DEFAULT 1` exists.
- `sp_InsertUser` accepts `@IsTrainee BIT = 1`.
- `sp_LoginUser` SELECT includes `IsTrainee` (manual edit added it to the explicit column list).
- `sp_GetUserByID` and `sp_GetAllUsers` use `SELECT *` so they auto-pick up the column.
- API republished from VS 2022 with matching C# changes.

### Last working state of the Expo app

All frontend changes from 2026-06-02 and 2026-06-03 are committed to disk but the user may not have rebuilt the APK with the latest notification redesign yet. At minimum these files have changes that need a fresh build:
- `app.json` (logo wiring — requires native rebuild)
- `src/screens/HomeScreen.js` (streak/coins relocation, scheduleDailyReminder call)
- `src/screens/WarningsDashboardScreen.js` (acute load tile)
- `src/api/NotificationService.js` (full redesign)
- `App.js` (markAppOpened + new scheduleDailyReminder import)
- `src/screens/ConnectQRScreen.js` (scanFromURLAsync fix + retry logic)
- `src/screens/ProfileScreen.js` (badge clipping fix + image upload via fetch)
- `src/services/api.js` (uploadProfileImage fetch-based + resolveProfileImageUrl)

If the next session opens with a user report of "feature X doesn't work", first ask whether the APK was rebuilt since 2026-06-03.

### Pending non-#12 follow-ups

- **Coach row backfill** — UserBL.Create only inserts into `Coaches` when IsCoach=true at signup. Users who flip to coach later are stuck. Add either a lazy-create in CoachBL.GetByUserId or a one-off backfill script.
- **Azure wwwroot persistence** — verify profile images survive Azure App Service restarts. If they don't, migrate to Azure Blob Storage or persisted disk.
- **HC route permission** — verify `READ_EXERCISE_ROUTE` is included in the HC permission scope set (needed before #12).
- **OpenAI key rotation** (#7) — still compromised, user has not rotated it. Don't ship release APKs publicly until they have.
- **HC Android 16 discovery** (#3) — still blocked at "App should support rationale intent". Try `react-native-health-connect@latest` or upstream issue.

## Files to read at start of next session

In this order:
1. `CLAUDE.md` (always — the lessons + architecture)
2. `tasks/lessons.md` (always — corrective rules)
3. This file (`tasks/conversation_resume_2026_06_03.md`)
4. `src/api/HealthConnectService.js` (does it currently read routes?)
5. `src/api/GoogleFitScreen.js` (where the workout-tap entry point lives)
6. `src/screens/WorkoutSummaryScreen.js` (the existing per-workout screen; might extend it instead of creating a new one)

## Memory pointers

Auto-memory entries that are current:
- `project_trainwise_session_2026_04_22.md`
- `project_trainwise_session_2026_06_02.md` (covers profile pic + QR + IsTrainee)

Should be written at end of next session:
- `project_trainwise_session_2026_06_03.md` (#8 / #9 / #10 / #11 done, #12 attempted/done)

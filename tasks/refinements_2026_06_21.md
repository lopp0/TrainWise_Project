# Device-test refinements — 2026-06-21 (13 items)

Round of fixes from device testing of the Group A/B sprint. Most are JS-only;
four touch the backend (SQL + C# Publish). One (push) needs a Firebase step.

## Deploy steps

### 1. SQL migrations (run on BOTH local SQL Express AND Azure SQL, idempotent)
- `sql/2026-06-21_add_board_image.sql` — `WorkoutPosts.ImagePath` (item 9)
- `sql/2026-06-21_add_push_token.sql` — `Users.PushToken` (item 12)

### 2. C# Publish (VS2022 → right-click TrainWise → Publish)
Changed/new files:
- `Models/BoardModels.cs` (+ImagePath on WorkoutPost + CreateWorkoutPostRequest)
- `DAL/BoardDAL.cs` (select/insert ImagePath; ALL leaderboard metrics now 7-day)
- `Controllers/WorkoutBoardController.cs` (pass ImagePath)
- `DAL/UserDAL.cs` (+SetPushToken / GetPushToken)
- `BL/UserBL.cs` (+SetPushToken), `Controllers/UsersController.cs` (PUT `{id}/pushtoken` + PushTokenRequest)
- `BL/MessageBL.cs` (push receiver on send), `BL/CalendarBL.cs` (push trainee on coach-plan)
- **NEW** `BL/PushSender.cs` (Expo Push API sender, fire-and-forget)

### 3. APK rebuild (JS changes — caches are warm, fast rebuild)
From `TrainWiseExpo/android`:
```
Remove-Item -Recurse -Force .\app\build\generated\assets\createBundleReleaseJsAndAssets -ErrorAction SilentlyContinue
$env:NODE_OPTIONS = "--max-old-space-size=8192"
.\gradlew assembleRelease --no-parallel
```

## What changed, per item
1. **Add Workout fold/expand** — HomeScreen. Default = compact horizontal row; chevron ("All") expands to a full grid of every activity.
2. **Mis-sized fix** — WeeklySummaryCard had `marginHorizontal:16` on top of the ScrollView's `paddingHorizontal:16`, so it rendered narrower than the chart/cards above it. Removed.
3. **Add Injury** — open by default (row visible); injury types now look like the workout cards (row → grid). Active injuries moved OUT of the section to a slim banner under the greeting (tap → ActiveInjuries).
4. **This Week at a Glance** — collapsed by default.
5. **Target picker** — AddWorkout target is now a ComboBox + a big +/- value stepper (km/min/kcal), replacing the chip row.
6. **Injury icons** — remapped to coherent glyphs (Knee Pain was `account-injury` = arm-in-sling → now `human-cane`; neck/blister/etc fixed). All verified against the MCI glyphmap.
7. **Break button** — AddWorkout live timer has Break/Resume (pauses the clock) next to Stop.
8. **Map pins** — Connect map rasterizes glyphs into marker icons: dumbbell (orange) for gyms, person (teal) for users. Falls back to default pins if rasterizing fails.
9. **Board photos** — pick + preview + upload a photo on a board post (reuses `/messages/upload`); shown in the feed. Needs SQL #1 + Publish.
10. **Leaderboard weekly** — Distance/Duration/Calories were all-time totals; now ALL four metrics are 7-day (matches Load). Subtitle says "this week". Needs Publish.
11. **Calendar** — redesigned as a real month-grid calendar (month nav, status dots, tap a day to see/add plans). Add/edit modal is keyboard-safe (ScrollView + KeyboardAvoidingView). **Completing a plan now asks exertion + confirms duration/distance, creates a confirmed ActivityLog (sourceDevice='Planned'), links it, and recalcs DailyLoad** — so it shows in the Health tab and counts toward load. (Frontend only.)
12. **Push when app closed** — full plumbing built: device registers an Expo push token (`registerForPushToken` in NotificationService, called from MessagesContext), backend stores it (Users.PushToken) and sends via the Expo Push API on (a) new chat message → receiver, (b) coach-planned workout → trainee. **PREREQUISITE (cannot work without it): Android remote push needs FCM.** See below.
13. **Swipe conflict** — AddWorkout no longer uses a swipe pager between Live/Already-Done (tap-only tabs), so the exertion slider and the suggested-activity chips stop hijacking the page swipe.

## Item 12 — direct FCM (FirebaseAdmin), 100% free, sent from the Azure backend
Architecture: device gets its **native FCM token** (`getDevicePushTokenAsync`),
backend stores it (`Users.PushToken`) and sends straight to **FCM HTTP v1** via
the **FirebaseAdmin** NuGet (`BL/PushSender.cs`). No Expo push relay, no Azure
Notification Hubs. FCM is free/unlimited.

Code already wired:
- Backend: `BL/PushSender.cs` (FirebaseAdmin), `FirebaseAdmin` added to `TrainWise.csproj`.
  Reads the service-account JSON from env var `FIREBASE_CREDENTIALS_JSON`.
- Native: `android/build.gradle` (google-services classpath 4.4.2),
  `android/app/build.gradle` (applies `com.google.gms.google-services` ONLY when
  `google-services.json` exists — so a build without it still succeeds, push off).
- app.json: `android.googleServicesFile` set (for any future prebuild).
- Frontend: `registerForPushToken` uses `getDevicePushTokenAsync()`.

One-time setup (all free, no credit card):
1. Firebase Console → create project (free Spark plan) → Add app → **Android**,
   package `com.anonymous.TrainWiseExpo` → download **`google-services.json`** →
   put it at `TrainWiseExpo/android/app/google-services.json`.
2. Firebase → Project Settings → **Service accounts → Generate new private key**
   (a JSON). In **Azure App Service → Configuration → Application settings** add
   `FIREBASE_CREDENTIALS_JSON` = the full JSON contents. (Keeps the secret out of
   source — never commit it.) Locally, set the same env var to test.
3. Publish the C# (restores FirebaseAdmin) + rebuild the APK.

Until `google-services.json` + `FIREBASE_CREDENTIALS_JSON` are in place, both the
device token call and `PushSender` no-op gracefully and the in-app (foreground)
poller keeps working. After FCM is live you may want to drop the foreground
`sendLocalNotification` in MessagesContext to avoid a double notification when the
app is open.

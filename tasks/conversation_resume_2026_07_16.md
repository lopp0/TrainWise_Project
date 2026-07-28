# TrainWise — Conversation Resume (2026-07-15 → 2026-07-16)

> Session summary covering the **Workouts & Wearables** medium-feature batch (build)
> and the **device-test fix pass** (12 items) that followed. Written before the
> next APK rebuild. Companion memory files:
> `project_trainwise_session_2026_07_15.md`, `project_trainwise_session_2026_07_16.md`.

---

## 1. Context at the start

The previous session (Phase 9) had rearchitected the trainee **Load-tab ACWR/EWMA
charts** to call the Python ML service first (same pattern as the coach forecast),
plus a course notebook, coach graph `?` help modals, and pain-tracker→coach. The
first **medium batch** (injury + analytics theme) was already shipped:
#115, #122, #125, #126, #148, #164, #165, #174, #180, #183.

---

## 2. Batch built — "Workouts & Wearables" (10 medium features, 2026-07-15)

Chosen by the user from 4 themed options. All JS validated with `@babel/parser`,
C# built with 0 errors.

| # | Feature | Summary |
|---|---------|---------|
| **119** | Workout templates | `WorkoutTemplates` table + controller/BL/DAL; AddWorkout "Already Done" tab: template chips (tap=apply, long-press=delete) + "Save as template" modal. |
| **123** | Export history (CSV) | `utils/exportHistory.js` — CSV-injection-guarded, `expo-file-system` + `expo-sharing`; button in Settings → "Your data". Own data only. |
| **132** | Nutrition & hydration | `NutritionLog` table + `NutritionController`; `NutritionScreen`; syncs to the Home ring. |
| **166** | Barcode scanner | `utils/openFoodFacts.js` (keyless Open Food Facts) + `CameraView` scanner in NutritionScreen. |
| **135** | Video form-check | `UploadValidator.TryValidateVideo` + `POST /messages/upload/video`, `Messages.VideoPath`; chat video bubble. |
| **139** | Voice messages | `TryValidateAudio` + `POST /messages/upload/audio`, `Messages.AudioPath`; `expo-audio` record + playback bubble. |
| **146** | Dynamic gym search | `BL/PlacesService.cs` server-side Google Places proxy (key in `GOOGLE_PLACES_KEY` env only, 6h cache), `GymBL.GetNearbyMerged`, `GET /api/gyms/nearby`. Degrades to seeded gyms when no key. |
| **181** | Deep-link share | `ActivityLogs.IsShared`; owner `PUT /{id}/share` + anon `GET /{id}/public` (non-sensitive only); `SharedWorkoutScreen` + App.js `expo-linking` listener; Share button on WorkoutSummary. |
| **129 / 130** | Sleep→readiness + resting-HR/HRV | HC reads in a **separate** permission set (so workout sync isn't affected); `utils/recovery.js` blends sleep+RHR+HRV+ACWR into a 0-100 score; `ReadinessCard` Home widget. |

**Migration:** `sql/2026-07-15_add_workouts_wearables.sql` (Messages Audio/VideoPath +
procs, WorkoutTemplates, NutritionLog, ActivityLogs.IsShared).
**New deps:** `expo-sharing`, `expo-audio`. **Native:** manifest +3 HC readiness perms.

APK was then **built successfully** (~130 MB, verified fresh timestamp).

---

## 3. Google Places key setup (explained)

- Server-side only (`GOOGLE_PLACES_KEY` env var), never in the app.
- Enable the **legacy "Places API"** (not just "Places API (New)").
- Restrict the key by **API**, not "Android apps" (server calls carry no Android
  attestation → 403).
- Set locally: `[Environment]::SetEnvironmentVariable("GOOGLE_PLACES_KEY", "<key>", "User")`
  then **restart Visual Studio**. On Azure: App Service → Configuration.
- Without the key, `/api/gyms/nearby` silently returns seeded gyms (no error).

---

## 4. Device-test fix pass (12 items, 2026-07-16)

All JS validated (17 files pass), C# builds 0 errors.

### Nutrition / calories cluster (#2)
- **2a — barcode kcal:** `openFoodFacts.js` now reads energy across all OFF
  fields/units (kcal_100g, kJ_100g/energy_100g ÷ 4.184, per-serving). "Not found"
  = OFF genuinely lacks that (often Israeli) product; source = Open Food Facts
  (free, crowd-sourced, keyless).
- **2b — merge + hydration:** Home CalorieRing is now the single place — server-backed
  calories **and** water, a **hydration bar** (goal 2.5 L) with quick water adds. The
  separate screen is now just barcode/full-log detail.
- **2c — exercise calories:** `estimateWorkoutCalories` (MET = 1.5 + exertion × weight ×
  hours) fills in manual workouts that store 0 kcal.
- **2d — BMR Base:** `utils/calories.js` `computeBMR`/`computeTDEE` (Mifflin-St Jeor,
  gender-aware, activity factor). Adaptive to profile; not hardcoded. Standard rounding.

### Chat media (#3, #4)
- **3 — video:** cap raised 45 → **100 MB** (`MaxVideoBytes` + `[RequestSizeLimit(105MB)]`
  + `RequestFormLimits`). In-app player `components/VideoPlayerModal.js` (**expo-video**,
  installed) replaces the external browser. **Pinch-zoom** `components/ZoomableImage.js`
  (gesture-handler + reanimated); App.js now wraps in `GestureHandlerRootView`. Used in
  chat + board image viewers.
- **4 — voice:** WhatsApp-style — deterministic waveform per message, played/unplayed bar
  coloring, and a **progress dot** tracking `playbackStatusUpdate` currentTime/duration.

### Explanations / verifications (#5, #6, #7)
- **5 — gyms:** added `PlacesService.LastStatus/LastError` + **`GET /api/gyms/places-debug`**
  to diagnose. Test the endpoint in the browser **address bar** (user had pasted it into
  Google *search*). `SetEnvironmentVariable` returning nothing is normal.
- **6 — deep link:** works — manifest has the `trainwiseexpo` scheme + App.js listener.
  A browser **cannot** open a custom scheme (expected). Test with
  `adb shell am start -a android.intent.action.VIEW -d "trainwiseexpo://workout/112"`.
- **7 — readiness:** empty-state now distinguishes **granted-but-no-data** ("No sleep/HR
  data in HC yet — Retry") from not-connected. If the watch/phone doesn't sync
  Sleep/RestingHR/HRV to Health Connect, there's nothing to score.

### Bugs fixed (#8, #9, #10)
- **8 — today's plan:** **casing bug** — the card read `activityTypeID` but the calendar
  serializes `activityTypeId` (lowercase "d"), so nothing preselected. Fixed; now also
  passes `plannedDuration`/`plannedDistance` and opens the "Already Done" tab (AddWorkout
  applies them).
- **9 — drill-down:** Home weekly bar → modal listing that day's **individual** workouts
  (not merged), each → WorkoutSummary.
- **10 — load tab:** "Current Status" AC ratio/level now **unified** with the injury-risk
  gauge + load-trend (all use `computeLoadAnalytics` rolling ratio). Added a mild
  injury-risk ramp (1.0-1.3) so a Yellow ratio isn't a flat-0 gauge. **Confirmed to user:**
  the Python pivot only touched the 2 Load-trend charts — the risk gauge is client-side JS,
  never Python.

### New feature + cleanup (#11, #12)
- **11 — board comments (#143, NEW):** `WorkoutPostComments` table
  (`sql/2026-07-16_add_board_comments.sql`), BoardBL/DAL + `GET/POST /api/board/{postId}/comments`,
  `DELETE /api/board/comments/{id}`. One-level nesting (reply-to-comment).
  WorkoutBoardScreen: comment sheet + reply + delete-own, tappable post image →
  `ZoomableImage` viewer, **likes kept**.
- **12 — settings:** removed the "Home Page" button.

---

## 5. Deploy checklist (before/after the next build)

1. **SQL** (run on local SQL Express + Azure SQL, in order):
   - `sql/2026-07-10_fix_injury_link_ondelete.sql` (still pending from earlier)
   - `sql/2026-07-15_add_workouts_wearables.sql`
   - `sql/2026-07-16_add_board_comments.sql`
2. **C# Publish** — new/changed controllers: Nutrition, WorkoutTemplates, ActivityLog
   (share/public), Gyms (nearby + places-debug), Messages (audio/video upload, larger
   video limit), WorkoutBoard (comments).
3. **APK rebuild** — required: native additions `expo-video`, `expo-audio`, `expo-sharing`,
   `GestureHandlerRootView`, +3 HC readiness manifest permissions. No `expo prebuild`.
4. **Optional:** set `GOOGLE_PLACES_KEY` server env var to enable live gym search (#146).
5. On device: grant the new Health Connect readiness permissions (#129/#130).
6. Doc-sync to `main` (`docs/featureslist.md`, `features.md`, `SETUP.md`) still pending
   per the standing rule (that branch isn't checked out in this session).

---

## 6. Files added this session (new)

**Backend:** `BL/PlacesService.cs`, `BL/NutritionBL.cs`, `BL/WorkoutTemplateBL.cs`,
`DAL/NutritionDAL.cs`, `DAL/WorkoutTemplateDAL.cs`, `Controllers/NutritionController.cs`,
`Controllers/WorkoutTemplatesController.cs`, `Models/NutritionEntry.cs`,
`Models/WorkoutTemplate.cs`, `Models/PublicWorkout.cs`, `Models/BoardComment` (in
BoardModels.cs).
**SQL:** `2026-07-15_add_workouts_wearables.sql`, `2026-07-16_add_board_comments.sql`.
**Frontend:** `screens/NutritionScreen.js`, `screens/SharedWorkoutScreen.js`,
`components/ReadinessCard.js`, `components/ZoomableImage.js`, `components/VideoPlayerModal.js`,
`utils/openFoodFacts.js`, `utils/calories.js`, `utils/recovery.js`.

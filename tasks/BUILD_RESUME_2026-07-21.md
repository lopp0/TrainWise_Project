# TrainWise — Build Resume (2026-07-21)

A complete record of the last major build cycle: the **3 hard (🔴) backlog features**, every
modification made to them across the device-test rounds, the **Python ML Azure deployment**, and the
**final refinement batches**. Extra depth is given to the new ML feature, the **What-if planner (#185)**.

- **Backend mode:** Local LAN (`BACKEND_MODE='local'`) / ML `ML_MODE='local'` — flip both to `'azure'` to use the cloud.
- **Deliverable APK:** `TrainWiseExpo/android/app/build/outputs/apk/release/app-release.apk`.
- **Test device:** Samsung Galaxy S25+ (Android 16).

---

## Part 1 — The three 🔴 features

### #185 What-if forecast simulator  ⭐ (the new ML deliverable)

**Goal.** Make the monthly forecast *interactive*: a coach (or the trainee themselves) dials in "add
**N** sessions this week at **easy / medium / hard**" and immediately sees where the athlete's
injury-risk ratio (ACWR) would land — *before* the sessions are trained.

#### Why it is meaningful (the sports science)

$$\text{ACWR} = \frac{\text{acute load (last 7 days)}}{\text{chronic load (last 28 days, weekly avg)}}$$

Adding sessions **this week** loads the **acute** (7-day) window immediately, while the **chronic**
(28-day) average barely moves. So the ratio climbs mostly through the numerator — exactly the real
physiological effect ACWR is designed to catch. The planner lets you watch the risk pill flip
green → amber → **red** before it happens on the body.

- Sweet spot **0.8–1.3**; **>1.3** spiking; **>1.5** danger; **<0.8** detraining.
- Intensities are fixed session loads: **easy = 150, medium = 300, hard = 450** (`load = minutes × RPE`).

#### Backend — `ml/forecast.py :: simulate_whatif()`

```
WHATIF_SESSION_LOAD = {"easy": 150.0, "medium": 300.0, "hard": 450.0}
WHATIF_MAX_SESSIONS = 14   # server-side clamp (DoS-safe; also debounced client-side)
```

Algorithm (`simulate_whatif(trainee_id, add_sessions, intensity, tz_offset_minutes)`):
1. Load the user + active-injury count (injury tightens the risk bands to Red ≥ 1.2).
2. **Clamp** `add_sessions` to 0–14 and `intensity` to one of the three keys (never trust the client).
3. Build the **daily load series** from the real `ActivityLogs` over the trailing 28-day (chronic) window,
   bucketed to the user's local day via `tzOffsetMinutes`.
4. **Baseline** = `_state_from_rolled(rolling_loads(daily), today)` → `{acRatio, acute, chronic, level}`.
5. **Simulated** = copy the series, add `add_sessions × session_load` onto **today**, recompute with the
   **same** `rolling_loads`. Placing all the added load on today gives the same weekly *acute* as
   spreading it across the week (acute is a rolling 7-day **sum**), while keeping the comparison at a
   single time point so the delta isolates exactly the sessions dialed in. Chronic is **recomputed**
   (not frozen) — a few sessions barely move the 28-day average, so the ratio rises mostly through acute.
6. Return both states + `sessionLoad`, `addedLoad`, `hasInjury`, and a Safe/Warning/High `risk` for each.

The rolling math (`ml/features.py :: rolling_loads`) is **byte-for-byte** the same as C#
`LoadCalculationBL` and JS `utils/acwr.js`: rolling 7/28-day windows, **dynamic cold-start floor**
(bootstrap 150/280/420 when < 7 active days), and the **covered-days ramp**
(`chronic = sum28 / min(4, covered/7)`), so the projected number is consistent with every other load
surface in the app.

#### API

```
GET /api/ml/trainee/<id>/whatif?addSessions=<0..14>&intensity=easy|medium|hard&tzOffsetMinutes=<int>
→ {
    traineeId, addSessions, intensity, sessionLoad, addedLoad, hasInjury,
    baseline:  { acRatio, acute, chronic, level, risk },
    simulated: { acRatio, acute, chronic, level, risk }
  }
```

Added to `ml/app.py` with the same generic-error + 404 handling as the other ML routes.

#### Client + UI

- `src/services/mlApi.js :: getTraineeWhatIf(traineeId, addSessions, intensity)` — passes
  `tzOffsetMinutes`; the caller debounces slider drags.
- `src/screens/CoachTraineeAnalyticsScreen.js` — a **"What-if planner"** card:
  - Segmented **intensity** control (Easy / Medium / Hard) + a **sessions slider** (0–10).
  - **Debounced 350 ms** call so dragging the slider never hammers the service; stale in-flight responses
    are dropped.
  - Renders **Now → simulated**: AC ratio + colored risk pill for each, plus a plain-language line
    ("Adding 3 hard sessions (+1350 load) takes your 7-day acute from 540 to 1890").
  - Serves **coach and trainee** (the screen already doubles as the trainee's "My analytics" via `self`).

#### Verified

Against the live local DB: **+0 → no change (1.06)**, **+3 hard → 1.06 Warning becomes 1.93 High**
(acute 540 → 1890, exactly 3 × 450), **+8 → 2.34 High**. Monotonic and pushes into the red exactly as
the acceptance criteria require.

#### Data-science notebook

`ml/notebook/TrainWise_WhatIf_Planner.ipynb` — the gradeable write-up, matching the style of
`TrainWise_Load_Analytics.ipynb`:
- §2 synthetic 28-day history; §3 rebuilds the rolling ACWR with the cold-start floor + covered-days ramp;
- §4 the notebook twin of `simulate_whatif`; §5 the **response curve** (AC ratio vs sessions added, per
  intensity, over the sweet-spot band); §6 a **linear surrogate** (Task 1 regression, `MAE`/`R²`) showing
  the response is ~linear in added load; §7 a **"safe headroom"** sweep (how many medium sessions until
  ACWR 1.3, as a function of the athlete's chronic base).
- **Runs end-to-end** (verified: `+3 hard: 0.79 Safe → 1.63 High`).

---

### #133 Assigned training programs  ⭐

**Goal.** A coach builds a reusable **weekly** program and assigns it to a trainee; the sessions fan out
onto the trainee's calendar, and each program has a discussion thread.

#### Backend
- **SQL** `sql/2026-07-21_add_programs.sql` (run on BOTH local SQL Express AND Azure SQL):
  `TrainingPrograms`, `ProgramWorkouts`, `ProgramAssignments`, a `SourceAssignmentId` column on
  `PlannedWorkouts` (for clean unassign), and per-assignment chat `ProgramMessages` /
  `ProgramMessageReactions` / `ProgramMessageReads` (mirrors the event-chat schema).
- **C#** (three-layer, inline parameterized SQL like `CalendarDAL`): `Models/ProgramModels.cs`,
  `DAL/ProgramDAL.cs`, `BL/ProgramBL.cs`, `Controllers/ProgramsController.cs`. Builds with **0 errors**.
- **Design (after device-test):** a program is a **weekly pattern keyed by day of week** (no per-workout
  "week" field). Assigning **repeats the pattern for every week** of the program's duration, computing
  `PlannedDate = StartDate + (week-1)×7 + dayOfWeek`, and enforces **one planned workout per day**
  (both in the fan-out and in the manual calendar via `CalendarBL`).
- Endpoints: create / **update (PUT)** / delete a program, assign, list-for-trainee / list-for-coach,
  assignment detail, delete assignment, and the per-assignment chat routes. Gated by `CallerMayAct` /
  `CallerOwnsOrCoaches` + a participant check.

#### Frontend
- `services/api.js` — program CRUD + `updateProgram` + program-chat helpers.
- Screens: **`ProgramBuilderScreen`** (weekly builder, Sunday→Sat day chips, activity icons,
  KeyboardAvoidingView, edit mode, **"Save & assign to [name]"** which auto-starts next Sunday),
  **`CoachProgramsScreen`** (manage + pick-to-assign; tapping a program opens it to edit),
  **`MyProgramsScreen`** (trainee list), **`ProgramDetailScreen`** (plan overview + chat + unassign).
- Entry points: coach → CoachTraineeDetail **"Training program"** (merged with the old calendar block,
  with a small "schedule single days" link kept); trainee → TrainingCalendar **"My training programs"**.
- **Program chat** opens the **existing 1:1 coach↔trainee conversation** (ChatScreen), not a separate thread.

---

### #121 Live GPS run tracking  ⭐

**Goal.** Record the user's OWN outdoor route (not only Health Connect imports), draw it live, save it.

- **`src/screens/LiveRunScreen.js`** — start / pause / resume / finish + an effort-review step; on save it
  writes an ActivityLog (`sourceDevice='GPS'`, `load = duration × exertion`, then `calculateDailyLoad`
  ×2) and persists the polyline to AsyncStorage **keyed by the log id**.
- **`WorkoutRouteScreen`** accepts a `routePoints` param (immediate view) and reads the log-id-keyed route
  before falling back to Health Connect; the Health list shows a **"View route"** button for GPS workouts.
- Entry points: **"Track a run with GPS"** on the Health tab, and **"Track route with GPS"** on
  AddWorkout's live tab (for outdoor activities, preselecting the chosen activity).
- **Activity set** (`GPS_TRACKABLE_IDS`): Run, Walk, Cycle, Trail, Hike, Nordic, Brisk, Interval — a
  scrollable chip row using the app's canonical `ActivityIcon` glyphs + identity colors.
- **Background tracking (Samsung-Health style)** — see the dedicated section in Part 3.

---

## Part 2 — Python ML service on Azure

The Python ML microservice (Flask, port 8000 locally) went **live on Azure App Service** this cycle.

- **Dual-mode DB** (`ml/db.py`): `pyodbc` + Windows Integrated Security locally; automatically switches to
  **`pymssql` + Azure SQL (SQL auth)** when `AZURE_SQL_USER` / `AZURE_SQL_PASSWORD` env vars are present.
  `gunicorn` + `pymssql` are Linux-marked in `requirements.txt` (Azure installs them; local Windows skips).
- **Live resource:** `trainwise-ml` →
  `https://trainwise-ml-gqb8fvbzhbajfqdx.israelcentral-01.azurewebsites.net` · `/health` → `{"db":true,"status":"ok"}`.
- **Deploy method:** build a clean folder `ml_deploy_clean` (app.py, db.py, config.py, features.py,
  forecast.py, risk.py, auth.py, requirements.txt, .deployment, models/) → VS Code Azure panel →
  right-click `trainwise-ml` → **Deploy to Web App** → pick `ml_deploy_clean` (NOT `ml`, whose local venv
  broke the deploy).
- **Required App Settings (4):** `TRAINWISE_SQL_SERVER=trainwiseadmin01.database.windows.net` (note the
  `01` — the wrong-server gotcha), `AZURE_SQL_USER=TrainWiseAdmin`, `AZURE_SQL_PASSWORD=<pwd>`,
  `TRAINWISE_SQL_DATABASE=TrainWiseDB`.
- **Gotcha:** the serverless Azure SQL **auto-pauses**; the first `/health` after idle can return
  `{"db":false}` for ~30 s while it wakes. **Refresh a couple times** and it flips to `true`.
- **Client toggle:** `mlApi.js` now mirrors `backend.js` — `ML_MODE = 'local' | 'azure'` one-line switch.
  Currently **`'local'`**, so the app uses the local Python service (the coach Analytics, trainee Load
  Trend, and the What-if planner all need it reachable on the same WiFi, or flip to `'azure'`).

> Note: to *use* the Azure ML service, set `ML_MODE='azure'` in `mlApi.js` and rebuild the APK.
> The `/whatif` endpoint must be present on whichever instance is active (redeploy the clean folder if
> Azure is behind).

---

## Part 3 — Refinement rounds (device-test fixes)

Multiple rounds of on-device testing produced fixes across the new features and older surfaces.

### Correctness fixes (the important ones)
- **Coach-view AC ratio (0.35 vs 1.06).** `utils/acwr.js :: computeACWR` used a **calendar-week** acute
  window; switched to **rolling 7/28-day** (matching C#/Python/Load Trend). Now every AC surface agrees.
- **AI recap wrong numbers.** `utils/aiDataContext.js` used raw `sum28/4` for the ratio (read 1.48) and the
  **rolling** 7-day window for the workout count/load (said "4 workouts / 540 this week"). Fixed in two
  steps: the ratio now uses `computeACWR`; the **"this week" count + load now come from the same
  `computeWeeklySummary` the "This week at a glance" card renders** (calendar week), so the recap can no
  longer contradict the card (1 workout / 180). The system prompt also forbids calling the 28-day context
  "this week". *(Recap is cached per ISO week — tap **Regenerate** to refresh old text.)*
- **Injury-risk shows 50 on a new account.** With no workouts, the cold-start floor makes the ratio `0`
  (not `null`), which hit the "detraining" branch → score 50. Added a **no-confirmed-workouts guard** →
  *"Log a workout first."* (`utils/injuryRisk.js`).
- **Chat input hidden by the keyboard.** Root cause: `edgeToEdgeEnabled: true` (SDK 54 default) stops the
  window resizing for the keyboard, so `behavior={undefined}` left the composer underneath. Switched
  ChatScreen, EventChatScreen, ProgramBuilder and AIChat to `behavior="padding"`.

### #133 program refinements
- Removed the per-workout **Week** field → a **weekly pattern that repeats** for the whole duration.
- **Sunday→Sunday** week; **one workout per day**; activity **icons**; keyboard visibility.
- Tapping a program **opens it to edit**; **"Save & assign"** in one tap (auto next Sunday, no date prompt).
- Merged the **Training-plan + Assign-a-program** blocks; **program chat → existing 1:1 conversation**.

### #121 GPS refinements
- Map shows the current location **before Start**; a **pin** is dropped at idle.
- **Wall-clock timer** (no more 2-second jumps); effort value no longer clipped ("10/10").
- Saved route is **viewable later** (keyed by log id; GPS workouts eligible for "View route").
- **All outdoor activities** with correct **icons + colors**; live-workout GPS entry.

### #121 background GPS (native — Samsung-Health style)
- **New dependency:** `expo-task-manager` (~14, autolinks via gradle — no prebuild).
- **`src/utils/liveTracking.js`** — a module-scope TaskManager task + `Location.startLocationUpdatesAsync`
  with a **foreground service** ("TrainWise — tracking your workout" notification). Incoming locations are
  appended to an AsyncStorage buffer; the screen **polls** it to draw the live route and reconstructs
  distance honouring pause windows (pausing truly pauses distance).
- **Manifest permissions** (added manually, preserving the Health Connect aliases):
  `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`. The
  `LocationTaskService` (`foregroundServiceType="location"`) merges from expo-location's own manifest.
- **Build:** `gradlew assembleRelease` (delete `app/.cxx`+`app/build` first to force the native rebuild).
  Do **NOT** `expo prebuild` — it would regenerate the manifest and could wipe the HC aliases. Verified in
  the merged manifest that all three permissions + the service merged correctly.
- On device: grant **"Allow all the time"** location for screen-off tracking; "while using the app" still
  records while the screen is on.

### Other UX
- **AI chatbot history** persists per user (AsyncStorage) + a **clear** button.
- **AI plan generator** — the "Suggested week" is now sorted **chronologically** so its order matches the
  calendar (a "Mon" whose Monday already passed correctly sorts after this week's Wed/Fri).
- **Unified "This week at a glance"** card (stat grid + AI recap in one collapsible card; dropped the
  separate WeekReviewCard).
- Hydration capped at **2 L/day**; the **Recovery** card is collapsed by default; nutrition entry labels
  wrap; the event chat shows the friendly **"video too large (max 100 MB)"** message; the custom alert's
  **"Keep formula"** button no longer truncates.
- **FCM verified fully wired** end-to-end (client token registration → backend store → `PushSender.Send`
  on chat/program-assign/coach-plan/friend/kudos; `google-services.json` + Google Services gradle plugin
  present; `FIREBASE_CREDENTIALS_JSON` set on the server).

---

## Deploy checklist

1. **Database (local SQL Express + Azure SQL):** run `sql/2026-07-21_add_programs.sql` (idempotent).
2. **C# backend:** Publish (program create/update/delete/assign endpoints, weekly-repeat fan-out,
   one-per-day guard).
3. **Python ML service:** ensure `/whatif` is served — run locally (`cd ml && python app.py`) and/or
   redeploy `ml_deploy_clean` to `trainwise-ml`. Restart after redeploy; verify `/health` → `db:true`.
4. **APK:** `gradlew assembleRelease`. This cycle added a **native** module (expo-task-manager) + manifest
   permissions, so a full native rebuild is required; confirm the APK timestamp changed. The OpenAI key is
   baked in at build time, so rebuilding also activates the current `EXPO_PUBLIC_OPENAI_API_KEY`.
5. **Modes:** `BACKEND_MODE` (backend.js) and `ML_MODE` (mlApi.js) are both currently `'local'` — flip to
   `'azure'` + rebuild to run off the cloud.

## Known limitations (deliberate)
- The live GPS **route polyline** is stored **on-device** (AsyncStorage), so it is not synced across
  devices or visible to the coach; the ActivityLog itself is server-saved.
- Editing a program does **not** retro-update calendars of already-assigned trainees (fan-out is at assign
  time) — unassign + reassign to apply changes.

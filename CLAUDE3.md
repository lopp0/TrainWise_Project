# CLAUDE3.md  ·  File 3 of 3

<!-- CLAUDE-CHAIN ─────────────────────────────────────────────────────────────
  This file is part of a linked instruction set. Claude MUST read ALL files
  at the start of every session — each contains non-overlapping guidance.

  • CLAUDE.md  (file 1) → Documentation sync, repo layout, backend modes, architecture
  • CLAUDE2.md (file 2) → Load analytics, theme, auth, social, chat
  • CLAUDE3.md (YOU ARE HERE — file 3)
      Smart workout suggestion, injury scanner, profile pic, push notifications,
      Expo SDK gotchas, Python ML service, live GPS tracking, APK build,
      known pending items, self-learning rule

  AUTO-EXPAND RULE (enforce at end of every session that edits this file):
  If this file exceeds 40 000 characters:
    1. Create CLAUDE4.md (or the next unused number).
    2. Move the bottom-most section(s) from THIS file into it until this file
       is under 38 000 chars.
    3. Update the CLAUDE-CHAIN header in EVERY existing CLAUDE*.md to list the
       new file with a one-line description.
    4. Copy this AUTO-EXPAND RULE block verbatim into the new file.
    5. Never lose content — every section must live in exactly one chain file.
──────────────────────────────────────────────────────────────────────────── -->

## Smart workout suggestion (multi-factor)

Reworked 2026-06-08 (#1+#2). [weatherService.js](TrainWiseExpo/src/api/weatherService.js) pulls the Google **Weather API** (temp, feels-like, humidity, wind, UV, precipitation, cloud) AND the Google **Air Quality API** (Universal AQI, 0–100 higher = cleaner) — a **third separate SKU**; both are best-effort (a disabled SKU or missing datum just hides that factor). [utils/smartWorkout.js](TrainWiseExpo/src/utils/smartWorkout.js) scores temp + humidity + UV + wind + air + rain into a 0–100 conditions score (Great/Good/Fair/Poor) with a per-factor traffic-light breakdown; AC ratio > 1.3 still overrides to recovery. [AddWorkoutScreen.js](TrainWiseExpo/src/screens/AddWorkoutScreen.js) renders this as a **distinct accent-bordered glowing card** (not a plain `<Card>`) with a rating pill + factor grid + activity chips, so it clearly stands apart from the form fields.

## Injury scanner + AI advice

Added 2026-06-08 (#4). [InjuryReportScreen.js](TrainWiseExpo/src/screens/InjuryReportScreen.js) symptoms card now has **Scan injury (photo)** (camera or library via expo-image-picker), **AI advice** (builds a prompt from injury type + severity + notes and calls the existing text-only [openai.js](TrainWiseExpo/src/api/openai.js) `getGPTResponse` — returns the "API key not configured" placeholder until the OpenAI key works; swap for a vision call to analyze the photo later), and **Send to coach** (uploads the scan via `uploadChatImage` + sends a summary through the existing chat to every linked coach).

## Profile picture upload

Wired 2026-06-02. End-to-end flow:
- **Backend**: `POST /api/users/{id}/upload` accepts `IFormFile` via multipart. Saves to `wwwroot/images/{id}_{guid}.{ext}` (GUID names so URLs aren't enumerable) using `IWebHostEnvironment.WebRootPath` (relative `wwwroot` path doesn't work on Azure — see lesson 2026-06-02), gated by `BL/UploadValidator.cs` (6 MB cap + magic-byte sniff; the client filename/extension is ignored). Updates `Users.ProfileImagePath` via existing `sp_UpdateUserProfileImage`. Returns `{ path: "/images/..." }`. Served by `app.UseStaticFiles()` in Program.cs.
- **Frontend**: [services/api.js](TrainWiseExpo/src/services/api.js) exports `uploadProfileImage(userId, localUri)` (raw fetch + FormData, no explicit Content-Type so RN sets the boundary correctly, 60s AbortController timeout) and `resolveProfileImageUrl(path)` (strips `/api` from BASE_URL to hit static-files host root). [AuthContext.login](TrainWiseExpo/src/api/AuthContext.js) carries `profileImagePath`. [ProfileScreen](TrainWiseExpo/src/screens/ProfileScreen.js) has a tappable avatar with ImagePicker + camera badge. [HomeScreen](TrainWiseExpo/src/screens/HomeScreen.js) renders the same URL in the greeting avatar.

**Known limitation**: Azure App Service may wipe `wwwroot/images` on app restart (the deployment overlay replaces it). For production-grade persistence, move to Azure Blob Storage or mount a persisted disk at `D:\home\data\images`.

## Push notifications

Redesigned 2026-06-02. [NotificationService.js](TrainWiseExpo/src/api/NotificationService.js):
- **`scheduleDailyReminder(acRatio, loadLevel)`** — fires every day at 18:00. Body is load-aware (suppressed entirely when level=Red or acRatio>1.5; "keep it moderate" for Yellow; "you're fresh, push hard" for Green). Duolingo-style escalation across 4 tiers based on `daysSinceLastOpened`: friendly nudge → mild guilt → "gains getting cold 🥶" → "TrainWise misses you 😢". Re-scheduled on every app launch (App.js) AND on every HomeScreen load (so the next push reflects the freshest weekly load).
- **`markAppOpened()`** — called from App.js on launch, persists `@trainwise_last_opened` ISO timestamp. Used by `daysSinceLastOpened()` to pick the escalation tier.
- **`sendLoadWarningIfNeeded(acRatio, level)`** — fires on workout confirm. Was previously a TEMP DEBUG OVERRIDE that always fired with body `acRatio=X, level=Red`; this was removed 2026-06-02. Now only fires for genuine Yellow/Red zones.

Daily reminder content can't be mutated after scheduling, so the re-schedule-on-app-open pattern is intentional. iOS limits per-app scheduled count; the implementation cancels all before scheduling to stay safe.

**FCM (push when the app is closed)**: the client registers its token via `PUT /api/users/{id}/pushtoken` (2026-06-21 migration adds the column); the backend sends through [BL/PushSender.cs](TrainWise/TrainWise/BL/PushSender.cs) (FirebaseAdmin, service-account JSON from the `FIREBASE_CREDENTIALS_JSON` env var — `google-services.json` on the client side is gitignored under `android/`).

## Expo SDK 54 picker / camera gotchas

- `expo-image-picker` SDK 54 **removed `MediaTypeOptions`**. Only the array form works: `mediaTypes: ['images']`. Grep the project before adding new pickers.
- `expo-camera` 17 exposes `scanFromURLAsync` as a **module-level export**, not a static on `CameraView`. Import it: `import { CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera'`.

## Coach analytics + ML forecast service (Python)

Added 2026-06-12. A **separate Python (Flask) microservice** at [ml/](ml/) powers the coach
analytics screen. It is the project's ML/Data-Science deliverable (built with the same
libraries as `Python Course ML/`: pandas, scikit-learn, matplotlib/seaborn) and implements
the spec in `Python Course ML/TrainWise_Smart_Injury_Prevention.pdf` (Task 1 Regression =
forecast, Task 2 Classification = risk). **The C# backend is untouched** — the RN coach
screen calls the Python service directly over the LAN.

- **Service** ([ml/app.py](ml/app.py)) binds `0.0.0.0:8000`, reads the same SQL Express DB
  (`Lirone\SQLEXPRESS` / `TrainWise`) via `pyodbc` with Windows Integrated Security (no
  password in source), and mirrors the C# load formula exactly ([ml/features.py](ml/features.py):
  acute = 7-day load sum, chronic per the 2026-07-06 rules — dynamic cold-start floor +
  covered-days ramp, confirmed-only, AC thresholds 0.8 / 1.3 with injured tightening —
  recomputed from `ActivityLogs`, NOT the stored `DailyLoad` rows, so charts never go stale).
  Endpoints: `GET /health`, `/api/ml/trainee/<id>/pmc`, `/acwr`, `/forecast[?month=YYYY-MM]`,
  `/forecast/history`, and **`/whatif?addSessions=&intensity=easy|medium|hard`** (#185 what-if
  simulator — recomputes the ACWR with N hypothetical sessions added this week via the same
  `rolling_loads`, returning `{baseline, simulated}`) — all accept `?tzOffsetMinutes=` (sent by
  mlApi.js) for local-day bucketing.
- **Forecast** ([ml/forecast.py](ml/forecast.py)): per-trainee regression on the current
  month's completed weekly loads (naive carry for week 1, `LinearRegression` at 2 weeks,
  `PolynomialFeatures(2)` upgrade at 3+ if it clearly fits better), projecting remaining weeks
  → projected acute load + AC ratio + Safe/Warning/High risk. **Refines weekly, resets each
  month** (keyed by `MonthKey`), and **every current-month call appends a snapshot to
  `MonthlyForecasts`** so past months stay viewable read-only. A **global model** trained in
  the notebook (`ml/models/forecast_model.pkl`) is loaded when present and returned alongside;
  the service works without it.
- **Risk** ([ml/risk.py](ml/risk.py)): loads `ml/models/risk_model.pkl` (classification), with
  a rule-based fallback (AC>1.3 High, ≥0.8 Warning, else Safe) when the pickle is absent.
- **Notebook** ([ml/notebook/TrainWise_Coach_Analytics.ipynb](ml/notebook/TrainWise_Coach_Analytics.ipynb)):
  the gradeable writeup (cleaning per PDF slide 7, regression MAE/MSE/RMSE, classification
  Accuracy/Precision/Recall/F1 + ROC/AUC, KMeans clustering, matplotlib/seaborn PMC + ACWR).
  Real data is thin, so it includes a documented **synthetic generator** to train the global
  models; its final cells export the two pickles into `ml/models/`. The **live per-trainee
  forecast does not depend on the synthetic data.**
- **DB**: `MonthlyForecasts` table created by [sql/2026-06-12_add_forecasts.sql](sql/2026-06-12_add_forecasts.sql)
  (idempotent; the Python service writes rows directly — no stored procs).
- **Frontend**: [src/services/mlApi.js](TrainWiseExpo/src/services/mlApi.js) (axios client,
  `ML_BASE_URL = http://<PC-IP>:8000` — **must track the PC IP exactly like `LOCAL_PC_IP` in src/config/backend.js** (hardcoded separately, not imported from there);
  offline errors degrade gracefully, no red crash). [CoachTraineeAnalyticsScreen.js](TrainWiseExpo/src/screens/CoachTraineeAnalyticsScreen.js)
  renders the **PMC** (Fitness/Fatigue/Form) and **ACWR safe-zone** charts (custom
  `react-native-svg` line charts — chart-kit can't shade the 0.8-1.3 band) plus the forecast
  card (headline, risk pill, per-week projection, month dropdown for history). Reached via a
  button on [CoachTraineeDetailScreen.js](TrainWiseExpo/src/screens/CoachTraineeDetailScreen.js);
  registered in HomeStack as `CoachTraineeAnalytics`. **JS-only RN change** — Metro reload in
  dev; APK rebuild to ship.
- **Run (Local LAN)**: `cd ml && python -m venv venv && venv\Scripts\activate && pip install
  -r requirements.txt && python app.py`. One-time firewall (admin PowerShell): `New-NetFirewallRule
  -DisplayName "TrainWise ML 8000" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action
  Allow -Profile Private`. Needs **ODBC Driver 17/18 for SQL Server** (ships with SSMS). The PC
  must run both the C# API (5249) AND this service (8000) for the coach analytics screen to work.
  See [ml/README.md](ml/README.md).

## Live GPS background tracking (#121, 2026-07-21)

`LiveRunScreen` records outdoor routes in the **background** (screen off / app backgrounded, Samsung-Health
style) via a foreground-service location task in [src/utils/liveTracking.js](TrainWiseExpo/src/utils/liveTracking.js)
(`expo-task-manager` + `Location.startLocationUpdatesAsync` with a `foregroundService`). The task appends
locations to an AsyncStorage buffer; the screen polls it to draw the live route and reconstructs distance
honouring pause windows. On save it writes an ActivityLog (`sourceDevice='GPS'`) + the polyline (keyed by
log id) so `WorkoutRouteScreen` redraws it.
- **New dependency**: `expo-task-manager` (~14, autolinks via gradle — no prebuild needed).
- **New manifest permissions** (added MANUALLY to [AndroidManifest.xml](TrainWiseExpo/android/app/src/main/AndroidManifest.xml),
  alongside the existing FINE/COARSE): `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`,
  `FOREGROUND_SERVICE_LOCATION`. The `LocationTaskService` (foregroundServiceType=location) merges from
  expo-location's own library manifest — do NOT declare it again.
- **Build**: `gradlew assembleRelease` autolinks `expo-task-manager` and keeps the manual manifest (HC aliases
  + these perms) intact. Do NOT `expo prebuild` (would regenerate the manifest and could wipe the HC aliases).
- On device: the user must grant **"Allow all the time"** location for screen-off tracking; "while using the
  app" still records while the screen is on. The GPS activity set (Run/Walk/Cycle/Trail/Hike/Nordic/Brisk/Interval)
  is `GPS_TRACKABLE_IDS` in LiveRunScreen, reused to gate AddWorkout's live-tab "Track route with GPS" button.

## Building & distributing the APK

- Build the file: `cd TrainWiseExpo/android && ./gradlew assembleRelease` (or
  `npx expo run:android --variant release`, which ALSO re-runs prebuild + installs).
  Output is ALWAYS `TrainWiseExpo/android/app/build/outputs/apk/release/app-release.apk`
  (never a manually-copied location like the Desktop).
- `gradlew assembleRelease` can print BUILD SUCCESSFUL but **skip repackaging** when it
  thinks the JS bundle is up-to-date — verify the APK's timestamp/size CHANGED. Force a
  fresh APK with `./gradlew clean assembleRelease`. Plain gradlew does NOT re-prebuild,
  so a rotated native Maps key only reaches the manifest via `expo run:android`/prebuild.
- **Local-LAN distribution:** the APK has the PC's IP (`LOCAL_PC_IP` in src/config/backend.js) baked in, so a
  sent APK only works on devices on the SAME WiFi, with the backend + SQL running. The
  Azure "Error 403 - web app is stopped" page means the APK still points at the dead
  Azure URL (an old build). Remote testers need a public backend (Azure or a tunnel).

## Known pending items

- HC `ActiveCaloriesBurned` permission is now requested at the SDK level + manifest + `app.json`. After installing the new APK the user must grant it once in Health Connect — until then calories silently fall back to the BMR-corrected `TotalCaloriesBurned` estimate.
- App logo: `app.json` still references `assets/images/wowowow.png` for the launcher icon, adaptive icon foreground, AND the notification icon. Notification icons on Android MUST be transparent silhouettes — if the colored logo renders as a white blob in the status bar, point the expo-notifications `icon` at a silhouette PNG. (Refinements R2 shipped a silhouette, but `app.json` line ~52 still points at the colored logo — verify on device.)
- `mlApi.js` still hardcodes its own `ML_BASE_URL` instead of importing `LOCAL_ML_URL` from `src/config/backend.js` — wiring it up would make the PC-IP update a single-file change.
- The Python ML service is local-only (see the note at the top): the CODE is now Azure-ready (`ml/db.py` dual-mode pyodbc/pymssql, `requirements.txt` Linux markers, [ml/AZURE_DEPLOY.md](ml/AZURE_DEPLOY.md) checklist) but the actual App Service deploy is still pending. **Trainee Load Trend + #174 "My analytics" also depend on this service** (Python-primary), not just the coach forecast.

Resolved former items (kept so old session logs make sense): the gender PNGs `000-003.png` now exist under `assets/images/`; **#12 route maps shipped 2026-06-03** (`WorkoutRouteScreen` + expo-maps); the coach-row 404 is fixed by the CoachBL lazy-create (see "Coach row lazy-create" in CLAUDE2.md).

## Self-learning

- **At the start of every session**, read [tasks/lessons.md](tasks/lessons.md) before doing anything else.
- **Before modifying any code**, apply every rule in `tasks/lessons.md` that could be relevant to the change.
- **Immediately after the user corrects you** (anything the user calls out as wrong, misguided, or redundant), append one line to `tasks/lessons.md` in this format:
  `[YYYY-MM-DD] | what went wrong | rule to follow next time`
  One entry per correction. Keep each line terse. Do not batch, do not wait for the end of the session.

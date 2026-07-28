# TrainWise — Full Project Analysis & Summary

> A single consolidated "resume" of the entire TrainWise project, built by analysing the codebase
> layer by layer (backend, frontend, ML service, database, docs, the ML course, and the development
> history in `tasks/` + `CLAUDE.md` + the memory files). Written 2026-07-26.
>
> Punctuation note: this document avoids the "long dash" character on purpose (owner preference).

---

## 0. One-paragraph elevator pitch

**TrainWise is a smart fitness / injury-prevention platform for runners, gym-goers and their coaches.**
Its reason to exist is a single sports-science idea: the **Acute:Chronic Workload Ratio (ACWR)** — the
relationship between how hard you trained in the **last 7 days** (acute) versus your **28-day** baseline
(chronic). Spiking that ratio is one of the best-known predictors of soft-tissue injury. TrainWise
tracks every workout (typed in by hand or synced automatically from Google **Health Connect**), computes
the ACWR with a colour-coded Green / Yellow / Red warning, and layers a **Python machine-learning service**
on top that **forecasts** where a trainee's load is heading and **classifies** their overload risk. Around
that core sits a full consumer app: coach ↔ trainee linking and chat, a social layer (friends, gyms, live
presence), gamification (badges, coins, streaks, shop, leaderboards), an AI assistant, nutrition, GPS run
tracking, training programs, calendar, and more.

It is a **complete, three-tier, production-shaped system**: an ASP.NET Core 8 REST API, a React Native
(Expo) Android app, a Flask ML microservice, and a SQL Server database, deployable either fully on **Azure**
or on a **local LAN**.

---

## 1. Repository layout (what lives where)

The real project root is `c:\Dev\TrainWise\`. Four cooperating sub-projects, no shared package manager:

| Path | What it is | Stack |
|---|---|---|
| `TrainWise/TrainWise/` | **Backend** REST API (`TrainWise.sln`, opens in VS 2022) | ASP.NET Core 8, raw ADO.NET, SQL Server |
| `TrainWise/TrainWise.Tests/` | xUnit tests pinning the load-window math | xUnit / .NET | 
| `TrainWiseExpo/` | **Frontend** mobile app (installed as an APK on a Galaxy S25+) | Expo SDK 54 / React Native 0.81 (New Architecture), JavaScript |
| `ml/` | **ML microservice** + the gradeable data-science notebooks | Python 3.10+, Flask, pandas, scikit-learn |
| `ml_deploy_clean/` | Clean copy of `ml/` used for the Azure App Service deploy | Python + gunicorn + pymssql |
| `sql/` | 32 schema + migration + seed scripts | T-SQL |
| `tasks/` | Session resumes, deploy checklists, the lessons log, the feature backlog | Markdown |
| `Python Course ML/` | The 7-lesson ML course this project's ML deliverable is built for | Jupyter notebooks + theory PDFs |
| `CLAUDE.md` | The 592-line master engineering doc (architecture, gotchas, deploy) | Markdown |
| `TrainWise_Project_Documentation.pdf` | A generated project doc | PDF |

**Approximate size:** ~145 C# files (39 BL, 29 controllers, 29 DAL, 47 models), ~163 frontend source
files (60 screens, 55 components, 55 utils/services/contexts), ~10 Python ML modules, 32 SQL scripts.

---

## 2. Backend — ASP.NET Core 8 Web API

### 2.1 Architecture: strict three-layer

Everything flows `Controllers → BL → DAL → DBservice`:

- **`Controllers/`** (29) — thin REST surfaces (`[Route("api/[controller]")]`, `[FromBody]` for
  POST/PUT). `BaseApiController` centralises the JWT-based ownership gates.
- **`BL/`** (39) — business logic. The heart is `LoadCalculationBL.cs` (the ACWR algorithm) and
  `LoadAnalyticsBL.cs` (the rolling + EWMA trend series).
- **`DAL/`** (29) — hand-written ADO.NET. `DBservice.cs` is the shared connection helper. **No EF Core,
  no migrations folder** — schema is managed by hand in SSMS via the scripts in `sql/`.
- **`Models/`** (47) — plain POCOs shared between layers (no separate DTO layer, though a handful of
  `Create*Request` / `Update*Request` request objects exist).

### 2.2 The core algorithm (`LoadCalculationBL.cs`) — "the app's reason to exist"

For a given user + day it:
1. Pulls the last 28 days of confirmed sessions.
2. **Buckets them per calendar day in the caller's timezone** (`BucketByLocalDay`; a 00:30 Israel
   workout must not land on the previous UTC day; unconfirmed Health Connect imports are skipped).
3. `AcuteLoad` = sum of session loads over the last **7** days. **Session load = duration (min) ×
   exertion (RPE 1-10)** — the old `intensityFactor` was fully removed.
4. `ChronicLoad` = `EffectiveChronic(...)`, a 28-day weekly-equivalent average with two important
   correctness rules:
   - **Dynamic cold-start floor:** when the 28-day window has **< 7 active days**, floor chronic at an
     experience-based bootstrap (Beginner 150 / Regular 280 / Advance 420 weekly). This stops a
     brand-new user's first workout reading a false Red (chronic would otherwise = acute/4 → ratio 4.0),
     and — because it is dynamic, not the one-shot `IsBaselineEstablished` flag — a returning-from-layoff
     athlete no longer stores a false Red either.
   - **Covered-days ramp:** once ≥ 7 active days, `chronic = sum28 / min(4, covered/7)`, so a steady
     2-week-old user reads ~1.0 instead of a false 2.0; a full 28-day history is unchanged (`/4`).
5. `AC_Ratio = acute / chronic`.
6. `LoadLevel` via `DetermineLoadLevel`: **Green < 0.8, Yellow 0.8–1.3, Red > 1.3**; an **active injury
   tightens** the bands to **Red ≥ 1.2** (no gap: Yellow 0.8 ≤ r < 1.2). Levels grade from the
   **unrounded** ratio.
7. A `StressScore` (0-100) and the result is saved to `DailyLoad` via `sp_SaveDailyLoad`.

These window functions (`BucketByLocalDay`, `SumRange`, `CountActiveDays`, `EffectiveChronic`,
`DetermineLoadLevel`) are `internal static` **single sources of truth**, reused by `LoadAnalyticsBL`,
**mirrored byte-for-byte by the Python service (`ml/features.py`) and the JS mirrors
(`utils/acwr.js`, `utils/loadSeries.js`)**, and pinned by the `TrainWise.Tests` xUnit project
(hand-computed vectors V1-V6). Keeping four implementations of one formula in lockstep is one of the
project's defining engineering challenges.

### 2.3 Security (the 2026-07-02 hardening pass, `Program.cs`)

The API went from "no auth, trusts a client-supplied userId" to a real identity layer:

- **JWT bearer auth** (`JwtService`, HS256) minted on login / signup / google-login, carrying `uid`,
  `isCoach`/`isTrainee`, and a `sid` session id.
- **Staged enforcement:** `AUTH_ENFORCE` env flag. When off, tokenless (old APK) callers still work;
  when on, every non-`[AllowAnonymous]` endpoint requires a valid token. Gates in `BaseApiController`
  (`CallerMayAct`, `CallerOwnsOrCoaches`, …) **deny a token belonging to a different user** even while
  enforcement is off — closing IDOR/BOLA without breaking old builds.
- **Session revocation:** `OnTokenValidated` checks the `sid` against `SessionBL.IsSessionActive`, so
  "log out this device" is real, not cosmetic.
- **PBKDF2 password hashing** (`PasswordHasher`, SHA-256 / 100k / salted, verify-and-upgrade from legacy
  plaintext), **rate limiting** (10/min/IP on auth, 300/min/IP global), **generic 500 error body**
  (never leak `ex.Message` / SQL / paths), **upload validation** (`UploadValidator`: 6 MB cap +
  magic-byte sniff, server-derived extension), **server-side Google ID-token + reCAPTCHA verification**.
- **DB secret externalised:** `DBservice.Connect()` reads via `IConfigurationRoot` + `AddEnvironmentVariables()`
  so Azure's Connection-strings blade wins over the local `appsettings.json`.

### 2.4 Notable subsystems in `BL/`

`CoachBL` (lazy-creates the `Coaches` row on first read), `SocialBL`/`GymBL` (friends, gyms, presence,
coach offers), `MessageBL` (chat + typing + reactions), `ProgramBL` (assigned training programs),
`CalendarBL` (planned workouts, one-per-day), `NutritionBL`, `RecordsBL` (personal bests), `BoardBL`
(workout board + leaderboard), `CommunityBL` (challenges, feed, events), `PushSender` (FCM via
FirebaseAdmin), `PlacesService` (Google Places gym proxy), `EmailSender` (SMTP reset/verify codes).

---

## 3. Frontend — Expo / React Native (Android)

### 3.1 Shape

- **JavaScript only** (no TypeScript despite the `tsconfig.json`), React Native **0.81 New Architecture**
  (required — reanimated + worklets refuse to build otherwise), Expo **SDK 54**.
- Installed as a **release APK** on a Samsung Galaxy S25+ (Android 16); the iOS folder is not maintained.
- Two axios clients both import one `API_BASE_URL` from `src/config/backend.js` (the single
  `BACKEND_MODE = 'local' | 'azure'` switch), plus `src/services/mlApi.js` (its own `ML_MODE` switch to
  the Python service).

### 3.2 Module map (`src/`)

- `config/backend.js` — the one place the backend URL / mode lives.
- `api/` + `services/` — auth context + JWT token store, the axios clients, Health Connect service +
  sync orchestration, messages/social contexts, weather + OpenAI + Google-auth helpers.
- `navigation/NavigationStack.js` — a single root, **4 tabs: Home / Load / Health / Connect**
  (coach-only users see just Home + Connect). Wrapped by presence + unread-badge providers.
- `screens/` (~60) — one file per screen.
- `components/` (~55) — reusable UI (Card, PrimaryButton, ComboBox, charts, gauges, overlays).
- `utils/` (~55) — pure logic (ACWR mirror, badges, quests, calories, recovery, injury risk, etc.).
- `theme/` — a **mutable `Colors` singleton** swapped by `applyTheme()`; every screen must read it via
  the `useThemedStyles(makeStyles)` hook (a `StyleSheet.create()` at module scope freezes colours and
  never theme-switches — a trap that cost real debugging time).
- `i18n/` — EN / HE / FR translations foundation.

### 3.3 Signature frontend features

- **Health Connect sync** (read-only Google Health Connect → backend ActivityLogs) with a persistent
  tombstone set so deleted workouts don't re-import. Getting this to work on **Android 14+/16** was a
  months-long battle (see §7).
- **Load analytics** (`LoadAnalyticsSection` + custom `react-native-svg` `AcwrTrendChart`): Classic
  rolling ACWR + Smooth bias-corrected EWMA, with a sweet-spot band the off-the-shelf chart-kit cannot
  shade. Python-primary, C# fallback, on-device JS mirror as a last resort.
- **Smart workout card** — weather + air-quality scored conditions (Great/Good/Fair/Poor) that override
  to "recovery" when ACWR > 1.3.
- **Live GPS run** (`LiveRunScreen`) with **background** foreground-service tracking (Samsung-Health
  style), live polyline on `expo-maps`, pause-aware distance.
- **AI assistant** (OpenAI), **injury scanner + AI advice**, **coach/trainee + friend chat**, **workout
  board / leaderboard / feed / challenges / events**, **shop / badges / streaks / quests / confetti**,
  **nutrition + barcode + calorie ring**, **training calendar + assigned programs**, **QR connect**,
  **biometric lock**, **What's-New changelog**, **push notifications** (local + FCM closed-app).

---

## 4. The ML service — the "smart element" (the graded deliverable)

A standalone **Python + Flask** microservice (`ml/app.py`, port 8000) the app calls directly. It reads
the same SQL database and **mirrors the C# load formula exactly**, so its numbers line up with the app.
It is the project's Machine-Learning / Data-Science deliverable and implements the spec in
`Python Course ML/TrainWise_Smart_Injury_Prevention_Updated.pdf`.

### 4.1 Endpoints

`GET /health`, `/pmc`, `/acwr`, `/analytics`, `/forecast[?month=YYYY-MM]`, `/forecast/history`,
`/whatif?addSessions=&intensity=easy|medium|hard` — all accept `?tzOffsetMinutes=` for local-day
bucketing, clamp their inputs (a huge `?days=` or slider drag can't DoS the service), return a generic
error body, and can optionally require the same signed token the C# API issues.

### 4.2 Task 1 — Regression (the monthly forecast, `forecast.py`)

Answers *"if this trainee keeps training like this, what acute load + AC ratio will they hit by month
end?"* The month is split into fixed weeks (1-7, 8-14, …); a model is fit on the **completed** weeks and
scales with data:

- **< 2 weeks:** carry the current 7-day "recent pace" forward.
- **2 weeks:** `LinearRegression`.
- **4+ weeks:** upgrade to `PolynomialFeatures(2)` **only if it clearly fits better** (R² + 0.05 guard —
  a parabola through 3 points fits exactly, so the guard needs n ≥ 4).

The critical correctness point: **chronic is recomputed day-by-day in a forward simulation** as the
athlete "keeps training like this," so a rising acute is divided by a rising chronic and the AC ratio
converges sensibly (the earlier bug divided by a frozen chronic and produced impossible ratios like 4.0).
Confidence is the model R². Every current-month call **appends a snapshot** to `MonthlyForecasts`, so a
month refines weekly, resets cleanly next month, and past months stay reviewable. A **global** model
(`forecast_model.pkl`, trained on documented synthetic data in the notebook) runs alongside as a clearly
labelled secondary comparison.

### 4.3 Task 2 — Classification (overload-risk badge, `risk.py`)

Labels each state **Safe / Warning / High**. Loads `risk_model.pkl` (a **RandomForest**, chosen in the
notebook over LogisticRegression) when present, otherwise falls back to the same threshold rule so the
badge always renders. Features: AC ratio, acute, chronic, experience, age, active-injury count.

### 4.4 The two coach charts

- **PMC (Performance Management Chart):** Fitness (chronic) / Fatigue (acute) / **Form** (fitness −
  fatigue). Form dives negative = overreaching.
- **ACWR chart:** the AC ratio over time with the 0.8-1.3 safe band shaded and a 1.5 danger line, each
  point coloured by status.

### 4.5 What-if simulator (#185, the newest ML feature)

`simulate_whatif` injects N hypothetical sessions (easy/medium/hard = 150/300/450 load) onto today and
recomputes the ACWR with the **same** `rolling_loads` used everywhere else, returning `{baseline,
simulated}`. Because acute (7-day sum) jumps while chronic (28-day) barely moves, the risk pill flips
green → amber → red **before** the sessions are trained. Verified against the live DB: `+3 hard`
takes `1.06 Warning → 1.93 High`. A companion notebook (`TrainWise_WhatIf_Planner.ipynb`) adds a
response curve, a linear surrogate (regression MAE/R²), and a "safe headroom" sweep.

### 4.6 The gradeable notebooks (course-style)

`TrainWise_Coach_Analytics.ipynb` (+ `_Load_Analytics` + `_WhatIf_Planner`) follow the course flow end
to end: load + clean, feature engineering, **regression** (linear + polynomial, MAE/MSE/RMSE/R² +
residual plots), **classification** (logistic vs random forest, Accuracy/Precision/Recall/F1 + confusion
matrix + **multiclass ROC/AUC**), **KMeans clustering** (trainee segmentation), seaborn EDA
(correlation heatmap with an upper-triangle mask, model-comparison bars), and `joblib` model export.
**Real** data drives the EDA/charts (synthetic fallback under 8 rows / 2 users); **synthetic** data
trains the global models, and that split is documented for the grader.

### 4.7 The sports science it rests on

ACWR (Gabbett 2016), bias-corrected EWMA (Williams 2017 + the Adam zero-init correction, Kingma & Ba
2015), the PMC / Fitness-Fatigue model, and Foster's monotony & strain (1998). These are real, cited,
published methods — not invented heuristics.

---

## 5. Database (SQL Server)

Raw ADO.NET against SQL Server (Azure SQL in cloud mode, SQL Express `Lirone\SQLEXPRESS` / `TrainWise`
locally). Schema + stored procs live in `sql/TWDB.sql`; **32 dated migration scripts** layer on
messages, social, forecasts, injury links, calendar, cosmetics, live location, records, workout board,
push tokens, security hardening, wearables/nutrition, event chat, sessions, and programs. Reference/seed
data (`seed_reference_data.sql`) provides the 20 ActivityTypes (with intensity factors), 20 InjuryTypes
+ categories, 20 TrainingGoals, and the single `LoadParameters` tuning row — **required on any fresh DB**
or the dropdowns and load algorithm break. Every migration must be run on **both** the local and Azure
databases (there is no EF migration runner).

---

## 6. The ML course context (`Python Course ML/`)

The project's ML deliverable is the applied capstone of a 7-lesson data-science course, and it uses
exactly the techniques taught:

| Lesson | Topic | Where it shows up in TrainWise |
|---|---|---|
| 1 | Python basics | the whole service |
| 2 | Pandas | all feature engineering (`features.py`) |
| 3 | Visualisation (Matplotlib, Seaborn) | the notebook EDA + coach charts |
| 4 | **Linear Regression** | **Task 1** monthly forecast |
| 5 | Logistic Regression & Decision Tree | **Task 2** risk classifier candidates |
| 6 | Classification Evaluation | Accuracy/F1/ROC-AUC on the risk model |
| 7 | **Clustering (KMeans)** | trainee segmentation |

Plus theory PDFs (Intro to ML, Intro to Data Science, Linear Regression, Classification, Classification
Evaluation). The `TrainWise_Smart_Injury_Prevention*.pdf` files are the formal project brief the ML work
delivers against.

---

## 7. Engineering challenges (the honest "hard parts")

From the ~90-entry `tasks/lessons.md` self-learning log — these are the real battles, and the best
material for the "smart element / challenge" slide:

1. **The Health Connect "Android 16 wall"** (open for weeks). On Android 14+, Health Connect is part of
   the OS and lists only apps that resolve a `VIEW_PERMISSION_USAGE` + `HEALTH_PERMISSIONS`
   `activity-alias`. That alias kept getting wiped by EAS/prebuild, so the app was **invisible** to HC
   and `requestPermission` returned `[]` with no UI. Root-caused with `adb shell cmd package
   query-activities` and fixed by pinning the manifest. Corollary lesson: **never use EAS Build /
   `expo prebuild`** on this project (they regenerate `android/` and wipe the manual native edits).
2. **One formula, four implementations.** Keeping the ACWR math identical across C#, Python, and two JS
   mirrors — including the cold-start floor, covered-days ramp, injury-tightened bands, and grading from
   the unrounded ratio — with an xUnit test as the referee.
3. **Timezone drift.** SQL `datetime` is serialised without a `Z`; `new Date(str)` parses it as
   device-local (+3h in Israel). Fixed with a `parseServerDate()` helper and `tzOffsetMinutes` on every
   load call so sessions bucket to the user's local day.
4. **The theme trap.** A "swap the Colors singleton" theme fails silently because `StyleSheet.create()`
   freezes colours at import; solved with the `useThemedStyles` hook.
5. **Secrets discipline.** A Google API key leaked via a push (now rotated); the project enforces a
   pre-commit secret scan, `.env` + `app.config.js` injection, and a safe-push checklist (the tracked
   `appsettings.json` carries the Azure password locally but must never be committed).
6. **ML correctness.** Multiclass ROC-AUC read 0.23 (worse than random) until the `predict_proba`
   columns were reordered to the class list; the forecast's frozen-chronic bug; the EWMA zero-init bias.
7. **RN native gotchas.** Multipart uploads (raw `fetch`, no explicit Content-Type), SDK-54 picker/camera
   API changes, keyboard `behavior` under `adjustResize`, nested horizontal pagers stealing gestures,
   `makeStyles` palette-param name mismatches crashing a screen on mount, JS-heap OOM in the release build.

---

## 8. Feature inventory (grouped)

**~109 shipped features.** Highlights by area:

- **Load & injury core:** ACWR dashboard (Home + Load tab), Warnings dashboard, load-trend analytics
  (rolling + EWMA), injury reporting + active-injury tracking + mark-recovered, body-map picker, pain
  logging, rehab suggestions, injury-risk gauge, re-injury flag.
- **Workouts & wearables:** manual add-workout, Health Connect sync, workout templates, interval timer,
  live GPS run, HR zones, CSV/PDF export, per-workout notes/photos, exercise library, personal bests,
  deep-link share.
- **Coach ↔ trainee:** QR/coach-offer linking, per-trainee dashboard + drill-down, **ML analytics
  (PMC/ACWR/forecast/what-if)**, assigned programs, coach comments, video form-check, progress reports,
  coach marketplace + reviews.
- **Social:** friends, gyms map (real Netanya gyms from Google Places), live presence heartbeat,
  workout board + comments + kudos, activity feed, friend challenges, group events, leaderboards +
  seasonal divisions.
- **Chat:** user↔user chat (text + image + voice), typing indicators, reactions, unread badges, event
  and program group chat, FCM closed-app push.
- **Gamification:** badges/achievements (tiered) + unlock animation, coins + shop, streaks + freeze,
  daily/weekly quests, milestone confetti, shareable achievement cards.
- **Smart / AI:** weather+air-quality smart card, best-time-to-train, AI week-in-review, AI plan
  generator, AI "ask my data", injury-photo advice.
- **Nutrition & health:** meal + hydration logging, barcode scanner (Open Food Facts), calorie-balance
  ring, weight/body-composition, sleep/HRV readiness.
- **Platform / UX:** dark+light themes + accent picker + scheduled theme, i18n (EN/HE/FR) + RTL
  foundation, biometric login, forgot/reset password + email verification, multi-device sessions,
  notification preferences + quiet hours, What's-New changelog, accessibility pass.

A detailed forward backlog (IDs 110-185, effort-graded 🟢/🟡/🔴) lives in `tasks/feature_backlog.md`.

---

## 9. Tech stack (one glance)

- **Backend:** ASP.NET Core 8, C#, raw ADO.NET, JWT bearer, ASP.NET rate limiting, Swagger, FirebaseAdmin.
- **Frontend:** Expo SDK 54, React Native 0.81 (New Arch), React Navigation, react-native-svg,
  react-native-reanimated/worklets, react-native-health-connect, expo-maps/location/task-manager,
  expo-camera/notifications/local-authentication, axios, AsyncStorage.
- **ML:** Python 3.10+, Flask, pandas, numpy, scikit-learn (LinearRegression, PolynomialFeatures,
  RandomForest, KMeans), matplotlib/seaborn, joblib, pyodbc (local) / pymssql + gunicorn (Azure).
- **Database:** SQL Server (Azure SQL + SQL Express), stored procedures + parameterised SQL.
- **External services:** Google Health Connect, Google Maps/Weather/Air-Quality/Places, Google Sign-In +
  reCAPTCHA, OpenAI, Firebase Cloud Messaging, Open Food Facts, Azure App Service + Azure SQL.

---

## 10. Deployment model

Two interchangeable modes, flipped with one-line config switches (`BACKEND_MODE`, `ML_MODE`) + an APK
rebuild:

- **Mode A — Azure:** API on Azure App Service, Azure SQL, ML service live at `trainwise-ml…azurewebsites.net`.
  Works from anywhere over the public internet. Cost kept to ~$1-3/month by scaling Azure SQL to
  serverless with auto-pause.
- **Mode B — Local LAN:** API + SQL Express + ML service on the developer's PC, phone reaches them over
  WiFi (or over USB via `adb reverse` on locked-down networks like school WiFi). Zero cloud cost, but the
  PC must be on. Requires the firewall rule, `0.0.0.0` binding, cleartext-HTTP manifest flag, and keeping
  the baked-in LAN IP current.

The C# backend code is **identical** in both modes; only client config changes.

---

## 11. Bottom line

TrainWise is a genuinely ambitious, real, end-to-end product: a sports-science-grounded injury-prevention
engine (ACWR + a real ML forecast/classification pipeline) wrapped in a feature-complete consumer fitness
app with a coaching and social layer, built on a clean three-tier architecture with real security, real
deployment options, real tests, and a disciplined engineering-lessons record. Its distinctiveness is the
**"smart element"**: the same, verified training-load math implemented consistently across four codebases
and extended with machine learning to turn a raw number into a forecast, a risk class, and an interactive
planning tool.

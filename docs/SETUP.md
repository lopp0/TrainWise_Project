# Setup Guide — TrainWise

This guide gets you from zero to a running local copy of TrainWise, **and** points you at the live
Azure backend for quick testing without running the C# API yourself.

TrainWise has two cooperating projects in one repo and an optional ML service:

- **`TrainWise/`** — ASP.NET Core 8 Web API (the backend). Open in Visual Studio 2022.
- **`TrainWiseExpo/`** — React Native / Expo app (the phone client). Android only.
- **`ml/`** — Python (Flask) coach‑analytics microservice. Optional; only the coach forecast needs it.

---

## Backend modes (read this first)

TrainWise runs in **one of two backend modes**. Switching is a config change, not a code change.

| Mode | Backend runs… | Phone reaches it via… | Cost | Trade‑off |
|---|---|---|---|---|
| **Azure** (current) | Azure App Service | the public internet (HTTPS) | cloud | Works anywhere; the ML/forecast screen still needs the local Python service |
| **Local‑LAN** | VS 2022 on your PC | the PC's LAN IP over WiFi (HTTP) | free | PC must be on and on the same WiFi; the IP shifts on DHCP renewal |

The C# code is identical in both modes. Only the two `BASE_URL`s and the DB connection string change.

---

## Option A — Test against the live Azure backend (fastest)

You don't need to run the C# API or SQL at all to poke at the live backend.

### Live URLs

| Surface | URL |
|---|---|
| **Backend API** | `https://trainwise01-api-djcfcvcedth8hjgp.israelcentral-01.azurewebsites.net/api` |
| **Swagger** | `…azurewebsites.net/swagger` *(dev‑only build flag — may be off in prod)* |

> Cold starts on the Free/Basic tier take 10–30s after idle. The **coach Analytics / forecast** screen
> will **not** work against Azure alone — that data comes from the local Python ML service (Option B,
> step 7). Everything else (login, workouts, chat, coach, social) works from anywhere.

To use the live backend from the app, make sure both axios clients point at the Azure URL (they do by
default — see [Configuration](#configuration)), then build/run the Expo app (step 6).

---

## Option B — Run it all locally (for development)

### Prerequisites

| Tool | Minimum | Install |
|---|---|---|
| Node.js | 18+ | https://nodejs.org/ |
| .NET SDK | 8.0 | https://dotnet.microsoft.com/download/dotnet/8.0 |
| Visual Studio 2022 | latest | runs + publishes the backend |
| SQL Server Express | 2019+ | https://www.microsoft.com/sql-server/sql-server-downloads |
| SSMS | latest | runs the schema scripts |
| Android Studio + SDK | 34+ | builds / installs the APK |
| Python | 3.10+ | only for the `ml/` service |
| Git | latest | https://git-scm.com/ |

### Step 1 — Clone

```bash
git clone https://github.com/lopp0/TrainWise_Project.git
cd TrainWise_Project
```

### Step 2 — Create the local database

1. Open **SSMS** and connect to `YOUR_PC\SQLEXPRESS` with **Windows Authentication**.
2. The local database name is **`TrainWise`** (not `TrainWiseDB` — that's the Azure name).
3. Run these scripts from `sql/` **in order** (each migration builds on the last):

   ```
   TWDB.sql                       # schema + stored procedures (no data rows)
   2026-06-02_add_is_trainee.sql
   2026-06-04_add_messages.sql
   2026-06-07_add_message_image.sql
   seed_reference_data.sql        # lookup data — REQUIRED (see note)
   2026-06-08_add_social.sql      # depends on seed_reference_data (ActivityTypes 1–6)
   2026-06-12_add_forecasts.sql
   2026-06-18_add_injury_link.sql
   2026-06-19_add_calendar.sql
   2026-06-19_add_cosmetics.sql
   2026-06-19_add_live_location.sql
   2026-06-19_add_records.sql
   2026-06-19_add_workout_board.sql
   2026-06-21_add_board_image.sql
   2026-06-21_add_push_token.sql
   ```

> **`seed_reference_data.sql` is mandatory.** `TWDB.sql` creates schema + procs only — the lookup
> tables (ActivityTypes, InjuryTypes, TrainingGoals, LoadParameters) start empty, which breaks the
> dropdowns and the load algorithm until seeded. The seed is `IF NOT EXISTS`‑guarded, so it's safe to
> re‑run.

> The dated `.sql` files are hand‑run migrations (no EF migrations). Run any you're missing against
> **both** your local DB and Azure SQL to keep schemas in sync.

### Step 3 — Configure the backend connection string

`TrainWise/TrainWise/appsettings.json` should hold the **local** string (this is the committed default):

```
Data Source=YOUR_PC\SQLEXPRESS;Initial Catalog=TrainWise;Integrated Security=True;Encrypt=False
```

In Azure this JSON value is ignored — the App Service **Connection strings** blade injects the real
one. Don't paste an Azure password into this file (see [SECURITY.md](SECURITY.md)).

### Step 4 — Run the backend

Open `TrainWise/TrainWise.sln` in **Visual Studio 2022** and press the green **play** button.

- API: `https://localhost:5249`
- Swagger: `https://localhost:5249/swagger` (dev only — gated by `IsDevelopment()` in `Program.cs`)

**For Local‑LAN testing on the phone**, the launch profile must bind to `http://0.0.0.0:5249` (not
`localhost`), the Windows Firewall must allow inbound TCP **5249** on the **Private** profile, and the
active WiFi must be classified **Private**. See [Things that trip people up](#things-that-trip-people-up).

### Step 5 — Point the app at your backend

Set the **same** `BASE_URL` in both files (see [Configuration](#configuration)):

- Azure: `https://trainwise01-api-…azurewebsites.net/api`
- Local‑LAN: `http://<your-PC-LAN-IP>:5249/api`  (find it with `ipconfig | findstr IPv4`)

### Step 6 — Run the frontend

```bash
cd TrainWiseExpo
npm install
npx expo run:android        # full native build + install on a connected device
# or, for a JS-only change already installed on the device:
npm start                   # Metro only; press r to reload the JS bundle
```

A **native rebuild** (`expo run:android`) is required when you change anything under `android/`,
`app.json`, or native dependencies. **Never run `npx expo prebuild --clean`** — it wipes the manual
Health Connect edits in `MainActivity.kt` / `AndroidManifest.xml` (see [CLAUDE.md](../CLAUDE.md)).

### Step 7 — (Optional) Run the ML coach‑analytics service

Only needed for the coach **Analytics / forecast** screen.

```powershell
cd ml
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py               # serves on http://0.0.0.0:8000
```

One‑time firewall (Administrator PowerShell), so the phone can reach it over WiFi:

```powershell
New-NetFirewallRule -DisplayName "TrainWise ML 8000" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow -Profile Private
```

Set `ML_BASE_URL` in `TrainWiseExpo/src/services/mlApi.js` to `http://<your-PC-LAN-IP>:8000`. See
[ml/README.md](../ml/README.md).

### Step 8 — Smoke test

1. Register a new account, complete sign‑up.
2. Log a workout (AddWorkout) → Home dashboard shows a load bar + AC ratio.
3. Open Warnings → the weekly chart + status reflect the workout.
4. (Coach) connect to a trainee via QR → open their load drill‑down.

If that works, you're set up.

---

## Configuration

| What | Where | Notes |
|---|---|---|
| Backend API base | `TrainWiseExpo/src/api/api.js` **and** `TrainWiseExpo/src/services/api.js` | Both `BASE_URL`s must be **identical**. A mismatch makes only some screens fail with "Network Error" |
| ML service base | `TrainWiseExpo/src/services/mlApi.js` | `ML_BASE_URL`; track the PC's LAN IP in Local mode |
| DB connection | `TrainWise/TrainWise/appsettings.json` | Local string by default; Azure overrides via the Connection strings blade |
| Frontend secrets | `TrainWiseExpo/.env` (gitignored) | Google + OpenAI keys; `EXPO_PUBLIC_*` are inlined into the bundle |
| Native Maps key | injected by `TrainWiseExpo/app.config.js` from `.env` | `app.json` keeps an empty placeholder — never a literal key |

> Since both `BASE_URL`s already include `/api`, endpoint paths must **not** start with `/api`
> (write `apiClient.post('/Users', …)`, not `/api/Users`).

---

## Project structure cheat sheet

```
sql/             SQL schema + stored procs (TWDB.sql) · dated migrations · seed_reference_data.sql
TrainWise/       ASP.NET Core 8 Web API
  TrainWise/
    Controllers/   22 thin REST controllers (route: api/[controller])
    BL/            business logic — LoadCalculationBL.cs is the core training-load algorithm
    DAL/           pure ADO.NET data access (no EF) · DBservice.cs is the connection helper
    Models/        POCOs / request DTOs (no separate DTO layer)
    Program.cs     minimal hosting; Swagger gated to Development
    appsettings.json
TrainWiseExpo/   React Native + Expo (Android)
  src/
    screens/       one file per screen (30)
    services/api.js  PRIMARY axios client — most backend HTTP goes here
    services/mlApi.js  axios client for the Python ML service
    api/           legacy axios client + Auth/Health/Messages/Social contexts + Health Connect
    components/     reusable UI (Card, ComboBox, PrimaryButton, ScreenHeader, Avatar, …)
    navigation/     single root NavigationStack (tabs: Home / Health / Connect / Profile)
    theme/          useThemedStyles + colors/palettes (light/dark)
    constants/ utils/  weekStart, ACWR helpers, badges, smartWorkout, serverDate, …
ml/              Flask service (app.py) + features/forecast/risk + notebook + models
docs/            this folder
CLAUDE.md        deep architecture notes + conventions
tasks/           session logs + lessons.md (self-learning)
```

---

## Daily workflow

```bash
git checkout Lirone's-Branch && git pull

# Backend: VS 2022 → green play button (port 5249)
# Frontend:
cd TrainWiseExpo && npm start        # JS reload with r
# or npx expo run:android            # when native files / app.json changed
# ML (optional): cd ml && venv\Scripts\activate && python app.py
```

JS‑only change → Metro reload (`r`). Native change (`android/`, `app.json`, native deps) → full
`expo run:android`.

---

## Things that trip people up

### "The phone gets Network Error on every call" (Local‑LAN)
The PC's DHCP IP changed. Run `ipconfig | findstr IPv4`, then update the `BASE_URL` in **both**
`src/api/api.js` and `src/services/api.js` (and `ML_BASE_URL` in `src/services/mlApi.js`). Long‑term
fix: reserve a static IP at the router, or use `http://<hostname>.local:5249/api` (mDNS).

### "Only some screens get Network Error"
Classic `api.js` vs `services/api.js` **IP/host mismatch**. The two axios clients drifted to different
`BASE_URL`s. Make them identical.

### "Local API works on the PC but not from the phone"
Run these in order: `netstat -an | findstr 5249` (must show `0.0.0.0:5249 LISTENING`), then open
`http://<PC-IP>:5249/swagger` in the **PC** browser, then in the **phone** browser. If the PC browser
works but the phone doesn't, the phone is on a different subnet, or the firewall rule is on the wrong
network profile (must be **Private**).

### "Android API calls silently fail in Local‑LAN mode"
Android 9+ blocks plain‑HTTP. The manifest needs `android:usesCleartextTraffic="true"` on
`<application>` (already set). Azure mode uses HTTPS so this doesn't matter there.

### "Health Connect stopped working"
Almost always a wiped native manifest. First run
`adb shell cmd package query-activities -a android.intent.action.VIEW_PERMISSION_USAGE -c android.intent.category.HEALTH_PERMISSIONS`
— if TrainWise is missing, the `ViewPermissionUsageActivity` alias was lost (by a prebuild/EAS).
Restore it per [CLAUDE.md](../CLAUDE.md) → "Native HC requirements". **Never run `expo prebuild --clean`.**

### "The coach analytics screen says offline"
The local Python ML service isn't running, or `ML_BASE_URL` points at the wrong IP. Start `ml/app.py`
and verify `curl http://localhost:8000/health`.

---

## Documentation map

| File | What's in it |
|---|---|
| [README.md](../README.md) | Project overview, tech stack, architecture |
| [docs/SETUP.md](SETUP.md) | This file — local setup + Azure testing |
| [docs/DEPLOY.md](DEPLOY.md) | Azure publish + APK build / distribution |
| [docs/SECURITY.md](SECURITY.md) | Security architecture + safe‑push checklist |
| [docs/featureslist.md](featureslist.md) | Full grouped feature list |
| [docs/features.md](features.md) | Technical feature + API inventory |
| [docs/PROJECT_SCOPE_FLOWCHART.md](PROJECT_SCOPE_FLOWCHART.md) | Scope, user journey, data flow |
| [CLAUDE.md](../CLAUDE.md) | Deep architecture notes, gotchas, conventions |

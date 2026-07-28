# CLAUDE.md  ·  File 1 of 3

<!-- CLAUDE-CHAIN ─────────────────────────────────────────────────────────────
  This file is part of a linked instruction set. Claude MUST read ALL files
  at the start of every session — each contains non-overlapping guidance.

  • CLAUDE.md  (YOU ARE HERE — file 1)
      Documentation sync, repo layout, backend deployment modes, architecture
  • CLAUDE2.md  (file 2) → Load analytics, theme, auth, social, chat, GPS
  • CLAUDE3.md  (file 3) → ML service, APK build, secrets, pending items, self-learning

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

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation sync (MANDATORY, read every session)

The repo has a public‑facing documentation suite (added 2026‑06‑24, lives on the `main` branch). It
MUST stay in lockstep with the code. **Every single time** we add, delete, change, or modify ANYTHING
in this project (a feature, a controller/endpoint, a DB table/migration/seed, a screen, a config value,
a deploy step, a dependency, the architecture), update the relevant file(s) below **as part of the same
change** so the docs never drift from reality. A code change that affects any of these is NOT "done"
until the matching doc is updated.

Files to keep current:
- [README.md](README.md) — overview, feature bullets, architecture diagram, tech stack, project layout, roadmap.
- [docs/SETUP.md](docs/SETUP.md) — local + Azure setup, migration run‑order, prerequisites, gotchas.
- [docs/DEPLOY.md](docs/DEPLOY.md) — Azure publish, APK build, mode switching, resource table.
- [docs/SECURITY.md](docs/SECURITY.md) — auth, secrets, safe‑push checklist, hardening backlog.
- [docs/featureslist.md](docs/featureslist.md) — grouped, presentation‑ready feature inventory.
- [docs/features.md](docs/features.md) — technical inventory + the COMPLETE API surface (controllers/routes).
- [docs/PROJECT_SCOPE_FLOWCHART.md](docs/PROJECT_SCOPE_FLOWCHART.md) — system / user‑journey / data‑flow diagrams.

Trigger map (when X changes, update Y):
- Add/change a **controller or endpoint** → `docs/features.md` (API surface) AND `docs/featureslist.md`.
- Add/alter a **DB table, migration, or seed** → `docs/SETUP.md` (run‑order) AND `docs/features.md` (data layer).
- Add/rename a **screen, service, or component** → `docs/featureslist.md` (and `README.md` if it is a headline feature).
- Ship a **"Planned / Not yet implemented"** item → move it OUT of the Planned bucket in `README.md` + `docs/featureslist.md`.
- Change **run / deploy / config / secret handling** → `docs/SETUP.md` / `docs/DEPLOY.md` / `docs/SECURITY.md`.
- Change the **tech stack, versions, or folder layout** → `README.md` (tech‑stack + project‑layout tables).

Rules:
- Keep the docs accurate to what is REAL — never document a feature that does not exist (honesty over polish).
- The docs are on `main`; when syncing them to GitHub, follow the safe‑push checklist in `docs/SECURITY.md`.

## Repository layout

Two cooperating projects in one folder, no shared root package manager:

- **`TrainWise/`** — ASP.NET Core 8 Web API (the backend). Open `TrainWise.sln` in Visual Studio 2022 and run with the green play button (Swagger opens at `https://localhost:5249/swagger`). Uses raw ADO.NET (no EF Core) against SQL Server Express. The solution also contains **`TrainWise.Tests`** (xUnit, added 2026-07-06) pinning the load-window math — run with `dotnet test` from `TrainWise/`.
- **`TrainWiseExpo/`** — Expo (React Native 0.81 / RN New Architecture) mobile app. Installed as APK on a Samsung Galaxy S25+ for testing — the iOS folder is not maintained. JavaScript only, no TypeScript despite the `tsconfig.json`.

## Backend deployment modes

The project supports **two backend modes**. Switching is a **one-line** config change: set `BACKEND_MODE` (`'local'` | `'azure'`) in [src/config/backend.js](TrainWiseExpo/src/config/backend.js) — the central switch BOTH axios clients import `API_BASE_URL` from, so they can never drift apart (that file also holds `LOCAL_PC_IP`). **Check `backend.js` for the current mode — the project flips between them; as of 2026-07-07 it is `'local'`** (PC IP `192.168.1.118`). The live Azure resource (used when the mode is `'azure'`) is `https://trainwise01-api-djcfcvcedth8hjgp.israelcentral-01.azurewebsites.net` (Cloud project `test01-496711`, re-published 2026-06-16). The older Azure URL (`trainwise-api-fuaahua…`) is dead — kept below for history only. Note: [src/services/mlApi.js](TrainWiseExpo/src/services/mlApi.js) still hardcodes its own `ML_BASE_URL` (it does NOT yet import `backend.js`'s exported `LOCAL_ML_URL`), so the ML IP must be updated separately.

> **The Python ML service is NOT on Azure** — it still runs locally (`ml/app.py`, port 8000; [src/services/mlApi.js](TrainWiseExpo/src/services/mlApi.js) carries the PC's LAN IP). So the C# backend works from anywhere, but the **coach Analytics/forecast screen AND the trainee Load Trend + trainee "My analytics" (#174) surfaces need the local Python service running on the same WiFi** for live numbers (else they show the "analytics offline" / C#-fallback path). **CODE-SIDE Azure deploy is now PREPARED (2026-07-20):** `ml/db.py` is **dual-mode** — it uses pyodbc+Windows-auth locally (unchanged) and switches to **pymssql + Azure SQL (SQL auth)** automatically when `AZURE_SQL_USER`/`AZURE_SQL_PASSWORD` env vars are present; `gunicorn`+`pymssql` are Linux-marked in `requirements.txt` (Azure installs them, local Windows skips them). The actual App Service deploy + portal wiring is NOT done yet — full checklist in [ml/AZURE_DEPLOY.md](ml/AZURE_DEPLOY.md).

### Mode A — Azure App Service (the "works anywhere" setup)

Backend hosted on Azure App Service, Azure SQL at `trainwiseadmin.database.windows.net` / `TrainWiseDB`. Phone reaches the backend over the public internet — no LAN, no firewall, no PC-needs-to-be-on. The **live** resource is `trainwise01-api-djcfcvcedth8hjgp.israelcentral-01.azurewebsites.net` (2026-06-16). The ORIGINAL resource (`trainwise-api-fuaahua…`) died with the first subscription: **on 2026-06-06 that Azure-for-Students subscription was DISABLED** ($100 credit exhausted at $59.84 actual + $206.97 forecast) — when reactivating any subscription, immediately scale the DB to General Purpose Serverless (max 1 vCore, min 0.5, 1h auto-pause, 2GB storage, locally-redundant backup) to keep ongoing cost at ~$1-3/month.

**Switch**: set `BACKEND_MODE = 'azure'` in [src/config/backend.js](TrainWiseExpo/src/config/backend.js) (its `AZURE_URL` constant holds the live `…azurewebsites.net/api` URL), then rebuild the APK. Both axios clients pick it up automatically.

**Backend `appsettings.json`** — the local JSON connection string is ignored at runtime in Azure because Azure App Service injects the value via the `Connection strings` blade (Configuration → Connection strings, name=`DefaultConnection`, type=`SQLAzure`). `DBservice.Connect()` reads via `IConfigurationRoot` with `.AddEnvironmentVariables()`, so the App Service value wins over JSON.

**Publishing backend changes (Azure mode)**: open `TrainWise.sln` in VS 2022 → right-click TrainWise project → **Publish** → press **Publish** on the existing profile. Azure App Service auto-restarts on deploy.

**Azure config that must stay correct**:
- **Azure SQL Networking** → "Allow Azure services and resources to access this server" = ON. Without it the App Service cannot reach the DB.
- **Swagger is gated to Development** in [Program.cs](TrainWise/TrainWise/Program.cs) (re-gated in the 2026-07-02 security pass) — `/swagger` is NOT served on the Azure URL. For live triage, temporarily relax the gate and revert after (see docs/DEPLOY.md on `main`). Cold starts on Free F1 take 10-30s after 20min idle.
- **Profile pictures** (`/api/users/{id}/upload`) write to `wwwroot/images` which on Azure may not survive App Service restarts. Migrate to Azure Blob Storage or a persisted disk at `D:\home\data\images` if persistence becomes a problem.

**Diagnosing 4xx/5xx (Azure mode)**: `App Service → Monitoring → App Service logs → Application logging (Filesystem) = On (Level: Information)`. Then `Log stream` shows incoming requests + exceptions live. Controllers return `BadRequest(ex.Message)` — the actual error is in the response body, NOT the log stream (the stream only shows the status code). Check both.

### Mode B — Local LAN

Backend runs in VS 2022 on the user's PC, SQL on the same PC's SQL Express, phone reaches the API over WiFi. **Zero cloud cost but tethered to the user's home WiFi**. Phone and PC must be on the same subnet. PC must be on and the API must be running for the app to work at all.

**Switch**: set `BACKEND_MODE = 'local'` in [src/config/backend.js](TrainWiseExpo/src/config/backend.js) and keep `LOCAL_PC_IP` current (the PC's DHCP-assigned IP — `192.168.1.118` as of 2026-07-07; see "PC's IP changes" gotcha below). The ML service in [src/services/mlApi.js](TrainWiseExpo/src/services/mlApi.js) carries the same IP on port 8000 in its own hardcoded `ML_BASE_URL` and must be kept in sync by hand.

**Backend `appsettings.json` connection string**:
```
Data Source=Lirone\SQLEXPRESS;Initial Catalog=TrainWise;Integrated Security=True;Encrypt=False
```
The database name is `TrainWise`, not `TrainWiseDB` — local SQL Express was set up with the shorter name. The migrations that ran on Azure SQL also need to run on the local DB. **Run order on a fresh DB** (complete list in docs/SETUP.md on `main`): `TWDB.sql` (schema+procs) → `2026-06-02_add_is_trainee.sql` → `2026-06-04_add_messages.sql` → `2026-06-07_add_message_image.sql` → `seed_reference_data.sql` → `2026-06-08_add_social.sql` (depends on reference data + ActivityTypes for its fake-user seed) → `2026-06-12_add_forecasts.sql` → `2026-06-18_add_injury_link.sql` → the five `2026-06-19_*` scripts (calendar, cosmetics, live_location, records, workout_board) → `2026-06-21_add_board_image.sql` → `2026-06-21_add_push_token.sql` → `2026-06-28_add_green_batch.sql` (notes/photos, pain logs, body measurements, typing, reactions, kudos) → `2026-07-02_security_hardening.sql` (widens `Users.Password` for the PBKDF2 hash — must run BEFORE deploying the hashing backend) → `2026-07-10_fix_injury_link_ondelete.sql` (recreates `FK_InjuriesReports_ActivityLogs` with `ON DELETE SET NULL` so deleting a workout that has a linked injury no longer fails; also unblocks `sp_DeleteUser`) → … → `2026-07-19_event_chat_full.sql` → `2026-07-21_add_programs.sql` (#133 assigned programs: `TrainingPrograms` + `ProgramWorkouts` + `ProgramAssignments`, a `SourceAssignmentId` column on `PlannedWorkouts`, and per-assignment chat `ProgramMessages`/`ProgramMessageReactions`/`ProgramMessageReads`). Scripts at `c:\Dev\TrainWise\sql\`.

### Reference / seed data (must run on any fresh DB)

`TWDB.sql` / `TrainWisev0.sql` are **schema + stored procedures only — no data rows**. A fresh DB therefore has empty lookup tables, which breaks the activity/injury/goal dropdowns and the load algorithm until seeded. The canonical seed data lives in [sql/seed_reference_data.sql](sql/seed_reference_data.sql) (run it after the schema + migrations; it's `IF NOT EXISTS`-guarded so it's safe to re-run). Captured 2026-06-07:

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

Everything else (`Users`, `Coaches`, `ActivityLogs`, `DailyLoad`, `Messages`, …) is per-user runtime data, not seed data. To dump the live DB's full contents as INSERTs, use [sql/export_all_data.sql](sql/export_all_data.sql) or SSMS → Generate Scripts → "Data only".

**Backend launch profile** must bind to `http://+:5249` or `http://0.0.0.0:5249` (NOT `http://localhost:5249`) — Properties → Debug → "Open debug launch profiles UI" → applicationUrl. Verify on startup that the log says `Now listening on: http://0.0.0.0:5249`.

**Windows Firewall** must allow inbound TCP 5249 on the **Private** profile. One-time setup, in Administrator PowerShell:
```
New-NetFirewallRule -DisplayName "TrainWise API 5249" -Direction Inbound -LocalPort 5249 -Protocol TCP -Action Allow -Profile Private
```
The active WiFi network must be classified as **Private**, not Public (Settings → Network → click WiFi → Network profile type → Private). Public profile = rule doesn't apply.

**Android cleartext HTTP**: the manifest at [TrainWiseExpo/android/app/src/main/AndroidManifest.xml](TrainWiseExpo/android/app/src/main/AndroidManifest.xml) has `android:usesCleartextTraffic="true"` on the `<application>` tag (added 2026-06-06). Android 9+ blocks plain-HTTP requests by default; without this attribute the app silently fails on every API call in Local LAN mode. Azure mode uses HTTPS so this attribute is irrelevant there but doesn't hurt.

**`wwwroot/images` folder** must exist on the local PC at `C:\Dev\TrainWise\TrainWise\TrainWise\wwwroot\images` for profile-pic upload to work. Create it once with `New-Item -ItemType Directory -Force -Path "C:\Dev\TrainWise\TrainWise\TrainWise\wwwroot\images"`.

**The PC's IP changes (Local LAN gotcha)**: DHCP leases expire and the router reassigns IPs. When the PC's IP shifts (e.g. `.117` → `.118`), every API call from the phone times out with `Network Error` because `LOCAL_PC_IP` in [src/config/backend.js](TrainWiseExpo/src/config/backend.js) points at the old ghost IP (and `ML_BASE_URL` in mlApi.js does too — update BOTH, then rebuild the APK). Verify the current IP with `ipconfig | findstr IPv4` before debugging anything else. Long-term fix: reserve a static IP at the router (DHCP reservation against the PC's WiFi MAC) OR use `http://<hostname>.local:5249/api` so Android resolves via mDNS instead of a hardcoded IP.

**Diagnosing connection failures in Local LAN mode** (run in this order):
1. `netstat -an | findstr 5249` on the PC → must show `0.0.0.0:5249 LISTENING`. If `127.0.0.1:5249` only → launch profile bug. If nothing → API isn't running.
2. `http://localhost:5249/swagger/index.html` in PC browser → confirms the API is up at all.
3. `http://<PC-LAN-IP>:5249/swagger/index.html` in PC browser → confirms it's reachable on the LAN interface. If localhost works but LAN doesn't, check (a) firewall rule applied on the right profile, (b) IP hasn't changed.
4. Same URL in the phone's browser (NOT the app) → confirms the phone can reach the PC over WiFi. If PC browser works but phone doesn't, phone is on a different subnet/WiFi.
5. Only after all of the above pass, rebuild the APK and test from the app.

### Switching modes

The switch is mechanical and reversible:

**Azure → Local**:
1. In [src/config/backend.js](TrainWiseExpo/src/config/backend.js): set `BACKEND_MODE = 'local'` and update `LOCAL_PC_IP` to the current PC IP (also update `ML_BASE_URL` in mlApi.js).
2. Verify backend `appsettings.json` `DefaultConnection` points at `Lirone\SQLEXPRESS` (it does by default — Azure-mode override comes from the App Service Connection strings blade, not from the JSON file).
3. Ensure local SQL Express has the latest schema (run any pending scripts from `c:\Dev\TrainWise\sql\`).
4. Confirm `usesCleartextTraffic="true"` is present in AndroidManifest.xml. Rebuild APK.
5. Start API in VS 2022. Verify firewall + network profile + PC IP per the diagnostic steps above.

**Local → Azure**:
1. In [src/config/backend.js](TrainWiseExpo/src/config/backend.js): set `BACKEND_MODE = 'azure'` (the `AZURE_URL` there is the live `trainwise01-api-…azurewebsites.net/api`).
2. (Optional) Remove `usesCleartextTraffic="true"` for production hygiene — not strictly required since HTTPS doesn't need it.
3. Ensure the Azure subscription is active and the App Service is started (scale the DB to Serverless as described in Mode A if reactivating).
4. Rebuild APK.

The C# backend code itself is identical in both modes; nothing in `Controllers/`, `BL/`, or `DAL/` changes when switching.

### Backend architecture notes

- Three-layer: `Controllers → BL → DAL → DBservice` (see Architecture section below).
- SQL Server's `IDENTITY_CACHE` causes ID gaps of ~1000 across service restarts; this is normal SQL Server behavior, not a bug. Disable per-DB with `ALTER DATABASE SCOPED CONFIGURATION SET IDENTITY_CACHE = OFF;` if it bothers you.
- Backend uses raw ADO.NET (no EF Core). In Azure mode, schema lives in Azure SQL; manage it with SSMS connected to `trainwiseadmin.database.windows.net`. In Local LAN mode, manage with SSMS connected to `Lirone\SQLEXPRESS`. The schema must be kept in sync between the two — every migration script in `c:\Dev\TrainWise\sql\` should be run against both DBs.

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

**Do NOT run `npx expo prebuild --clean`** — it overwrites manual edits in `MainActivity.kt` and `AndroidManifest.xml` that are required for Health Connect to work (see Health Connect notes in CLAUDE2.md).

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
  config/backend.js  # BACKEND_MODE switch ('local' | 'azure') — the single API_BASE_URL source
  api/             # Auth context + authToken (JWT), HC service, sync orchestration, axios client (legacy)
  services/api.js  # **Primary axios client** — all backend HTTP goes here
  services/mlApi.js  # axios client for the Python ML service (own hardcoded ML_BASE_URL)
  navigation/      # Single root NavigationStack, no Expo Router despite Expo defaults
  screens/         # One file per screen, JS class-free
  components/      # Reusable: ComboBox, Card, PrimaryButton, ScreenHeader
  theme/colors.js  # Dark-theme palette — use `Colors.*` not raw hex
```

Note that `src/api/api.js` and `src/services/api.js` both exist. `services/api.js` is the canonical one; `api/api.js` is older and progressively being phased out (still hosts `getActivityLogs`, `registerUser`, device endpoints). New endpoints go in `services/`. **Both files import `API_BASE_URL` from [src/config/backend.js](TrainWiseExpo/src/config/backend.js)** (so they can no longer drift apart), and that URL already ends in `/api` — endpoint paths must NOT also start with `/api` (e.g. write `apiClient.post('/Users', ...)`, not `apiClient.post('/api/Users', ...)`). The doubled-prefix `/api/api/Users` was a 404 bug fixed 2026-05-31.

### Auth model (JWT bearer since the 2026-07-02 security pass)

**JWT bearer auth** — the old "session-based, no JWT" model is gone:

- **Issuance**: [BL/JwtService.cs](TrainWise/TrainWise/BL/JwtService.cs) (HS256) mints a token carrying `uid` + `isCoach`/`isTrainee` claims on `POST /api/auth/login` ([AuthController](TrainWise/TrainWise/Controllers/AuthController.cs) → `{ token, user }`), on signup (`POST /api/Users` → `{ userID, token }`), and on `POST /api/users/google-login`. Config is all env vars: `JWT_KEY` (HMAC key, ≥32 chars — REQUIRED in prod or tokens die on every restart; random per-process key in dev), `JWT_ISSUER`/`JWT_AUDIENCE`, `JWT_EXPIRY_DAYS` (default 30 — long-lived, no refresh flow yet).
- **Validation + staged enforcement**: [Program.cs](TrainWise/TrainWise/Program.cs) validates tokens whenever present. The **`AUTH_ENFORCE`** env var (default off) is the stage-2 switch: when `true`, a fallback authorization policy requires a valid token on every endpoint without `[AllowAnonymous]` (only login/signup/google-login are anonymous). This let old tokenless APKs keep working during rollout.
- **Per-object ownership**: [BaseApiController.cs](TrainWise/TrainWise/Controllers/BaseApiController.cs) exposes `CallerId`/`CallerIsCoach` (from claims) and the gates `CallerMayAct(userId)`, `CallerMayActEither(a,b)`, `CallerOwnsOrCoaches(traineeId)` (self OR linked coach), `CallerOwnsCoachId(coachId)`. All gates ALLOW tokenless callers (pre-enforcement safety) but DENY a token that belongs to a different user — closing IDOR without breaking old builds.
- **Client side**: [src/api/authToken.js](TrainWiseExpo/src/api/authToken.js) holds the token (module variable + AsyncStorage mirror, key `@trainwise_token`); bearer interceptors sit on both axios clients, the raw-fetch uploads, and mlApi.js. Moving it to `expo-secure-store` is a known backlog item.
- **Also server-verified**: Google sign-in (`GoogleTokenVerifier` checks the ID token's signature + audience server-side — the client's `GoogleId` is never trusted) and signup reCAPTCHA (`CaptchaVerifier` → Google siteverify; **fail-open** when `RECAPTCHA_SECRET` is unset). Auth endpoints are rate-limited (10/min/IP "auth" policy + 300/min/IP global backstop in Program.cs). Passwords are PBKDF2-hashed ([BL/PasswordHasher.cs](TrainWise/TrainWise/BL/PasswordHasher.cs), SHA-256/100k/salted, verify-and-upgrade from legacy plaintext rows — `2026-07-02_security_hardening.sql` widened `Users.Password` first).

[src/api/AuthContext.js](TrainWiseExpo/src/api/AuthContext.js) still stores the user object in AsyncStorage and exposes `userId` to the rest of the app. A locally-generated `deviceId` (string `dev-<timestamp>-<rand>`) is also persisted; the backend's `UserDevices` table expects numeric IDs, so the sync service skips device-update calls when the local ID isn't numeric.

### SignUp flow

Two-step: [SignUpScreen.js](TrainWiseExpo/src/screens/SignUpScreen.js) (basic info + gender) → [SignUpFinal.js](TrainWiseExpo/src/screens/SignUpFinal.js) (preferences + terms + **reCAPTCHA** — the token is verified server-side by `CaptchaVerifier`, fail-open when `RECAPTCHA_SECRET` is unset) → POSTs `/api/Users` via `registerUser(payload)` from `src/api/api.js` → returns `{ userID, token }`. Both screens registered as separate routes in `AuthStack`. **Google sign-in** is also available on Login and SignUp: the native `@react-native-google-signin` picker sends the Google **ID token** to `POST /api/users/google-login`, which verifies it server-side (`GoogleTokenVerifier`, audience-checked) before find-or-create.

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

Single root in [NavigationStack.js](TrainWiseExpo/src/navigation/NavigationStack.js). Tab navigator with four tabs — **Home / Load / Health / Connect** (the Profile tab was removed in sprint B; Profile is a HomeStack screen now):

- **AuthStack**: `Welcome → Login | SignUp → SignUpFinal`
- **HomeTab (HomeStack)**: `HomeMain → Stats | Warnings | AddWorkout | InjuryReport → ActiveInjuries | WorkoutSummary | WorkoutRoute | Settings | ConnectQR | Shop | AIChat | Chat | MyNetwork | CoachTraineeDetail → CoachTraineeAnalytics | Profile | PersonalRecords | TrainingCalendar | Timer | Achievements`
- **LoadTab**: `WarningsDashboardScreen` mounted directly as the tab (labeled "Load", B-1 redesign)
- **HealthTab (HealthStack)**: `HealthConnectMain` (= GoogleFitScreen) `| WorkoutRoute`
- **ConnectTab (ConnectStack)** (2026-06-08): `ConnectMain → Requests | MyNetwork | Chat | WorkoutBoard | Leaderboard`

`AppTabs` is wrapped by `HealthSyncProvider` (Health-tab `unconfirmedCount` badge), `MessagesProvider` (chat unread), and `SocialProvider` (Connect-tab `pendingTotal` badge + presence heartbeat). **Coach-only users see only Home + Connect** (the Load and Health tabs are hidden — coaches don't track their own load). The "My coach" Home button was renamed **"My network"** and now opens the `MyNetwork` hub (the file is still `MyCoachScreen.js`).

## Shared chart logic

`getBarColor(load)` is exported from [HomeScreen.js:24](TrainWiseExpo/src/screens/HomeScreen.js#L24) and re-imported by StatsScreen. Both Home dashboard and Warnings dashboard use the **same per-day session-load aggregation** with these thresholds:
- `≤ 0` → `#2a2a4a` (empty)
- `< 150` → green `#00e676`
- `< 300` → yellow `#ffee58`
- `< 500` → orange `#ff9800`
- `≥ 500` → red `#f44336`

Use `useFocusEffect` (not `useEffect`) on tab-switched screens so deletes on the Health tab propagate when the user returns Home.

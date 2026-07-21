# Deployment Guide — TrainWise

How TrainWise ships: the **C# backend** publishes to **Azure App Service** (with **Azure SQL**), the
**phone app** ships as an **Android APK** built from the Expo project, and the **ML service** stays
local (for now).

```
                 ┌─────────────────────────────────────┐
   Android APK   │  Azure App Service (.NET 8)          │
  (Expo build) ──┼─►  trainwise01-api-…azurewebsites.net│
   HTTPS         │     └── Azure SQL  (TrainWiseDB)     │
                 └─────────────────────────────────────┘
                              ▲
   Coach analytics screen     │  HTTP over LAN (phone + PC same WiFi)
        ┌─────────────────────┴───────────────┐
        │  ml/app.py  (Python Flask, port 8000)│  ← runs on the dev PC, NOT Azure
        │  reads the same SQL DB                │
        └──────────────────────────────────────┘
```

> **Two deploy artifacts, one config switch.** The backend and the APK are deployed separately. The
> APK has its backend URL **baked in at build time** (`API_BASE_URL` from
> `TrainWiseExpo/src/config/backend.js`) — so "deploying" the app means rebuilding the APK after
> pointing it at the right backend.

---

## Part 1 — Backend → Azure App Service

The current Azure target (as of the last redeploy) is:

| Resource | Value |
|---|---|
| App Service (API) | `https://trainwise01-api-djcfcvcedth8hjgp.israelcentral-01.azurewebsites.net` |
| Azure SQL server | `<your-sql-server>.database.windows.net` |
| Azure SQL database | `TrainWiseDB` |
| Region | Israel Central |
| Publish profiles | `TrainWise/TrainWise/Properties/PublishProfiles/` (`TrainWise-api` and `TrainWise01-api`) |

### Publish a backend change

1. Open `TrainWise/TrainWise.sln` in **Visual Studio 2022**.
2. Right‑click the **TrainWise** project → **Publish**.
3. Select the **`TrainWise01-api - Web Deploy`** profile → press **Publish**.
4. Azure App Service auto‑restarts on deploy. Cold start after idle is 10–30s on the Free/Basic tier.

### Azure config that must stay correct

- **Connection string** — the live DB string is injected by the App Service **Connection strings**
  blade (name `DefaultConnection`, type `SQLAzure`), **not** by `appsettings.json`. `DBservice.Connect()`
  reads config with environment‑variable fallback, so the App Service value wins over the JSON.
- **Azure SQL networking** — "Allow Azure services and resources to access this server" must be **ON**,
  or the App Service can't reach the DB.
- **Auth env vars** (App Service → **Configuration → Application settings**, read from the environment,
  never hardcoded):
  - `JWT_KEY` — **required in prod**: HS256 signing key (≥ 32 chars) for JWT auth. If unset, tokens use a
    random per‑process key and die on restart. `AUTH_ENFORCE=true` makes a valid token **required** on
    every non‑anonymous endpoint (flip on only after the token‑sending APK is live). `JWT_ISSUER` /
    `JWT_AUDIENCE` / `JWT_EXPIRY_DAYS` optional.
  - `RECAPTCHA_SECRET` — reCAPTCHA secret key for `CaptchaVerifier`. Leave **unset** to keep signup
    verification disabled (fail‑open); set it only once the app ships the matching site key.
  - `GOOGLE_WEB_CLIENT_ID` *(optional)* — expected audience for Google ID‑token verification (defaults to
    the project's public web client ID).
  - `FIREBASE_CREDENTIALS_JSON` — service‑account JSON for FCM push (`PushSender`).
  - `GOOGLE_PLACES_KEY` — server‑side Google Places key for the nearby‑gyms proxy (`PlacesService`, billable
    SKU). Leave unset to disable the live Places lookup (falls back to the seeded gyms).
  - `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` / `SMTP_SSL` — transactional email
    (`EmailSender`) for password‑reset + verification. Unset = emails don't send. Gmail needs an **App
    Password** (2‑Step Verification on); SendGrid uses host `smtp.sendgrid.net`, user literally `apikey`.
  - `AUTH_DEV_CODES=true` *(dev/demo only)* — echoes the reset/verify code in the API response so the flows
    are testable without SMTP. Never set this in a real deployment.
- **Schema parity** — run every `sql/` migration against Azure SQL too (SSMS → connect to
  `<your-sql-server>.database.windows.net`). The schema must match local SQL Express. **Run
  `2026-07-02_security_hardening.sql` (it widens `Users.Password` for the PBKDF2 hash) BEFORE publishing
  the hashing code**, or new logins truncate.
- **Swagger** — `Program.cs` gates Swagger to `IsDevelopment()`. If you need the API explorer on the
  live URL for triage, temporarily relax that gate (and revert after).

### Diagnosing 4xx/5xx on Azure

- App Service → **Log stream** shows incoming requests + the **status code**.
- Controllers return `BadRequest(ex.Message)`, so the **actual error text is in the response body**,
  not the log stream. Check both — hit the endpoint in Swagger / a REST client and read the body.

---

## Part 2 — Frontend → Android APK

### Point the APK at the right backend first

Set `BACKEND_MODE` in `TrainWiseExpo/src/config/backend.js` — the single switch both axios clients
import their `API_BASE_URL` from:

- **For public distribution / testing anywhere:** `BACKEND_MODE = 'azure'` (the
  `https://…azurewebsites.net/api` URL).
- **For local‑LAN testing:** `BACKEND_MODE = 'local'` + the current PC IP in `LOCAL_PC_IP` — the APK
  only works on the same WiFi with the backend running.

> An "Error 403 — web app is stopped" page in the app means the APK still points at a dead Azure URL
> (an old build). Rebuild after fixing the `BASE_URL`.

### Build the APK

```powershell
cd TrainWiseExpo

# Preferred: re-prebuilds + bundles + installs
npx expo run:android --variant release

# Or build the file directly (does NOT re-prebuild):
cd android
$env:NODE_OPTIONS = "--max-old-space-size=8192"   # avoids the JS-bundle OOM
./gradlew clean assembleRelease --no-parallel
```

- Output is **always** `TrainWiseExpo/android/app/build/outputs/apk/release/app-release.apk`.
- `gradlew assembleRelease` can print **BUILD SUCCESSFUL** but skip repackaging when it thinks the JS
  bundle is current — **verify the APK timestamp/size changed**. `clean assembleRelease` forces a fresh
  bundle.
- The `--max-old-space-size=8192` is **build‑time RAM on the PC** (the Node bundler), not app size —
  the APK stays ~125 MB.
- A rotated native Maps key only reaches the manifest via `expo run:android` / prebuild — plain
  `gradlew` does not re‑prebuild.
- **`expo-task-manager`** (background‑GPS, added for live run tracking) is a **native** module — a full
  native rebuild is required (delete `app/.cxx` + `app/build` first to force it). It autolinks via gradle;
  the background‑location manifest permissions were added **by hand** (preserving the Health Connect aliases),
  so **do not `expo prebuild`** — verify the three permissions + the `location` foreground service merged.
- **Release signing** uses a dedicated keystore `android/app/trainwise-release.keystore` (not the shared
  debug keystore) so Google Sign‑In's Android OAuth client has a **unique SHA‑1**. The keystore + its
  passwords live only locally (gitignored) — **back them up**. Changing the keystore changes the app
  **signature**, so the app must be **uninstalled** before installing the new APK, and the new SHA‑1 must
  be registered on the Firebase Android app.

> **Never run `npx expo prebuild --clean` and never use EAS Build** on this project. Both regenerate
> `android/` from `app.json` and wipe the manual Health Connect manifest edits (the
> `ViewPermissionUsageActivity` alias, the `MainActivity.kt` permission delegate). See
> [CLAUDE.md](../CLAUDE.md) → "Native HC requirements". Use `expo run:android --variant release`.

### Distribute

- The APK is the single file above. Send it directly (it's not on a store).
- A **Local‑LAN APK** only works for devices on the same WiFi with the PC backend + SQL running. For
  remote testers, build against the **Azure** URL.

---

## Part 3 — ML service (live on Azure)

The Python analytics service (`ml/app.py`, port 8000 locally) powers the trainee **Load** tab
(Python‑primary), the coach PMC / forecast, and the **What‑if planner** (`/whatif`). It is **now live on
Azure App Service**: `trainwise-ml` → `https://trainwise-ml-…israelcentral-01.azurewebsites.net`, health at
`/health` → `{"db":true,"status":"ok"}`. The client chooses the instance with **`ML_MODE`** in
`src/services/mlApi.js` (`local` | `azure` — currently `local`); flip it + rebuild the APK to use the cloud.

- **Dual‑mode DB** (`ml/db.py`): `pyodbc` + Windows auth locally; **`pymssql` + Azure SQL (SQL auth)** when
  `AZURE_SQL_USER` **and** `AZURE_SQL_PASSWORD` are set. `gunicorn` + `pymssql` are Linux‑marked in
  `requirements.txt` (Azure installs them; local Windows skips).
- **Required App settings (4):** `TRAINWISE_SQL_SERVER=<server>.database.windows.net` (mind the `01` on the
  real server name), `AZURE_SQL_USER`, `AZURE_SQL_PASSWORD`, `TRAINWISE_SQL_DATABASE=TrainWiseDB`. Optionally
  `ML_AUTH_ENFORCE=true` + `JWT_KEY` (same value as the C# API). **`AZURE_SQL_PASSWORD` is a secret — set it
  only in Application settings, never in source.**
- **Deploy method:** deploy a clean folder (app.py, db.py, config.py, features.py, forecast.py, risk.py,
  auth.py, requirements.txt, `.deployment`, `models/`) — VS Code Azure panel → right‑click `trainwise-ml` →
  Deploy to Web App. Do **not** deploy the working `ml/` folder (its local `venv` breaks the deploy). Runtime
  **Python 3.11/3.12** (not 3.13 — `pymssql` wheels lag).
- **Gotcha:** the serverless Azure SQL **auto‑pauses**; the first `/health` after idle can return
  `{"db":false}` for ~30 s while it wakes — refresh a couple of times. Ensure `/whatif` is present on
  whichever instance `ML_MODE` points at (redeploy if Azure is behind).

---

## Switching backend modes (Azure ↔ Local)

The switch is mechanical and reversible — the C# code never changes:

**Azure → Local**
1. Set `BACKEND_MODE = 'local'` + the current PC IP in `LOCAL_PC_IP` (`src/config/backend.js`); set
   `ML_BASE_URL` to `http://<PC-IP>:8000` (`src/services/mlApi.js` — still hardcoded separately).
2. Confirm `appsettings.json` points at `…\SQLEXPRESS` (it does by default).
3. Ensure local SQL Express has every `sql/` migration applied.
4. Confirm `usesCleartextTraffic="true"` in `AndroidManifest.xml`. Rebuild the APK.
5. Start the API in VS 2022; verify firewall + Private network profile + current PC IP.

**Local → Azure**
1. Set `BACKEND_MODE = 'azure'` in `src/config/backend.js`.
2. Ensure the App Service is running and Azure SQL has the latest schema.
3. Rebuild the APK.

---

## Quick reference

| Item | Value |
|---|---|
| Backend solution | `TrainWise/TrainWise.sln` (VS 2022) |
| Backend local URL | `https://localhost:5249` (Swagger at `/swagger`, dev only) |
| Backend Azure URL | `https://trainwise01-api-djcfcvcedth8hjgp.israelcentral-01.azurewebsites.net` |
| Azure SQL | `<your-sql-server>.database.windows.net` / `TrainWiseDB` |
| APK output | `TrainWiseExpo/android/app/build/outputs/apk/release/app-release.apk` |
| ML service | `ml/app.py` → `http://<PC-IP>:8000` (local only) |
| Firewall ports | TCP **5249** (API) + **8000** (ML), inbound, Private profile |

> **Before any commit/push, follow the safe‑push checklist in [SECURITY.md](SECURITY.md)** — the tracked
> `appsettings.json` carries the live Azure SQL password in your working copy and must be restored‑staged
> so it's never committed.

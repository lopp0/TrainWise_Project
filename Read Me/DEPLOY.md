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
> APK has its backend URL **baked in at build time** (the two `BASE_URL`s) — so "deploying" the app
> means rebuilding the APK after pointing it at the right backend.

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
  - `RECAPTCHA_SECRET` — reCAPTCHA secret key for `CaptchaVerifier`. Leave **unset** to keep signup
    verification disabled (fail‑open); set it only once the app ships the matching site key.
  - `GOOGLE_WEB_CLIENT_ID` *(optional)* — expected audience for Google ID‑token verification (defaults to
    the project's public web client ID).
  - `FIREBASE_CREDENTIALS_JSON` — service‑account JSON for FCM push (`PushSender`).
- **Schema parity** — run every `sql/` migration against Azure SQL too (SSMS → connect to
  `<your-sql-server>.database.windows.net`). The schema must match local SQL Express.
- **Swagger** — `Program.cs` gates Swagger to `IsDevelopment()`. If you need the API explorer on the
  live URL for triage, temporarily relax that gate (and revert after).

### Diagnosing 4xx/5xx on Azure

- App Service → **Log stream** shows incoming requests + the **status code**.
- Controllers return `BadRequest(ex.Message)`, so the **actual error text is in the response body**,
  not the log stream. Check both — hit the endpoint in Swagger / a REST client and read the body.

---

## Part 2 — Frontend → Android APK

### Point the APK at the right backend first

Set the **same** `BASE_URL` in both `TrainWiseExpo/src/api/api.js` and
`TrainWiseExpo/src/services/api.js`:

- **For public distribution / testing anywhere:** the Azure URL (`https://…azurewebsites.net/api`).
- **For local‑LAN testing:** `http://<PC-LAN-IP>:5249/api` — the APK only works on the same WiFi with
  the backend running.

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

## Part 3 — ML service (local, not deployed)

The Python coach‑analytics service (`ml/app.py`, port 8000) runs on the dev PC and reads the same SQL
database. It is **not** on Azure today, so the coach Analytics / forecast screen only works on the same
WiFi as the PC. To run it, see [ml/README.md](../ml/README.md) and [SETUP.md](SETUP.md#step-7--optional-run-the-ml-coachanalytics-service).

**To make it cloud‑side (future):** deploy `ml/app.py` to Azure App Service (F1) and rewire `ml/db.py`
from `pyodbc` + Windows auth to **pymssql + Azure SQL (SQL auth)**. Not done yet — see the
[roadmap](../README.md#roadmap--planned).

---

## Switching backend modes (Azure ↔ Local)

The switch is mechanical and reversible — the C# code never changes:

**Azure → Local**
1. Set both `BASE_URL`s to `http://<PC-IP>:5249/api`; set `ML_BASE_URL` to `http://<PC-IP>:8000`.
2. Confirm `appsettings.json` points at `…\SQLEXPRESS` (it does by default).
3. Ensure local SQL Express has every `sql/` migration applied.
4. Confirm `usesCleartextTraffic="true"` in `AndroidManifest.xml`. Rebuild the APK.
5. Start the API in VS 2022; verify firewall + Private network profile + current PC IP.

**Local → Azure**
1. Set both `BASE_URL`s back to the Azure `…azurewebsites.net/api` URL.
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

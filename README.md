<div align="center">

# TrainWise

**Training‑load intelligence for athletes and coaches — catch overtraining before it becomes injury.**

Log your workouts (manually or straight from Google Health Connect), and TrainWise turns them into
an acute‑load / chronic‑load **ACWR** picture with a color‑coded warning level, a smart "what should
I train today?" suggestion, injury tracking with AI advice, a coach dashboard, a social layer, and an
ML‑powered monthly forecast.

![ASP.NET Core 8](https://img.shields.io/badge/API-ASP.NET%20Core%208-512BD4)
&nbsp;·&nbsp; ![React Native](https://img.shields.io/badge/app-React%20Native%200.81%20%2F%20Expo%2054-61DAFB)
&nbsp;·&nbsp; ![Azure](https://img.shields.io/badge/cloud-Azure%20App%20Service-0078D4)
&nbsp;·&nbsp; ![Python ML](https://img.shields.io/badge/ML-Python%20%2F%20Flask-3776AB)
&nbsp;·&nbsp; ![SQL Server](https://img.shields.io/badge/db-SQL%20Server-CC2927)

[Setup](docs/SETUP.md) · [Deploy](docs/DEPLOY.md) · [Security](docs/SECURITY.md) · [Features](docs/featureslist.md) · [Architecture (CLAUDE.md)](CLAUDE.md)

</div>

---

## What it does

An athlete logs a workout and immediately sees whether they're training in a safe zone or digging
themselves into an injury:

- 📊 **Training‑load engine** — every session's load = `duration × exertion`. The backend rolls that
  into a 7‑day **acute** load, a 28‑day **chronic** load, and an **AC ratio** (ACWR) with a strict
  green / yellow / red warning level. This is the app's reason to exist (`BL/LoadCalculationBL.cs`).
- ⌚ **Health Connect sync** — read‑only import of workouts from Google Health Connect (Android), with
  de‑dupe and tombstones so deleting a workout doesn't re‑import it on the next sync.
- 🏋️ **Workouts & injuries** — manual workout logging, a foldable add‑workout form, route maps for
  cardio, an injury report flow with **photo scan + AI advice**, and per‑injury recovery tracking.
- 🧠 **Smart workout suggestion** — scores live **weather, air quality, UV, wind** plus your current
  AC ratio into a "Great / Good / Fair / Poor" recommendation for today.
- 🧑‍🏫 **Coach ↔ trainee** — a coach dashboard, per‑trainee load drill‑down, QR connect, and
  coach‑authored recommendations. A trainee can have multiple coaches.
- 💬 **Chat** — WhatsApp‑style user↔user messaging (coach↔trainee and friend↔friend) with images,
  read receipts, and unread badges.
- 🌐 **Connect (social)** — friends, gyms on a map, presence heartbeat, and coach offers, scoped to
  the local area.
- 🎮 **Gamification** — XP/coins, personal records, badges, a public workout board + weekly
  leaderboard, a training calendar, and a cosmetics shop.
- 🤖 **Coach ML analytics** — a separate Python service serves a **PMC** (Fitness/Fatigue/Form) chart,
  an **ACWR safe‑zone** chart, and a **monthly forecast** ("if they keep training like this, what AC
  ratio will they hit?").
- 🔔 **Push notifications** — load‑aware daily reminders, workout‑warning pushes, and social pushes.
- 🌗 **Light / dark theming** — a runtime‑swappable themed palette across every screen.

> Full grouped inventory: **[docs/featureslist.md](docs/featureslist.md)** · endpoint‑by‑endpoint
> technical breakdown: **[docs/features.md](docs/features.md)**.

---

## Architecture

A three‑layer app plus a separate ML microservice. The C# API + SQL run on **Azure (Israel Central)**;
the Python ML service runs **locally** (see the note below the diagram).

```
┌─────────────────────────────────────────────────────────────────────┐
│  TrainWiseExpo/  —  React Native 0.81 / Expo SDK 54  (Android APK)   │
│  Context + axios · React Navigation · expo-maps · Health Connect     │
└───────────────┬─────────────────────────────────────┬───────────────┘
                │ JSON / HTTPS (session-based)         │ JSON / HTTP (LAN)
┌───────────────▼─────────────────────────┐   ┌────────▼───────────────┐
│  TrainWise/  —  ASP.NET Core 8 Web API   │   │  ml/  —  Python (Flask) │
│  Controllers → BL → DAL → DBservice      │   │  PMC · ACWR · forecast  │
│  raw ADO.NET (no EF) · 22 controllers    │   │  · risk (pyodbc, local) │
└───────────────┬─────────────────────────┘   └────────┬───────────────┘
                │                                       │
        ┌───────▼────────┐    ┌─────────────────┐       │ reads the same DB
        │  SQL Server    │◄───┤ External services│       │
        │  (sql/ schema  │    │ Google Maps ·    │◄──────┘
        │  + stored      │    │ Weather · Air ·  │
        │  procedures)   │    │ OpenAI · FCM     │
        └────────────────┘    └─────────────────┘
```

> **The ML service is not on Azure.** The C# API + SQL are cloud‑hosted, so login / workouts / chat /
> coach work from anywhere. The coach **Analytics / forecast** screen only works when the local Python
> service (`ml/app.py`, port 8000) is running and the phone is on the same WiFi — otherwise it shows
> the graceful "analytics offline" fallback. Making the forecast cloud‑side is on the
> [roadmap](#roadmap--planned).

| Layer | Path | Responsibility |
|---|---|---|
| **Database** | [`sql/`](sql) | SQL Server schema + stored procedures (`TWDB.sql` / `TrainWiseV2.sql`), 13 dated migration scripts, and `seed_reference_data.sql` (lookup data) |
| **Backend** | [`TrainWise/`](TrainWise) | ASP.NET Core 8 Web API — 22 controllers, three‑layer `Controllers → BL → DAL → DBservice`, raw ADO.NET (no EF Core) |
| **Frontend** | [`TrainWiseExpo/`](TrainWiseExpo) | React Native 0.81 / Expo SDK 54 app (Android), 30 screens, `src/{api,services,components,navigation,theme,constants,utils}` |
| **ML service** | [`ml/`](ml) | Python / Flask coach‑analytics microservice (PMC, ACWR, monthly forecast, injury‑risk), pandas / scikit‑learn |
| **AI context** | [`CLAUDE.md`](CLAUDE.md) · [`tasks/`](tasks) | Deep architecture notes, conventions, and the running lessons log |

---

## Tech stack

| Area | Technologies |
|---|---|
| **Frontend** | React 19 · React Native 0.81 · Expo SDK 54 (New Architecture) · React Navigation 7 · axios · `expo-maps` · `react-native-health-connect` · `react-native-reanimated` · `react-native-svg` · `react-native-chart-kit` |
| **Backend** | ASP.NET Core 8 (C#) · pure ADO.NET (no EF Core) · `Microsoft.Data.SqlClient` · Swagger / Swashbuckle (dev) |
| **Database** | Microsoft SQL Server — Azure SQL (prod) / SQL Server Express (local) · stored procedures |
| **ML** | Python 3.10+ · Flask · pandas · NumPy · scikit‑learn · matplotlib / seaborn · pyodbc |
| **Cloud** | Azure App Service · Azure SQL Database (Israel Central) |
| **Auth** | Session‑based (no JWT) — credentials validated server‑side via `sp_LoginUser`; a Google sign‑in endpoint also exists |
| **External APIs** | Google Maps SDK · Google Weather API · Google Air Quality API · OpenAI (in‑app AI chat + injury advice) · Firebase Cloud Messaging (push) · Google Health Connect |

---

## Prerequisites

| Tool | Version | |
|---|---|---|
| Node.js | 18+ | https://nodejs.org |
| .NET SDK | 8.0 | https://dotnet.microsoft.com/download/dotnet/8.0 |
| Visual Studio 2022 | latest | runs + publishes the backend |
| SQL Server | Express 2019+ | https://www.microsoft.com/sql-server/sql-server-downloads |
| SSMS | latest | for running the schema scripts |
| Android Studio + SDK | 34+ | builds / installs the Expo APK |
| Python | 3.10+ | only for the `ml/` coach‑analytics service |
| ODBC Driver | 17 / 18 for SQL Server | ships with SSMS; needed by the ML service |

---

## Quick start

> Full, step‑by‑step instructions (including both backend modes) are in **[docs/SETUP.md](docs/SETUP.md)**.
> This is the condensed path for **local** development.

```bash
git clone https://github.com/lopp0/TrainWise_Project.git
cd TrainWise_Project
```

**1. Database** — in SSMS, connect to `YOUR_PC\SQLEXPRESS` (Windows Auth) and run, in order:
`sql/TWDB.sql` → the dated migrations → `sql/seed_reference_data.sql`. The full run‑order is in
[docs/SETUP.md](docs/SETUP.md#step-2--create-the-local-database). Lookup tables must be seeded or the
dropdowns and load algorithm break.

**2. Backend** (`https://localhost:5249`) — open `TrainWise/TrainWise.sln` in **Visual Studio 2022**
and press the green **play** button. Swagger opens at `/swagger` (dev only).

**3. Frontend** (Expo, Android)

```bash
cd TrainWiseExpo
npm install
npx expo run:android        # full native build + install on a connected device
# or: npm start             # Metro only; press r to reload JS
```

**4. ML service** (optional — coach analytics only)

```bash
cd ml
python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
python app.py               # serves on http://0.0.0.0:8000
```

---

## Configuration

TrainWise runs in **one of two backend modes** — switching is a config change, not a code change
(full detail in [docs/SETUP.md](docs/SETUP.md) and [docs/DEPLOY.md](docs/DEPLOY.md)):

- **Azure mode (current)** — both axios clients point at the Azure App Service URL. The phone reaches
  the backend over the public internet; no LAN, no firewall.
- **Local‑LAN mode** — the backend runs in VS 2022 on the PC, the phone reaches it over WiFi via the
  PC's LAN IP. Zero cloud cost, but the PC must be on and on the same WiFi.

| What | Where | Notes |
|---|---|---|
| Backend API base | `TrainWiseExpo/src/api/api.js` **and** `TrainWiseExpo/src/services/api.js` | Both `BASE_URL`s must be **identical** (an IP/host mismatch makes only some screens fail) |
| ML service base | `TrainWiseExpo/src/services/mlApi.js` | `ML_BASE_URL` — must track the PC's LAN IP in Local mode |
| DB connection | `TrainWise/TrainWise/appsettings.json` | Local string is `Data Source=…\SQLEXPRESS;…;Integrated Security=True`. In Azure the App Service **Connection strings** blade overrides it |
| Secrets (frontend) | `TrainWiseExpo/.env` (gitignored) | Google key + OpenAI key; `EXPO_PUBLIC_*` vars are inlined into the bundle (see [Security](#security-highlights)) |

---

## Project layout

```
TrainWise_Project/
├─ README.md                 ← you are here
├─ CLAUDE.md                 deep architecture notes + conventions (AI/agent context)
├─ docs/                     SETUP · DEPLOY · SECURITY · features · featureslist · scope flowchart
├─ tasks/                    session logs + the running lessons.md (self-learning notes)
├─ sql/                      schema (TWDB.sql / TrainWiseV2.sql) · 13 migrations · seed_reference_data.sql
├─ TrainWise/                ASP.NET Core 8 Web API (TrainWise.sln)
│   └─ TrainWise/            Controllers / BL / DAL / Models / Program.cs / appsettings.json
├─ TrainWiseExpo/            React Native + Expo app
│   └─ src/                  api · services · components · screens · navigation · theme · constants · utils
└─ ml/                       Python (Flask) coach-analytics service + notebook
```

---

## Security highlights

- **No secret is committed.** API keys live in `TrainWiseExpo/.env` (gitignored); the Google native
  Maps key is injected at build time via `app.config.js` (`app.json` keeps an empty placeholder).
- **`appsettings.json` is a tracked file whose working copy carries the live Azure SQL password** — a
  blind `git add -A` would commit it. The committed version holds only the clean local string. Always
  `git restore --staged` it before a push (see [docs/SECURITY.md](docs/SECURITY.md)).
- **`EXPO_PUBLIC_*` env vars are baked into the APK in plaintext** — fine for the school demo, but the
  APK is not distributed publicly.
- **Pre‑push secret scan** — before any push, scan the staged diff + committed tree for `AIza`, `sk-`,
  `Password=`, `Data Source=`, etc. (a Google key was once leaked via a push — see the lessons log).

See **[docs/SECURITY.md](docs/SECURITY.md)** for the full security posture, the safe‑push checklist,
and the hardening backlog.

---

## Documentation

| Doc | Contents |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | Local dev setup (both backend modes) + live‑Azure testing |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Azure publish (backend) + APK build/distribution |
| [docs/SECURITY.md](docs/SECURITY.md) | Security architecture, secret handling, safe‑push checklist |
| [docs/featureslist.md](docs/featureslist.md) | Full, grouped, presentation‑ready feature list |
| [docs/features.md](docs/features.md) | Technical feature inventory + complete API surface |
| [docs/PROJECT_SCOPE_FLOWCHART.md](docs/PROJECT_SCOPE_FLOWCHART.md) | System scope, user journey, load‑calc data flow |
| [CLAUDE.md](CLAUDE.md) | Deep architecture patterns, gotchas, and conventions |

---

## Roadmap / Planned

These exist in comparable projects but are **not yet implemented** in TrainWise — placeholders for
future work:

- **CI/CD** — GitHub Actions for build + test on PRs, and gated deploy on merge (currently published
  manually from VS 2022).
- **Automated secret scanning** — a `gitleaks` pre‑commit hook + CI secret scan (today the pre‑push
  scan is manual).
- **Static analysis** — CodeQL + dependency audit gates.
- **Cloud ML** — deploy `ml/app.py` to Azure (pymssql + Azure SQL) so the coach forecast works without
  the PC running.
- **iOS build** — the Expo iOS shell is unmaintained; Android only today.
- **Hardened auth** — salted password hashing + token‑based sessions (today: session‑based, validated
  in `sp_LoginUser`).

---

## License

Private project. All rights reserved.

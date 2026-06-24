# TrainWise — Project Scope Flowchart

ASCII diagrams of the whole system, the core user journey, the training‑load data flow (the technical
heart), and how the project ships. Companion to [`features.md`](features.md) and
[`../CLAUDE.md`](../CLAUDE.md).

---

## 1. Full system scope (the big picture)

```
                              ┌───────────────────────────────────────────┐
                              │            TrainWiseExpo (Android)         │
                              │     React Native 0.81 / Expo SDK 54        │
                              │                                            │
  ┌── tabs ──────────────────┤  Home · Health · Connect · Profile         │
  │                          │  + AddWorkout · Injury · Chat · Coach ·     │
  │                          │    Stats · Warnings · Shop · Calendar · …   │
  │                          └───────────────┬────────────────────────────┘
  │                                          │
  │   axios (services/api.js + api/api.js)   │ axios (services/mlApi.js)
  │   session-based · JSON/HTTPS             │ JSON/HTTP over LAN
  ▼                                          ▼
┌──────────────────────────────────┐   ┌──────────────────────────────────┐
│  TrainWise/  ASP.NET Core 8 API   │   │  ml/  Python (Flask) service     │
│                                   │   │                                  │
│  Controllers (22)  thin REST      │   │  app.py     /health /pmc /acwr   │
│       │                           │   │             /forecast            │
│       ▼                           │   │  features.py  load math          │
│  BL    business logic             │   │  forecast.py  regression         │
│       │   LoadCalculationBL ★     │   │  risk.py      classifier         │
│       ▼                           │   │  notebook/    gradeable writeup  │
│  DAL   raw ADO.NET (stored procs) │   └───────────────┬──────────────────┘
│       │                           │                   │ reads same DB
│       ▼                           │                   │
│  DBservice  (connection helper)   │                   │
└───────────────┬───────────────────┘                  │
                ▼                                       ▼
        ┌───────────────────────────────────────────────────┐
        │   SQL Server   (Azure SQL prod / SQL Express local) │
        │   sql/  schema + stored procs + seed + migrations   │
        └───────────────────────────────────────────────────┘

  External (best-effort, feature degrades if a key/SKU is off):
    Google Maps · Google Weather · Google Air Quality · OpenAI ·
    Firebase Cloud Messaging · Google Health Connect · Google Sign-In
```

★ `BL/LoadCalculationBL.cs` is the algorithm the whole app exists to run.

---

## 2. Core user journey (what an athlete actually does)

```
  Welcome
     │
     ▼
  Register ──► role picker (trainer / trainee / both)
     │            │
     │            └─► coach-only ──► Coach Dashboard ──► pick trainee ──► load drill-down
     │                                                              └──► Analytics (ML forecast)
     ▼
  Log a workout ──────────────┐
   (manual or Health Connect) │
     │                        ▼
     │              session load = duration × exertion
     ▼                        │
  Home dashboard  ◄───────────┘
   weekly load bars + AC ratio + warning color
     │
     ├─► AC ratio safe (green/yellow)  ──► Smart suggestion: "train X today"
     │                                       (weather + air + AC ratio scored)
     │
     └─► AC ratio high (red, >1.3) ────► Warning push + "recovery" suggestion
                                          coach sees it on their dashboard
```

Around the loop: chat with a coach/friend, join the Connect social layer, earn records/badges, climb
the weekly leaderboard, plan the next week on the calendar.

---

## 3. Training‑load data flow (the technical heart)

```
  AddWorkout / Health Connect sync
        │  POST /api/activitylog   { duration, exertion, activityType, date }
        ▼
  ActivityLogController ─► ActivityLogBL ─► ActivityLogDAL ─► sp_InsertActivityLog
        │                         (sets calculatedLoadForSession = duration × exertion)
        ▼
  Client calls POST /api/dailyload/user/{id}/calculate  { date: editedDay }
                                    POST .../calculate   { date: today }
        │
        ▼
  DailyLoadController ─► LoadCalculationBL
        │   acute   = sum(session loads in trailing 7 days)
        │   chronic = sum(28-day window ending at the day) / 4     (coupled ACWR)
        │   AC ratio = acute / chronic
        │   warning  = ratio < 0.8  → Green
        │              0.8 ≤ ratio ≤ 1.3 → Yellow
        │              ratio > 1.3  → Red
        ▼
  DailyLoad rows persisted ──► Home + Warnings read ActivityLogs (not stale DailyLoad)
                                to draw per-day bars + the displayed-week status
```

> Invariant: any screen that creates/edits an `ActivityLog` must set
> `calculatedLoadForSession = duration × exertion` **and** recalc `DailyLoad` for the edited day **and**
> today, or the server's rolling windows go stale. Warnings recalcs all 7 days on refresh.

---

## 4. How it ships (CI/CD & infrastructure)

```
  Today (manual):
    backend change ─► VS 2022 → Publish (TrainWise01-api profile) ─► Azure App Service (auto-restart)
    app change     ─► point both BASE_URLs ─► npx expo run:android --variant release ─► app-release.apk
    schema change  ─► run the sql/ migration in SSMS against BOTH Azure SQL and local SQL Express
    ML change      ─► restart ml/app.py locally (not deployed)

  Planned (see README roadmap):
    PR ─► GitHub Actions CI (build + test + gitleaks + audits) ─► merge ─► gated CD ─► Azure
    + CodeQL static analysis, Dependabot, cloud-hosted ML service
```

---

See [SETUP.md](SETUP.md) to run it, [DEPLOY.md](DEPLOY.md) to ship it, and
[SECURITY.md](SECURITY.md) for the secret‑handling rules.

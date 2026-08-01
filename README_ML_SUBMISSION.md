# TrainWise — Machine-Learning Submission

This package contains **all the machine-learning parts of the TrainWise project** and the code that
actually uses them in the live app. TrainWise is a full training / injury-prevention mobile app
(React Native front-end + ASP.NET Core back-end + SQL Server); this folder is the self-contained
**Python ML subsystem** extracted from it, plus the app code that consumes it.

The ML subsystem answers three real questions for a coach or athlete, all built on **training-load
monitoring** (the sports-science standard for injury prevention):

1. **Forecast (Regression)** — *"If this athlete keeps training like this, what training-load ratio
   will they reach by the end of the month?"*
2. **Risk (Classification)** — *"Is this athlete in a Safe / Warning / High injury-risk zone?"*
3. **What-if planner (Simulation on the same model)** — *"If I add N sessions this week at
   easy/medium/hard, where does the injury-risk ratio land — before they train?"*

Everything is built with the course libraries: **pandas, NumPy, scikit-learn, matplotlib, seaborn**.

---

## The core sports-science metric — ACWR

$$\text{ACWR} = \frac{\text{acute load (last 7 days)}}{\text{chronic load (last 28 days, weekly average)}}$$

Where a **session's load** = `duration (minutes) × exertion (RPE 1–10)`. Athletes get injured when
they ramp **acute** load too fast relative to their **chronic** base. The safe "sweet spot" is
**0.8–1.3**; above **1.3** is a spike (elevated injury risk), above **1.5** is danger, below **0.8**
is detraining (Gabbett, 2016). Every model here is built on this metric, with two guards that make it
correct for athletes with short histories (a **cold-start floor** and a **covered-days ramp**,
explained in the notebooks and mirrored identically across Python / C# / JavaScript).

---

## Folder map

```
TrainWise_ML_Submission/
├── 01_python_ml_service/        ← THE CORE: the Flask ML microservice (what the app calls live)
│   ├── app.py                   Flask HTTP endpoints
│   ├── features.py              load math: daily series, rolling acute/chronic, ACWR, PMC series
│   ├── forecast.py              monthly regression forecast + the #185 what-if simulator
│   ├── risk.py                  Safe/Warning/High classifier (loads pickle, rule-based fallback)
│   ├── db.py                    DB connection (dual-mode: local SQL Express / Azure SQL)
│   ├── config.py                server/db names (env-overridable), windows, load constants
│   ├── auth.py                  optional JWT check (mirrors the C# backend)
│   ├── requirements.txt         pandas / numpy / scikit-learn / flask / matplotlib / seaborn / …
│   ├── models/                  notebook-trained models the service loads when present
│   │   ├── forecast_model.pkl
│   │   └── risk_model.pkl
│   ├── README.md                run instructions for the service
│   └── AZURE_DEPLOY.md          cloud-deploy notes (the service is live on Azure App Service)
│
├── 02_notebooks/                ← THE GRADEABLE DATA-SCIENCE WRITE-UPS (Jupyter)
│   ├── TrainWise_Load_Analytics.ipynb   ACWR + EWMA, regression, classification, KMeans, model export
│   ├── TrainWise_Coach_Analytics.ipynb  the coach forecast + risk models end-to-end
│   └── TrainWise_WhatIf_Planner.ipynb   the #185 what-if simulator: scenario analysis + surrogate
│
└── 03_app_integration/          ← HOW THE LIVE APP USES THE ML SERVICE
    ├── frontend_react_native/   the mobile client that calls the Python service + renders it
    │   ├── mlApi.js                     axios client → every ML endpoint
    │   ├── CoachTraineeAnalyticsScreen.js  PMC + ACWR + forecast + what-if planner UI
    │   ├── LoadAnalyticsSection.js      trainee "Load Trend" (Classic / EWMA) card
    │   ├── AcwrTrendChart.js            custom SVG chart with the shaded sweet-spot band
    │   ├── loadSeries.js                on-device mirror of the SAME load math (offline fallback)
    │   └── acwr.js                      on-device ACWR mirror (coach status / weekly deltas)
    └── backend_csharp_canonical_math/   the C# formulas the Python mirrors byte-for-byte
        ├── LoadCalculationBL.cs         the reference load algorithm (source of truth)
        └── LoadAnalyticsBL.cs           the analytics endpoint (C# fallback for the same series)
```

---

## Mapping to the course tasks

| Course task | Where |
|---|---|
| **Data cleaning + EDA** | Notebooks §2 (synthetic-but-realistic training histories, distributions, correlations) |
| **Feature engineering** | `features.py` + notebooks §3–§5 (daily load series, rolling ACWR, EWMA, monotony/strain) |
| **Regression (Task 1)** | `forecast.py` (per-athlete `LinearRegression` / `PolynomialFeatures`) + notebooks §7 (MAE / MSE / RMSE, residuals) |
| **Classification (Task 2)** | `risk.py` + notebooks §8 (LogReg vs RandomForest, Accuracy / Precision / Recall / F1 / ROC-AUC, confusion matrix) |
| **Clustering** | notebooks §9 (KMeans athlete archetypes) |
| **Simulation / scenario analysis** | `forecast.py :: simulate_whatif` + `TrainWise_WhatIf_Planner.ipynb` (response curves + a linear surrogate) |
| **Model export / serving** | notebooks §10 (`joblib` pickles) → `models/*.pkl` → loaded live by `app.py` |

---

## 1 · The Python ML service (`01_python_ml_service/`)

A **Flask microservice** (default `http://0.0.0.0:8000`) that reads the same SQL database the app's
C# backend uses and serves JSON the mobile app renders. File-by-file:

- **`app.py`** — the HTTP surface. Endpoints:
  - `GET /health` — liveness + DB check.
  - `GET /api/ml/trainee/<id>/pmc` — Performance-Management-Chart series (Fitness / Fatigue / Form).
  - `GET /api/ml/trainee/<id>/acwr` — the ACWR safe-zone series.
  - `GET /api/ml/trainee/<id>/analytics` — full rolling + EWMA load analytics + training summary.
  - `GET /api/ml/trainee/<id>/forecast[?month=YYYY-MM]` — the **monthly regression forecast**.
  - `GET /api/ml/trainee/<id>/forecast/history` — stored monthly snapshots.
  - `GET /api/ml/trainee/<id>/whatif?addSessions=&intensity=easy|medium|hard` — the **what-if simulator**.
  - All accept `?tzOffsetMinutes=` so sessions bucket to the athlete's local calendar day.
- **`features.py`** — the load math. Builds the per-day load series from raw `ActivityLogs`, then the
  rolling **acute (7-day sum)** and **chronic (28-day weekly-average)** loads and the ACWR, applying
  the cold-start floor + covered-days ramp. This is the shared foundation every model uses.
- **`forecast.py`** — **Task 1 (regression)** + the **what-if simulator**. The forecast fits a trend on
  the current month's completed weekly loads (naive carry → `LinearRegression` at 2 weeks →
  `PolynomialFeatures(2)` at 3+ weeks if it fits better) and projects the remaining weeks. It refines
  weekly and snapshots each month. `simulate_whatif(trainee_id, add_sessions, intensity)` injects
  `N × {easy:150, medium:300, hard:450}` load onto today and recomputes the ACWR with the same rolling
  math, returning `{baseline, simulated}` — the "plan before you train" feature.
- **`risk.py`** — **Task 2 (classification)**. Loads `models/risk_model.pkl` and predicts a
  Safe / Warning / High band, with a rule-based fallback (AC > 1.3 High, ≥ 0.8 Warning, else Safe) when
  the pickle is absent, so the service always answers.
- **`db.py`** — connection helper. **Dual-mode**: `pyodbc` + Windows Integrated Security locally
  (no password in source), auto-switching to `pymssql` + Azure SQL when the `AZURE_SQL_USER` /
  `AZURE_SQL_PASSWORD` environment variables are set. **No secret is committed** — the cloud password
  comes only from an env var.
- **`config.py`** — DB/server names (env-overridable), window sizes (7 / 28), and the load constants.
- **`auth.py`** — optional bearer-token check that mirrors the C# backend's JWT (off by default).

> The service is deliberately **decoupled** — it is a separate process from the C# API and talks to the
> app only over HTTP, exactly like a real ML microservice in production. It is currently **live on
> Azure App Service** (see `AZURE_DEPLOY.md`).

## 2 · The notebooks (`02_notebooks/`)

Three self-contained Jupyter notebooks — the gradeable data-science work. They use reproducible
**synthetic** training data so they run standalone, and the code is the **same formulas** the live
service uses (verified by parity). Each has the full pipeline: cleaning, EDA, feature engineering,
modelling, evaluation, and plots.

- **`TrainWise_Load_Analytics.ipynb`** — the fullest one: rebuilds Classic rolling ACWR and
  bias-corrected EWMA from first principles, then **regression** (predict next-week load),
  **classification** (injury in the next 7 days, with ROC-AUC + feature importance), **KMeans**
  clustering of athlete archetypes, and `joblib` model export.
- **`TrainWise_Coach_Analytics.ipynb`** — the coach forecast + risk models end-to-end; its final cells
  export `forecast_model.pkl` and `risk_model.pkl` into the service's `models/`.
- **`TrainWise_WhatIf_Planner.ipynb`** — the new **#185 what-if simulator**: rebuilds `simulate_whatif`,
  sweeps the slider to plot the **AC-ratio response curve** against the sweet-spot band per intensity,
  fits a **linear surrogate** (Task 1 link, MAE/R²), and computes each athlete's "safe headroom" (how
  many sessions before leaving the sweet spot as a function of their fitness base).

## 3 · App integration (`03_app_integration/`)

Shows the ML is a real, integrated feature — not just a notebook.

- **`frontend_react_native/`** — the mobile client. `mlApi.js` is the axios client that calls every
  endpoint; `CoachTraineeAnalyticsScreen.js` renders the PMC + ACWR charts, the monthly forecast card,
  and the **what-if planner** (a debounced intensity + slider control showing *Now → simulated* risk).
  `LoadAnalyticsSection.js` + `AcwrTrendChart.js` render the trainee's Load Trend with a Classic / EWMA
  toggle. `loadSeries.js` and `acwr.js` are **on-device mirrors of the exact same load math**, used as
  an offline fallback when the Python service is unreachable.
- **`backend_csharp_canonical_math/`** — `LoadCalculationBL.cs` is the **reference implementation** of
  the load algorithm; `features.py` and the JavaScript mirrors are kept byte-for-byte identical to it
  (the app, the ML service, and the notebooks therefore all agree on every number). `LoadAnalyticsBL.cs`
  is the C# fallback that serves the same series when the Python service is off.

---

## How to run the ML service

```bash
cd 01_python_ml_service
python -m venv venv
venv\Scripts\activate          # Windows   (source venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
python app.py                  # serves http://0.0.0.0:8000
```

Requires **ODBC Driver 17/18 for SQL Server** and the `TrainWise` SQL database. Quick check:

```bash
curl http://localhost:8000/health
curl "http://localhost:8000/api/ml/trainee/1/forecast"
curl "http://localhost:8000/api/ml/trainee/1/whatif?addSessions=3&intensity=hard"
```

The notebooks run with just `pip install pandas numpy scikit-learn matplotlib seaborn jupyter` — they
need no database (they generate their own synthetic data).

> **Security note:** no credentials are in any file here. The local DB uses Windows Integrated Security
> (no password); the Azure path reads the password only from an environment variable.

# TrainWise — Coach Analytics + Forecast ML service

Python (Flask) microservice that powers the coach-side analytics screen:
the **PMC** chart (Fitness / Fatigue / Form), the **ACWR safe-zone** chart, and
the **monthly training forecast** ("if this trainee keeps training like this,
what AC ratio + acute load will they hit?"). It reads the same SQL Express
database the C# backend uses and mirrors the C# load formula exactly, so the
numbers line up with the app.

Built with the same libraries as the `Python Course ML/` lessons: pandas,
scikit-learn, matplotlib/seaborn, numpy.

## Layout

```
ml/
  app.py           Flask endpoints (the thing the coach screen calls)
  config.py        DB name/server (env-overridable), port, load constants
  db.py            pyodbc helper (Windows Integrated Security, no password)
  features.py      load math (acute 7d / chronic 28d/4 / AC ratio) + PMC/ACWR series
  forecast.py      monthly regression forecast + snapshot read/write
  risk.py          Safe/Warning/High classifier (pickle, rule fallback)
  models/          notebook-exported forecast_model.pkl / risk_model.pkl
  notebook/        TrainWise_Coach_Analytics.ipynb (gradeable ML writeup)
  requirements.txt
```

## Prerequisites

- Python 3.10+.
- **ODBC Driver 18 (or 17) for SQL Server** — ships with SSMS; the helper
  auto-detects whichever is installed.
- SQL Express running with the `TrainWise` DB, and the
  `sql/2026-06-12_add_forecasts.sql` migration applied (creates
  `MonthlyForecasts`).

## Run

```powershell
cd ml
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py            # serves on http://0.0.0.0:8000
```

If the SQL instance name differs from `Lirone\SQLEXPRESS`:
```powershell
$env:TRAINWISE_SQL_SERVER = "YOURPC\SQLEXPRESS"
python app.py
```

### Firewall (one-time, so the phone can reach it over WiFi)
Administrator PowerShell:
```powershell
New-NetFirewallRule -DisplayName "TrainWise ML 8000" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow -Profile Private
```
The active WiFi network must be **Private** (same requirement as the C# API on
5249). The app's `ML_BASE_URL` (in `TrainWiseExpo/src/services/mlApi.js`) must
point at the PC's current LAN IP, exactly like the C# `BASE_URL` (the IP shifts
on DHCP renewal).

## Quick check

```powershell
curl http://localhost:8000/health
curl http://localhost:8000/api/ml/trainee/1/forecast
curl http://localhost:8000/api/ml/trainee/1/pmc
curl http://localhost:8000/api/ml/trainee/1/acwr
```

## Notebook

`notebook/TrainWise_Coach_Analytics.ipynb` is the gradeable ML deliverable
(data cleaning, EDA, regression with MAE/MSE/RMSE, classification with
Accuracy/Precision/Recall/F1 + ROC/AUC, KMeans clustering, matplotlib/seaborn
PMC + ACWR plots). Its final cells export `forecast_model.pkl` and
`risk_model.pkl` into `models/`, which `app.py` then loads. The service works
without them (per-trainee regression + rule-based risk), so run the notebook
when you want the global trained model in the loop.

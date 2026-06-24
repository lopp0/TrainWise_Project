"""
Central configuration for the TrainWise ML service.

Nothing here is a secret: the database uses Windows Integrated Security
(Trusted_Connection), so there is no password in source. The SQL server name
can be overridden with the TRAINWISE_SQL_SERVER env var (handy if the instance
name differs on another machine).
"""
import os

# ---- Database (local SQL Express, same DB the C# backend uses) -------------
SQL_SERVER = os.environ.get("TRAINWISE_SQL_SERVER", r"Lirone\SQLEXPRESS")
SQL_DATABASE = os.environ.get("TRAINWISE_SQL_DATABASE", "TrainWise")

# ---- HTTP service ----------------------------------------------------------
HOST = "0.0.0.0"          # bind on all interfaces so the phone can reach it over the LAN
PORT = int(os.environ.get("TRAINWISE_ML_PORT", "8000"))

# ---- Model artifacts (exported by the notebook) ----------------------------
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
FORECAST_MODEL_PATH = os.path.join(MODELS_DIR, "forecast_model.pkl")
RISK_MODEL_PATH = os.path.join(MODELS_DIR, "risk_model.pkl")

# ---- Load algorithm constants (mirror LoadCalculationBL.cs / LoadParameters) ----
# Acute  = sum of session loads over the last 7 days.
# Chronic = sum of session loads over the last 28 days, divided by 4
#           (weekly-equivalent), so the AC ratio lives on a comparable scale.
ACUTE_WINDOW_DAYS = 7
CHRONIC_WINDOW_DAYS = 28
CHRONIC_DIVISOR = 4.0

# AC-ratio status thresholds (strict, matching DetermineLoadLevel in C#):
#   Green  : ratio < 0.8
#   Yellow : 0.8 <= ratio <= 1.3
#   Red    : ratio > 1.3
AC_GREEN_MAX = 0.8
AC_YELLOW_MAX = 1.3
AC_DANGER = 1.5   # the >1.5 "overload" line shown on the ACWR chart

# Experience-based bootstrap acute load (LoadParameters seed: Beginner/Regular/
# Advance acute = 150/280/420). Used as a chronic floor before a real baseline
# exists, so a brand-new trainee is not flagged at a fixed ratio of 4.0.
BOOTSTRAP_ACUTE = {1: 150.0, 2: 280.0, 3: 420.0}
DEFAULT_EXPERIENCE = 1

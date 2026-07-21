"""
Database helper for the TrainWise ML service.

DUAL MODE (2026-07-20):
  * LOCAL  (default): pyodbc + Windows Integrated Security against SQL Express.
                      Unchanged from before — no password in source.
  * AZURE  (when AZURE_SQL_USER + AZURE_SQL_PASSWORD env vars are set):
                      pymssql + SQL authentication against Azure SQL.

Why pymssql for Azure and not pyodbc: Azure App Service (Linux) does NOT ship the
Microsoft ODBC driver, and installing it in the sandbox is fragile. pymssql is a
pure `pip install` (its wheels bundle FreeTDS), so it "just works" on the Linux
container. Locally we keep pyodbc because Windows Integrated Security is the
zero-password convenience the dev setup relies on.

Exposes (unchanged):
    query_df(sql, params)   -> pandas.DataFrame
    execute(sql, params)    -> int (rows affected)
    ping()                  -> bool
"""
import os
import pandas as pd

import config

# ── Mode selection ──────────────────────────────────────────────────────────
# Azure mode is entered ONLY when both SQL-login credentials are present, so a
# machine without them behaves exactly as it always did (local pyodbc path).
_AZURE_USER = os.environ.get("AZURE_SQL_USER")
_AZURE_PASSWORD = os.environ.get("AZURE_SQL_PASSWORD")
USE_AZURE = bool(_AZURE_USER and _AZURE_PASSWORD)

# Import the driver lazily so LOCAL runs never need pymssql installed, and the
# AZURE container never needs the ODBC driver. (pymssql/gunicorn are marked
# linux-only in requirements.txt, so they aren't even installed on Windows.)
if USE_AZURE:
    import pymssql  # noqa: F401  (Linux/Azure only)
else:
    import pyodbc


# ── Local (pyodbc / Windows auth) — UNCHANGED ───────────────────────────────
def _find_driver():
    """Pick the newest installed SQL Server ODBC driver (18, then 17, then the
    legacy 'SQL Server'). Driver 18 defaults to Encrypt=yes, so we always pass
    Encrypt=no + TrustServerCertificate=yes below for a local instance."""
    drivers = [d for d in pyodbc.drivers() if "SQL Server" in d]
    for preferred in ("ODBC Driver 18 for SQL Server",
                      "ODBC Driver 17 for SQL Server",
                      "SQL Server Native Client 11.0",
                      "SQL Server"):
        if preferred in drivers:
            return preferred
    if drivers:
        return drivers[0]
    raise RuntimeError(
        "No SQL Server ODBC driver found. Install 'ODBC Driver 18 for SQL Server' "
        "(it ships with SSMS)."
    )


def _local_connection_string():
    return (
        f"DRIVER={{{_find_driver()}}};"
        f"SERVER={config.SQL_SERVER};"
        f"DATABASE={config.SQL_DATABASE};"
        "Trusted_Connection=yes;"
        "Encrypt=no;"
        "TrustServerCertificate=yes;"
    )


# ── Azure (pymssql / SQL auth) ──────────────────────────────────────────────
def _azure_user():
    """Azure SQL sometimes wants the 'user@servershortname' form. If the caller
    already used '@' we respect it; otherwise we pass the plain user (modern
    pymssql/TDS 7.x accepts it). If a login ever fails on Azure, set
    AZURE_SQL_USER to 'TrainWiseAdmin@trainwiseadmin' explicitly."""
    return _AZURE_USER


def get_connection():
    if USE_AZURE:
        # Azure SQL over pymssql (SQL authentication). login_timeout is generous
        # because a serverless / auto-paused DB can take ~30s to wake on the
        # first connection after idle.
        return pymssql.connect(
            server=config.SQL_SERVER,       # e.g. trainwiseadmin.database.windows.net
            user=_azure_user(),
            password=_AZURE_PASSWORD,
            database=config.SQL_DATABASE,   # e.g. TrainWiseDB
            port=1433,
            login_timeout=30,
            timeout=60,
        )
    return pyodbc.connect(_local_connection_string(), timeout=5)


def _prep(sql):
    """pyodbc uses '?' placeholders; pymssql uses '%s'. Our SQL is entirely
    internal and contains no literal '?' inside string data, so a straight swap
    is safe. No-op on the local path."""
    return sql.replace("?", "%s") if USE_AZURE else sql


# ── Public API (driver-agnostic) ────────────────────────────────────────────
def query_df(sql, params=None):
    """Run a SELECT and return a DataFrame (empty DataFrame on no rows)."""
    conn = get_connection()
    try:
        return pd.read_sql(_prep(sql), conn, params=params or [])
    finally:
        conn.close()


def execute(sql, params=None):
    """Run an INSERT/UPDATE/DELETE; return rows affected."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(_prep(sql), params or [])
        affected = cur.rowcount
        conn.commit()
        return affected
    finally:
        conn.close()


def ping():
    """True if the database is reachable (used by /health)."""
    try:
        conn = get_connection()
        try:
            conn.cursor().execute("SELECT 1")
        finally:
            conn.close()
        return True
    except Exception:
        return False

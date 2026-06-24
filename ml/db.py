"""
Thin pyodbc helper around the local SQL Express database.

Exposes:
    query_df(sql, params)   -> pandas.DataFrame
    execute(sql, params)    -> int (rows affected)

Both open a short-lived connection. Volume here is tiny (one trainee at a
time), so connection pooling is not worth the complexity.
"""
import struct
import pyodbc
import pandas as pd

import config


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


def _connection_string():
    return (
        f"DRIVER={{{_find_driver()}}};"
        f"SERVER={config.SQL_SERVER};"
        f"DATABASE={config.SQL_DATABASE};"
        "Trusted_Connection=yes;"
        "Encrypt=no;"
        "TrustServerCertificate=yes;"
    )


def get_connection():
    return pyodbc.connect(_connection_string(), timeout=5)


def query_df(sql, params=None):
    """Run a SELECT and return a DataFrame (empty DataFrame on no rows)."""
    with get_connection() as conn:
        return pd.read_sql(sql, conn, params=params or [])


def execute(sql, params=None):
    """Run an INSERT/UPDATE/DELETE; return rows affected."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, params or [])
        affected = cur.rowcount
        conn.commit()
        return affected


def ping():
    """True if the database is reachable (used by /health)."""
    try:
        with get_connection() as conn:
            conn.cursor().execute("SELECT 1")
        return True
    except Exception:
        return False

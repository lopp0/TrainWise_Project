"""
Feature engineering for the coach analytics + forecast.

Everything load-related mirrors the C# LoadCalculationBL so the numbers the
coach sees here line up with what the trainee sees in the app:
    acute   = sum of session loads over the last 7 days
    chronic = sum of session loads over the last 28 days / 4 (weekly-equivalent)
    ratio   = acute / chronic
We recompute the daily series straight from ActivityLogs (not the stored
DailyLoad rows) so the charts never depend on stale snapshots.
"""
from datetime import date, timedelta

import numpy as np
import pandas as pd

import config
import db


# --------------------------------------------------------------------------
# Raw pulls
# --------------------------------------------------------------------------
def get_trainee_logs(trainee_id, since: date):
    """Confirmed ActivityLogs for a trainee since `since` (inclusive).
    Pending rows (IsConfirmed = 0) are excluded; NULL counts as confirmed,
    matching the app's `(isConfirmed ?? IsConfirmed) === false` skip rule."""
    sql = (
        "SELECT StartTime, Duration, ExertionLevel, CalculatedLoadForSession, "
        "       ActivityTypeID, DistanceKM, AvgHeartRate, IsConfirmed "
        "FROM ActivityLogs "
        "WHERE UserID = ? AND StartTime >= ? "
        "      AND (IsConfirmed = 1 OR IsConfirmed IS NULL) "
        "ORDER BY StartTime ASC"
    )
    df = db.query_df(sql, [trainee_id, since])
    if not df.empty:
        df["StartTime"] = pd.to_datetime(df["StartTime"])
        df["CalculatedLoadForSession"] = pd.to_numeric(
            df["CalculatedLoadForSession"], errors="coerce"
        ).fillna(0.0)
    return df


def get_user(trainee_id):
    sql = (
        "SELECT UserID, FullName, BirthYear, Gender, Height, Weight, "
        "       ActivityLevel, ExperienceLevel, IsBaselineEstablished "
        "FROM Users WHERE UserID = ?"
    )
    df = db.query_df(sql, [trainee_id])
    if df.empty:
        return None
    row = df.iloc[0].to_dict()
    row["ExperienceLevel"] = int(row.get("ExperienceLevel") or config.DEFAULT_EXPERIENCE)
    row["IsBaselineEstablished"] = bool(row.get("IsBaselineEstablished"))
    return row


def get_injuries(trainee_id):
    sql = (
        "SELECT Date, Severity, IsActiveInjury, InjuryTypeID "
        "FROM InjuriesReports WHERE UserID = ? ORDER BY Date DESC"
    )
    return db.query_df(sql, [trainee_id])


# --------------------------------------------------------------------------
# Load series
# --------------------------------------------------------------------------
def daily_load_series(logs, start: date, end: date) -> pd.Series:
    """Per-day summed session load over [start, end], zero-filled."""
    idx = pd.date_range(start, end, freq="D")
    if logs is None or logs.empty:
        return pd.Series(0.0, index=idx)
    s = logs.copy()
    s["day"] = s["StartTime"].dt.normalize()
    daily = s.groupby("day")["CalculatedLoadForSession"].sum()
    return daily.reindex(idx, fill_value=0.0).astype(float)


def rolling_loads(daily: pd.Series, experience_level=1, baseline_established=True) -> pd.DataFrame:
    """From a daily load series, compute the rolling acute / chronic / AC ratio
    per day, applying the same cold-start chronic floor the app uses."""
    acute = daily.rolling(config.ACUTE_WINDOW_DAYS, min_periods=1).sum()
    chronic = daily.rolling(config.CHRONIC_WINDOW_DAYS, min_periods=1).sum() / config.CHRONIC_DIVISOR

    if not baseline_established:
        bootstrap = config.BOOTSTRAP_ACUTE.get(experience_level, config.BOOTSTRAP_ACUTE[1])
        chronic = chronic.clip(lower=bootstrap)

    ratio = np.where(chronic > 0, acute / chronic, np.nan)
    return pd.DataFrame(
        {"acute": acute, "chronic": chronic, "ac_ratio": ratio}, index=daily.index
    )


def level_for(ratio):
    """Green / Yellow / Red from an AC ratio (None -> Green, like the app)."""
    if ratio is None or (isinstance(ratio, float) and np.isnan(ratio)):
        return "Green"
    if ratio > config.AC_YELLOW_MAX:
        return "Red"
    if ratio >= config.AC_GREEN_MAX:
        return "Yellow"
    return "Green"


# --------------------------------------------------------------------------
# Chart series (consumed by /pmc and /acwr)
# --------------------------------------------------------------------------
def _loads_window(trainee_id, days):
    """Shared helper: build the rolling-load DataFrame for the last `days`
    days (fetching an extra chronic window of history so day 1 is accurate)."""
    user = get_user(trainee_id)
    if user is None:
        return None, None
    end = date.today()
    start = end - timedelta(days=days - 1)
    fetch_since = start - timedelta(days=config.CHRONIC_WINDOW_DAYS)
    logs = get_trainee_logs(trainee_id, fetch_since)
    daily = daily_load_series(logs, fetch_since, end)
    rolled = rolling_loads(
        daily, user["ExperienceLevel"], user["IsBaselineEstablished"]
    )
    # Trim back to the requested display window.
    rolled = rolled.loc[pd.Timestamp(start):]
    return rolled, user


def pmc_series(trainee_id, days=42):
    """Performance Manager Chart data: Fitness (chronic), Fatigue (acute),
    Form (chronic - acute) per day."""
    rolled, _ = _loads_window(trainee_id, days)
    if rolled is None:
        return []
    out = []
    for ts, r in rolled.iterrows():
        out.append({
            "date": ts.strftime("%Y-%m-%d"),
            "fitness": round(float(r["chronic"]), 1),
            "fatigue": round(float(r["acute"]), 1),
            "form": round(float(r["chronic"] - r["acute"]), 1),
        })
    return out


def acwr_series(trainee_id, days=28):
    """AC-ratio line + the safe-zone thresholds for the ACWR chart."""
    rolled, _ = _loads_window(trainee_id, days)
    series = []
    if rolled is not None:
        for ts, r in rolled.iterrows():
            ratio = None if pd.isna(r["ac_ratio"]) else round(float(r["ac_ratio"]), 2)
            series.append({
                "date": ts.strftime("%Y-%m-%d"),
                "acRatio": ratio,
                "level": level_for(ratio),
            })
    return {
        "series": series,
        "safeLow": config.AC_GREEN_MAX,
        "safeHigh": config.AC_YELLOW_MAX,
        "danger": config.AC_DANGER,
    }


# --------------------------------------------------------------------------
# Monthly weekly buckets (for the forecast regression)
# --------------------------------------------------------------------------
def month_bounds(month_key: str):
    """('YYYY-MM') -> (first_day, last_day) as date objects."""
    year, mon = int(month_key[:4]), int(month_key[5:7])
    first = date(year, mon, 1)
    if mon == 12:
        last = date(year, 12, 31)
    else:
        last = date(year, mon + 1, 1) - timedelta(days=1)
    return first, last


def weekly_buckets(logs, month_start: date, month_end: date):
    """Aggregate session load into the month's fixed weeks: days 1-7, 8-14,
    15-21, 22-28, 29-end. Returns a DataFrame [week, start, end, load,
    workouts]. `week` is 1-based."""
    rows = []
    week = 1
    bucket_start = month_start
    while bucket_start <= month_end:
        bucket_end = min(bucket_start + timedelta(days=6), month_end)
        if logs is None or logs.empty:
            load, n = 0.0, 0
        else:
            mask = (logs["StartTime"].dt.date >= bucket_start) & (
                logs["StartTime"].dt.date <= bucket_end
            )
            chunk = logs.loc[mask]
            load = float(chunk["CalculatedLoadForSession"].sum())
            n = int(len(chunk))
        rows.append({
            "week": week, "start": bucket_start, "end": bucket_end,
            "load": load, "workouts": n,
        })
        week += 1
        bucket_start = bucket_end + timedelta(days=1)
    return pd.DataFrame(rows)

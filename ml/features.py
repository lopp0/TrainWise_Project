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
def get_trainee_logs(trainee_id, since: date, tz_offset_minutes: int = 0):
    """Confirmed ActivityLogs for a trainee since `since` (inclusive).
    Pending rows (IsConfirmed = 0) are excluded; NULL counts as confirmed,
    matching the app's `(isConfirmed ?? IsConfirmed) === false` skip rule.

    StartTime is stored as a UTC instant; `tz_offset_minutes` (the phone's
    UTC offset, e.g. Israel DST = 180) shifts it so day-bucketing matches the
    user's local calendar — without it a 00:30 local workout lands on the
    previous day. The fetch window is widened a day so the shift can't drop
    boundary rows."""
    tz = max(-14 * 60, min(14 * 60, int(tz_offset_minutes or 0)))
    sql = (
        "SELECT StartTime, Duration, ExertionLevel, CalculatedLoadForSession, "
        "       ActivityTypeID, DistanceKM, AvgHeartRate, IsConfirmed "
        "FROM ActivityLogs "
        "WHERE UserID = ? AND StartTime >= ? "
        "      AND (IsConfirmed = 1 OR IsConfirmed IS NULL) "
        "ORDER BY StartTime ASC"
    )
    df = db.query_df(sql, [trainee_id, since - timedelta(days=1)])
    if not df.empty:
        df["StartTime"] = pd.to_datetime(df["StartTime"]) + pd.Timedelta(minutes=tz)
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


def count_active_injuries(trainee_id) -> int:
    inj = get_injuries(trainee_id)
    if inj.empty or "IsActiveInjury" not in inj.columns:
        return 0
    return int(inj["IsActiveInjury"].fillna(0).astype(bool).sum())


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


def rolling_loads(daily: pd.Series, experience_level=1, baseline_established=None) -> pd.DataFrame:
    """From a daily load series, compute the rolling acute / chronic / AC ratio
    per day. Mirrors C# LoadCalculationBL.EffectiveChronic exactly:

      < 7 active (load > 0) days in the trailing 28: cold-start / layoff —
        chronic = max(sum28 / 4, experience bootstrap). Dynamic per day, NOT
        the one-shot Users.IsBaselineEstablished flag (which never resets, so
        a returning-from-layoff athlete read a false Red here while the app
        screens showed Green).

      >= 7 active days: covered-days ramp — chronic = sum28 / min(4, covered/7)
        where covered runs from the first loaded day inside the window. The
        fixed /4 assumed a full 28-day history and flagged a steady 2-week-old
        user at ratio 2.0; full histories are unchanged (covered=28 -> /4).

    `baseline_established` is kept for signature compatibility and ignored."""
    acute = daily.rolling(config.ACUTE_WINDOW_DAYS, min_periods=1).sum()
    sum28 = daily.rolling(config.CHRONIC_WINDOW_DAYS, min_periods=1).sum()
    bootstrap = config.BOOTSTRAP_ACUTE.get(experience_level, config.BOOTSTRAP_ACUTE[1])

    vals = daily.to_numpy(dtype=float)
    n = len(vals)
    s28 = sum28.to_numpy(dtype=float)
    active = (
        pd.Series(vals > 0, index=daily.index)
        .rolling(config.CHRONIC_WINDOW_DAYS, min_periods=1).sum().to_numpy()
    )

    floored = np.maximum(s28 / config.CHRONIC_DIVISOR, bootstrap)
    nz = np.flatnonzero(vals > 0)
    if nz.size:
        idx = np.arange(n)
        j = np.searchsorted(nz, idx - (config.CHRONIC_WINDOW_DAYS - 1), side="left")
        first = nz[np.minimum(j, nz.size - 1)]
        covered = np.maximum(idx - first + 1, 7)  # >=7 wherever the ramp applies
        ramped = s28 / np.minimum(config.CHRONIC_DIVISOR, covered / 7.0)
        chronic_vals = np.where(active >= 7, ramped, floored)
    else:
        chronic_vals = floored

    chronic = pd.Series(chronic_vals, index=daily.index)
    ratio = np.where(chronic_vals > 0, acute.to_numpy() / chronic_vals, np.nan)
    return pd.DataFrame(
        {"acute": acute, "chronic": chronic, "ac_ratio": ratio}, index=daily.index
    )


def level_for(ratio, has_active_injury=False):
    """Green / Yellow / Red from an AC ratio (None -> Green, like the app).
    Injured users get the same tighter bands as C# DetermineLoadLevel:
    Red >= 1.2, Yellow 0.8..<1.2, Green below."""
    if ratio is None or (isinstance(ratio, float) and np.isnan(ratio)):
        return "Green"
    if has_active_injury:
        if ratio >= 1.2:
            return "Red"
        if ratio >= config.AC_GREEN_MAX:
            return "Yellow"
        return "Green"
    if ratio > config.AC_YELLOW_MAX:
        return "Red"
    if ratio >= config.AC_GREEN_MAX:
        return "Yellow"
    return "Green"


# --------------------------------------------------------------------------
# Chart series (consumed by /pmc and /acwr)
# --------------------------------------------------------------------------
def _loads_window(trainee_id, days, tz_offset_minutes=0):
    """Shared helper: build the rolling-load DataFrame for the last `days`
    days (fetching an extra chronic window of history so day 1 is accurate)."""
    user = get_user(trainee_id)
    if user is None:
        return None, None
    end = date.today()
    start = end - timedelta(days=days - 1)
    fetch_since = start - timedelta(days=config.CHRONIC_WINDOW_DAYS)
    logs = get_trainee_logs(trainee_id, fetch_since, tz_offset_minutes)
    daily = daily_load_series(logs, fetch_since, end)
    rolled = rolling_loads(daily, user["ExperienceLevel"])
    # Trim back to the requested display window.
    rolled = rolled.loc[pd.Timestamp(start):]
    return rolled, user


def pmc_series(trainee_id, days=42, tz_offset_minutes=0):
    """Performance Manager Chart data: Fitness (chronic), Fatigue (acute),
    Form (chronic - acute) per day."""
    rolled, _ = _loads_window(trainee_id, days, tz_offset_minutes)
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


def acwr_series(trainee_id, days=28, tz_offset_minutes=0):
    """AC-ratio line + the safe-zone thresholds for the ACWR chart."""
    rolled, _ = _loads_window(trainee_id, days, tz_offset_minutes)
    series = []
    if rolled is not None:
        injured = count_active_injuries(trainee_id) > 0
        for ts, r in rolled.iterrows():
            raw = None if pd.isna(r["ac_ratio"]) else float(r["ac_ratio"])
            series.append({
                "date": ts.strftime("%Y-%m-%d"),
                "acRatio": None if raw is None else round(raw, 2),
                # Level from the UNROUNDED ratio: 1.3049 is Red, but rounds
                # to a displayed 1.30 (which would wrongly grade Yellow).
                "level": level_for(raw, injured),
            })
    return {
        "series": series,
        "safeLow": config.AC_GREEN_MAX,
        "safeHigh": config.AC_YELLOW_MAX,
        "danger": config.AC_DANGER,
    }


# --------------------------------------------------------------------------
# EWMA load series + full analytics (consumed by /analytics)
# --------------------------------------------------------------------------
# EWMA smoothing constants, mirroring utils/loadSeries.js (Williams 2017):
#   lambda = 2 / (N + 1)  ->  acute N=7 => 0.25 ; chronic N=28 => ~0.069
LAMBDA_ACUTE = 2.0 / (config.ACUTE_WINDOW_DAYS + 1)      # 0.25
LAMBDA_CHRONIC = 2.0 / (config.CHRONIC_WINDOW_DAYS + 1)  # ~0.069
WARMUP_DAYS = 56  # history fetched before the display window so EWMA/rolling are warm


def ewma_loads(daily: pd.Series, experience_level=1) -> pd.DataFrame:
    """Bias-corrected EWMA acute / chronic / AC ratio per day, mirroring
    utils/loadSeries.js exactly.

    A zero-seeded EWMA understates the chronic average early on, which INFLATES
    the ratio — a brand-new user's first workout would falsely read Red. We divide
    by (1 - (1 - lambda)^t) to remove that zero-initialization bias (the Adam
    correction, Kingma & Ba 2015); `t` counts days from the FIRST logged session.
    Pre-baseline the EWMA chronic is floored at the experience bootstrap / 7
    (daily scale, because EWMA lives on a per-day scale)."""
    bootstrap = config.BOOTSTRAP_ACUTE.get(experience_level, config.BOOTSTRAP_ACUTE[1])
    bootstrap_daily = bootstrap / 7.0

    vals = daily.to_numpy(dtype=float)
    idx = daily.index
    nz = np.flatnonzero(vals > 0)
    first = int(nz[0]) if nz.size else None

    # >= 7 active (load > 0) days in the trailing 28 => baseline established.
    active28 = (
        pd.Series(vals > 0, index=idx)
        .rolling(config.CHRONIC_WINDOW_DAYS, min_periods=1).sum().to_numpy()
    )

    n = len(vals)
    a_out = np.full(n, np.nan)
    c_out = np.full(n, np.nan)
    r_out = np.full(n, np.nan)
    ewma_a = ewma_c = 0.0
    t = 0
    for i in range(n):
        load = vals[i]
        if first is not None and i >= first:
            t += 1
            ewma_a = load * LAMBDA_ACUTE + (1 - LAMBDA_ACUTE) * ewma_a
            ewma_c = load * LAMBDA_CHRONIC + (1 - LAMBDA_CHRONIC) * ewma_c
        if t > 0:
            a_corr = ewma_a / (1 - (1 - LAMBDA_ACUTE) ** t)
            c_corr = ewma_c / (1 - (1 - LAMBDA_CHRONIC) ** t)
            eff_c = c_corr if active28[i] >= 7 else max(c_corr, bootstrap_daily)
            a_out[i] = a_corr
            c_out[i] = eff_c
            r_out[i] = (a_corr / eff_c) if eff_c > 0 else np.nan
    return pd.DataFrame(
        {"ewma_acute": a_out, "ewma_chronic": c_out, "ewma_ratio": r_out}, index=idx
    )


def _training_summary(daily: pd.Series, logs, end: date) -> dict:
    """Foster monotony/strain over the last 7 days + duration-weighted intensity
    mix (RPE buckets) over the last 28 days + active/rest day counts. Mirrors the
    summary block of utils/loadSeries.js."""
    last7 = daily.loc[pd.Timestamp(end) - pd.Timedelta(days=6):pd.Timestamp(end)]
    last7 = last7.reindex(pd.date_range(end - timedelta(days=6), end, freq="D"), fill_value=0.0)
    mean = float(last7.mean())
    stdev = float(last7.std(ddof=0))  # population stdev, matching the JS mirror
    weekly = float(last7.sum())
    monotony = (mean / stdev) if stdev > 0 else (5.0 if mean > 0 else 0.0)
    monotony = min(monotony, 5.0)

    low = mod = high = 0.0
    cutoff = end - timedelta(days=27)
    if logs is not None and not logs.empty and "ExertionLevel" in logs.columns:
        m = (logs["StartTime"].dt.date >= cutoff) & (logs["StartTime"].dt.date <= end)
        chunk = logs.loc[m]
        for _, s in chunk.iterrows():
            minutes = max(float(s.get("Duration") or 0.0), 0.0)
            rpe = float(s.get("ExertionLevel") or 0.0)
            if rpe <= 3:
                low += minutes
            elif rpe <= 6:
                mod += minutes
            else:
                high += minutes
    total = low + mod + high

    active28 = int((daily.loc[pd.Timestamp(end) - pd.Timedelta(days=27):pd.Timestamp(end)] > 0).sum())
    rest7 = int((last7 <= 0).sum())
    return {
        "monotony": round(monotony, 2),
        "strain": round(weekly * monotony),
        "lowPct": round(low / total * 1000) / 10 if total > 0 else 0,
        "moderatePct": round(mod / total * 1000) / 10 if total > 0 else 0,
        "highPct": round(high / total * 1000) / 10 if total > 0 else 0,
        "activeDays28": active28,
        "restDays7": rest7,
    }


def analytics_series(trainee_id, days=56, tz_offset_minutes=0):
    """Full load-analytics payload for the trainee Load tab + coach detail. Same
    JSON shape (and same numbers) as the C# LoadAnalyticsBL and the on-device
    mirror utils/loadSeries.js: per-day rolling AND bias-corrected EWMA AC ratio
    + a training-analysis summary."""
    user = get_user(trainee_id)
    if user is None:
        return {"series": [], "summary": {}, "safeLow": config.AC_GREEN_MAX,
                "safeHigh": config.AC_YELLOW_MAX, "overload": config.AC_DANGER,
                "baselineEstablished": False, "hasActiveInjury": False}
    exp = user["ExperienceLevel"]
    injured = count_active_injuries(trainee_id) > 0

    end = date.today()
    start = end - timedelta(days=days - 1)
    fetch_since = start - timedelta(days=WARMUP_DAYS)
    logs = get_trainee_logs(trainee_id, fetch_since, tz_offset_minutes)
    daily = daily_load_series(logs, fetch_since, end)

    rolled = rolling_loads(daily, exp)
    ewma = ewma_loads(daily, exp)

    disp_idx = pd.date_range(start, end, freq="D")
    series = []
    for ts in disp_idx:
        rr = rolled.loc[ts]
        ee = ewma.loc[ts]
        roll_ratio = None if pd.isna(rr["ac_ratio"]) else float(rr["ac_ratio"])
        ew_ratio = None if pd.isna(ee["ewma_ratio"]) else float(ee["ewma_ratio"])
        series.append({
            "date": ts.strftime("%Y-%m-%d"),
            "dailyLoad": round(float(daily.loc[ts])),
            "rollingAcute": round(float(rr["acute"])),
            "rollingChronic": round(float(rr["chronic"]), 1),
            "rollingRatio": None if roll_ratio is None else round(roll_ratio, 4),
            "rollingLevel": level_for(roll_ratio, injured),
            "ewmaAcute": 0 if pd.isna(ee["ewma_acute"]) else round(float(ee["ewma_acute"]), 1),
            "ewmaChronic": 0 if pd.isna(ee["ewma_chronic"]) else round(float(ee["ewma_chronic"]), 1),
            "ewmaRatio": None if ew_ratio is None else round(ew_ratio, 4),
            "ewmaLevel": level_for(ew_ratio, injured),
        })

    active28_end = int((daily.loc[pd.Timestamp(end) - pd.Timedelta(days=27):pd.Timestamp(end)] > 0).sum())
    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "safeLow": config.AC_GREEN_MAX,
        "safeHigh": config.AC_YELLOW_MAX,
        "overload": config.AC_DANGER,
        "baselineEstablished": active28_end >= 7,
        "hasActiveInjury": injured,
        "series": series,
        "summary": _training_summary(daily, logs, end),
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

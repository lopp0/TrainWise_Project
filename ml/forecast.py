"""
Monthly training forecast (PDF Task 1, Regression).

Per-trainee logic (the live "if they keep training like this" projection):
  * Split the calendar month into fixed weeks (days 1-7, 8-14, ...).
  * Fit a regression on the COMPLETED weeks' total load:
        0 / 1 completed week -> naive carry-forward
        2 completed weeks    -> LinearRegression
        3+ completed weeks    -> Linear, upgraded to Polynomial(2) only if it
                                 clearly fits better (guards against wild
                                 extrapolation). More weeks => higher confidence.
  * Project the remaining weeks -> projected acute load + AC ratio + risk.
  * Each call for the CURRENT month appends a snapshot to MonthlyForecasts, so a
    month accrues a history that refines weekly; a new month starts fresh and
    old months stay readable.

A second, global model (trained in the notebook, exported to
models/forecast_model.pkl) is loaded when present and returned alongside the
per-trainee projection. If it is missing, only the per-trainee path is used.
"""
import os
import json
from datetime import date, timedelta

import numpy as np
import pandas as pd
import joblib
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from sklearn.pipeline import make_pipeline

import config
import db
import features
import risk

MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June",
               "July", "August", "September", "October", "November", "December"]

# Column order the global forecast model is trained on (see the notebook).
GLOBAL_FEATURES = ["acute", "chronic", "ac_ratio", "experience", "age",
                   "avg_weekly_load", "weeks_elapsed"]

_global_model = None
_global_attempted = False


def _current_month_key():
    t = date.today()
    return f"{t.year:04d}-{t.month:02d}"


def _load_global_model():
    global _global_model, _global_attempted
    if _global_attempted:
        return _global_model
    _global_attempted = True
    try:
        if os.path.exists(config.FORECAST_MODEL_PATH):
            _global_model = joblib.load(config.FORECAST_MODEL_PATH)
    except Exception as exc:
        print(f"[forecast] could not load global model: {exc}")
        _global_model = None
    return _global_model


# --------------------------------------------------------------------------
# Per-trainee regression + forward simulation
# --------------------------------------------------------------------------
def _predict_weekly_loads(weeks_df, as_of, current_acute):
    """Fit the load trend on the month's COMPLETED weeks and return a
    {week: predicted weekly load} dict for the remaining weeks.

        2+ completed weeks -> LinearRegression (Polynomial(2) if it fits clearly
                              better), so the projection follows the month's trend.
        <2 completed weeks -> 'recent pace': project the trainee's CURRENT 7-day
                              acute load forward. This is the literal reading of
                              "if they keep training like this" and means a heavy
                              ongoing (still-incomplete) week is no longer ignored
                              just because the month's first week was light."""
    completed = weeks_df[weeks_df["end"].apply(lambda d: d <= as_of)]
    future = weeks_df[weeks_df["end"].apply(lambda d: d > as_of)]
    n = len(completed)

    if n >= 2:
        X = completed["week"].to_numpy(dtype=float).reshape(-1, 1)
        y = completed["load"].to_numpy(dtype=float)
        lin = LinearRegression().fit(X, y)
        best, model_type, r2 = lin, "linear", float(lin.score(X, y))
        if n >= 3:
            poly = make_pipeline(PolynomialFeatures(2), LinearRegression()).fit(X, y)
            r2_poly = float(poly.score(X, y))
            if r2_poly > r2 + 0.05:   # upgrade only on a clear improvement
                best, model_type, r2 = poly, "poly2", r2_poly
        predict = lambda w: max(0.0, float(best.predict(np.array([[w]], dtype=float))[0]))
        confidence = round(min(1.0, n / 4.0), 2)
    else:
        # Too little of the month is complete to fit a trend, so project the
        # current training rate (trailing 7-day acute). Fall back to the most
        # recent week's bucket load only if there is no recent acute at all.
        recent = float(current_acute or 0.0)
        if recent <= 0:
            recent = (float(completed["load"].iloc[0]) if n == 1
                      else float(future["load"].iloc[0]) if len(future) else 0.0)
        base = recent
        model_type, r2 = "recent pace", None
        predict = lambda w: base
        confidence = 0.4   # we know the current pace, just not the monthly trend

    # Clip so a steep fit can't extrapolate into nonsense.
    max_obs = float(weeks_df["load"].max()) if not weeks_df.empty else 0.0
    cap = max(max_obs * 3.0, current_acute * 3.0, config.BOOTSTRAP_ACUTE[2])
    preds = {int(wk["week"]): min(predict(int(wk["week"])), cap) for _, wk in future.iterrows()}

    return completed, future, n, model_type, r2, confidence, preds


def _simulate_forward(logs_full, as_of, month_start, month_end, future, preds, user):
    """Build the daily load series (actual up to as_of; the projected weekly
    load spread evenly across each remaining week) and recompute the rolling
    acute / chronic / AC ratio over the whole series.

    This is the key correctness point: chronic is RECOMPUTED as the trainee
    'keeps training like this', so a sustained higher load pulls chronic up and
    the AC ratio converges sensibly, instead of dividing a rising acute by
    today's frozen (low) chronic and reporting an impossible ratio."""
    sim_start = month_start - timedelta(days=config.CHRONIC_WINDOW_DAYS)
    daily = features.daily_load_series(logs_full, sim_start, month_end)

    # Overwrite each remaining week's still-to-come days with the projected
    # weekly load spread evenly (pandas date-range slice, no day loop).
    for _, wk in future.iterrows():
        per_day = preds.get(int(wk["week"]), 0.0) / 7.0
        fill_from = max(wk["start"], as_of + timedelta(days=1))
        if fill_from <= wk["end"]:
            daily.loc[pd.date_range(fill_from, wk["end"], freq="D")] = per_day

    rolled = features.rolling_loads(
        daily, user["ExperienceLevel"], user["IsBaselineEstablished"]
    )

    weeks_out = []
    for _, wk in future.iterrows():
        r = rolled.loc[pd.Timestamp(min(wk["end"], month_end))]
        ratio = None if pd.isna(r["ac_ratio"]) else round(float(r["ac_ratio"]), 2)
        weeks_out.append({
            "week": int(wk["week"]),
            "start": wk["start"].isoformat(),
            "projAcuteLoad": round(float(r["acute"]), 0),
            "projACRatio": ratio,
            "risk": risk.rule_class(ratio),
        })
    return weeks_out, rolled


def _state_from_rolled(rolled, as_of):
    """Current acute / chronic / AC ratio at as_of (projection-free: only
    actual days fall in the trailing windows ending at as_of)."""
    r = rolled.loc[pd.Timestamp(as_of)]
    ratio = None if pd.isna(r["ac_ratio"]) else float(r["ac_ratio"])
    return {
        "acute": round(float(r["acute"]), 1),
        "chronic": round(float(r["chronic"]), 1),
        "acRatio": None if ratio is None else round(ratio, 2),
        "level": features.level_for(ratio),
    }


# --------------------------------------------------------------------------
# Global model projection
# --------------------------------------------------------------------------
def _global_projection(state, user, completed, current_chronic, weeks_elapsed):
    model = _load_global_model()
    if model is None:
        return {"available": False}
    try:
        age = (date.today().year - int(user["BirthYear"])) if user.get("BirthYear") else 30
        avg_weekly = float(completed["load"].mean()) if len(completed) else state["acute"]
        row = pd.DataFrame([[
            state["acute"], state["chronic"], state["acRatio"] or 0.0,
            user["ExperienceLevel"], age, avg_weekly, weeks_elapsed,
        ]], columns=GLOBAL_FEATURES)
        proj_load = float(model.predict(row)[0])
        proj_load = max(0.0, proj_load)
        ratio = (proj_load / current_chronic) if current_chronic and current_chronic > 0 else None
        return {
            "available": True,
            "projAcuteLoad": round(proj_load, 0),
            "projACRatio": None if ratio is None else round(ratio, 2),
            "risk": risk.rule_class(ratio),
        }
    except Exception as exc:
        print(f"[forecast] global prediction failed: {exc}")
        return {"available": False}


# --------------------------------------------------------------------------
# Snapshot persistence
# --------------------------------------------------------------------------
def _write_snapshot(trainee_id, month_key, as_of, weeks_elapsed, workouts,
                    state, eo, model_type, r2, risk_class, projected_json):
    sql = (
        "INSERT INTO MonthlyForecasts "
        "(TraineeUserID, MonthKey, AsOfDate, WeeksElapsed, WorkoutsThisMonth, "
        " CurrentACRatio, CurrentChronic, ProjectedACRatio, ProjectedAcuteLoad, "
        " ProjectedJson, ModelType, R2, RiskClass) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    db.execute(sql, [
        trainee_id, month_key, as_of, weeks_elapsed, workouts,
        state["acRatio"], state["chronic"], eo["projACRatio"], eo["projAcuteLoad"],
        projected_json, model_type, r2, risk_class,
    ])


def _latest_snapshot(trainee_id, month_key):
    sql = (
        "SELECT TOP 1 MonthKey, AsOfDate, WeeksElapsed, WorkoutsThisMonth, "
        "       CurrentACRatio, CurrentChronic, ProjectedACRatio, ProjectedAcuteLoad, "
        "       ProjectedJson, ModelType, R2, RiskClass, GeneratedAt "
        "FROM MonthlyForecasts WHERE TraineeUserID = ? AND MonthKey = ? "
        "ORDER BY GeneratedAt DESC"
    )
    df = db.query_df(sql, [trainee_id, month_key])
    return None if df.empty else df.iloc[0].to_dict()


def read_history(trainee_id):
    """Latest snapshot per month (newest month first) for the month picker."""
    sql = (
        "SELECT f.MonthKey, f.AsOfDate, f.ProjectedACRatio, f.ProjectedAcuteLoad, "
        "       f.RiskClass, f.WeeksElapsed, f.GeneratedAt "
        "FROM MonthlyForecasts f "
        "WHERE f.TraineeUserID = ? AND f.GeneratedAt = ("
        "   SELECT MAX(GeneratedAt) FROM MonthlyForecasts "
        "   WHERE TraineeUserID = f.TraineeUserID AND MonthKey = f.MonthKey) "
        "ORDER BY f.MonthKey DESC"
    )
    df = db.query_df(sql, [trainee_id])
    out = []
    for _, r in df.iterrows():
        out.append({
            "monthKey": r["MonthKey"].strip(),
            "asOf": str(r["AsOfDate"]),
            "projACRatio": None if pd.isna(r["ProjectedACRatio"]) else round(float(r["ProjectedACRatio"]), 2),
            "projAcuteLoad": None if pd.isna(r["ProjectedAcuteLoad"]) else round(float(r["ProjectedAcuteLoad"]), 0),
            "riskClass": r["RiskClass"],
            "weeksElapsed": int(r["WeeksElapsed"]),
        })
    return out


def _snapshot_to_response(trainee_id, snap):
    """Render a stored snapshot row into the same shape as a live forecast,
    so the screen can display a past month read-only."""
    month_key = snap["MonthKey"].strip()
    year, mon = int(month_key[:4]), int(month_key[5:7])
    weeks = json.loads(snap["ProjectedJson"]) if snap.get("ProjectedJson") else []
    proj_ac = None if pd.isna(snap["ProjectedACRatio"]) else round(float(snap["ProjectedACRatio"]), 2)
    proj_load = None if pd.isna(snap["ProjectedAcuteLoad"]) else round(float(snap["ProjectedAcuteLoad"]), 0)
    return {
        "traineeId": trainee_id,
        "monthKey": month_key,
        "monthName": MONTH_NAMES[mon],
        "asOf": str(snap["AsOfDate"]),
        "weeksElapsed": int(snap["WeeksElapsed"]),
        "workoutsThisMonth": int(snap["WorkoutsThisMonth"]),
        "stored": True,
        "current": {
            "acRatio": None if pd.isna(snap["CurrentACRatio"]) else round(float(snap["CurrentACRatio"]), 2),
            "chronic": None if pd.isna(snap["CurrentChronic"]) else round(float(snap["CurrentChronic"]), 1),
        },
        "perTrainee": {
            "modelType": snap["ModelType"],
            "r2": None if pd.isna(snap["R2"]) else round(float(snap["R2"]), 3),
            "weeks": weeks,
            "endOfMonth": {"projACRatio": proj_ac, "projAcuteLoad": proj_load,
                           "risk": snap["RiskClass"]},
        },
        "global": {"available": False},
        "riskClass": snap["RiskClass"],
        "headline": _headline(MONTH_NAMES[mon], proj_ac, proj_load),
    }


def _headline(month_name, proj_ac, proj_load):
    if proj_ac is None or proj_load is None:
        return f"Not enough data yet to project {month_name}."
    return (f"By end of {month_name}: AC ratio {proj_ac:.2f}, "
            f"acute load {int(proj_load)}.")


# --------------------------------------------------------------------------
# Public entry point
# --------------------------------------------------------------------------
def get_forecast(trainee_id, month_key=None):
    user = features.get_user(trainee_id)
    if user is None:
        return {"error": "trainee not found"}

    current_key = _current_month_key()
    month_key = month_key or current_key
    is_current = (month_key == current_key)

    # Past month: prefer the recorded snapshot (what was actually forecast then).
    if not is_current:
        snap = _latest_snapshot(trainee_id, month_key)
        if snap is not None:
            return _snapshot_to_response(trainee_id, snap)
        # else fall through and compute read-only

    month_start, month_end = features.month_bounds(month_key)
    as_of = date.today() if is_current else month_end
    if as_of > month_end:
        as_of = month_end

    # Fetch a chronic window of history before the month so the rolling
    # chronic is accurate from day one of the month. (Extra pre-month logs
    # simply don't fall into any of this month's weekly buckets.)
    logs = features.get_trainee_logs(
        trainee_id, month_start - timedelta(days=config.CHRONIC_WINDOW_DAYS)
    )
    weeks_df = features.weekly_buckets(logs, month_start, month_end)
    workouts_this_month = int(weeks_df["workouts"].sum())

    # Current load state from ACTUAL data up to as_of (no projection). This also
    # gives the trailing 7-day acute that drives the early-month "recent pace".
    sim_start = month_start - timedelta(days=config.CHRONIC_WINDOW_DAYS)
    daily_actual = features.daily_load_series(logs, sim_start, as_of)
    rolled_actual = features.rolling_loads(
        daily_actual, user["ExperienceLevel"], user["IsBaselineEstablished"]
    )
    state = _state_from_rolled(rolled_actual, as_of)
    current_chronic = state["chronic"]

    completed, future, n, model_type, r2, confidence, preds = _predict_weekly_loads(
        weeks_df, as_of, state["acute"]
    )
    weeks_out, rolled = _simulate_forward(logs, as_of, month_start, month_end, future, preds, user)

    # End-of-month headline = last projected week, or the month-end actual when
    # the month is already complete (no future weeks).
    if weeks_out:
        eo = {"projACRatio": weeks_out[-1]["projACRatio"],
              "projAcuteLoad": weeks_out[-1]["projAcuteLoad"]}
    else:
        r = rolled.loc[pd.Timestamp(month_end)]
        eo_ratio = None if pd.isna(r["ac_ratio"]) else round(float(r["ac_ratio"]), 2)
        eo = {"projACRatio": eo_ratio, "projAcuteLoad": round(float(r["acute"]), 0)}

    age = (date.today().year - int(user["BirthYear"])) if user.get("BirthYear") else None
    active_injuries = 0
    inj = features.get_injuries(trainee_id)
    if not inj.empty and "IsActiveInjury" in inj.columns:
        active_injuries = int(inj["IsActiveInjury"].fillna(0).astype(bool).sum())

    risk_class = risk.classify({
        "ac_ratio": eo["projACRatio"], "acute": eo["projAcuteLoad"] or 0,
        "chronic": current_chronic, "experience": user["ExperienceLevel"],
        "age": age or 30, "active_injuries": active_injuries,
    })
    eo["risk"] = risk_class

    global_proj = _global_projection(state, user, completed, current_chronic, n)

    year, mon = int(month_key[:4]), int(month_key[5:7])
    response = {
        "traineeId": trainee_id,
        "monthKey": month_key,
        "monthName": MONTH_NAMES[mon],
        "asOf": as_of.isoformat(),
        "weeksElapsed": n,
        "workoutsThisMonth": workouts_this_month,
        "stored": False,
        "current": {"acRatio": state["acRatio"], "chronic": state["chronic"],
                    "acute": state["acute"], "level": state["level"]},
        "perTrainee": {
            "modelType": model_type,
            "r2": None if r2 is None else round(r2, 3),
            "confidence": confidence,
            "weeks": weeks_out,
            "endOfMonth": eo,
        },
        "global": global_proj,
        "riskClass": risk_class,
        "headline": _headline(MONTH_NAMES[mon], eo["projACRatio"], eo["projAcuteLoad"]),
    }

    # Record a snapshot for the current month so the forecast history builds up.
    if is_current:
        try:
            _write_snapshot(
                trainee_id, month_key, as_of, n, workouts_this_month, state, eo,
                model_type, r2, risk_class, json.dumps(weeks_out),
            )
        except Exception as exc:
            print(f"[forecast] snapshot write failed: {exc}")

    return response

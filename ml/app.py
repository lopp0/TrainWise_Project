"""
TrainWise Coach-Analytics ML service.

A small Flask app the coach screen calls directly over the LAN. It reads the
same SQL Express database the C# backend uses (read-only for charts; it also
appends forecast snapshots to MonthlyForecasts).

Run:
    python app.py            # serves on 0.0.0.0:8000

Endpoints (<id> = trainee Users.UserID):
    GET /health
    GET /api/ml/trainee/<id>/pmc?days=42
    GET /api/ml/trainee/<id>/acwr?days=28
    GET /api/ml/trainee/<id>/analytics?days=56
    GET /api/ml/trainee/<id>/forecast[?month=YYYY-MM]
    GET /api/ml/trainee/<id>/forecast/history
"""
import re

from flask import Flask, jsonify, request

import config
import db
import auth
import features
import forecast

app = Flask(__name__)


@app.before_request
def enforce_auth():
    # Off by default (ML_AUTH_ENFORCE unset) → no behaviour change. When on, every
    # trainee endpoint needs the same signed token the C# API issues, and the
    # caller may only read a trainee they are or coach. /health stays public.
    if not config.ML_AUTH_ENFORCE:
        return None
    if request.method == "OPTIONS" or request.path == "/health":
        return None
    uid = auth.verify_token(request.headers.get("Authorization"))
    if uid is None:
        return jsonify({"error": "Unauthorized"}), 401
    trainee_id = (request.view_args or {}).get("trainee_id")
    if trainee_id is not None and not auth.may_view(uid, int(trainee_id)):
        return jsonify({"error": "Forbidden"}), 403
    return None


@app.after_request
def add_cors(resp):
    # The RN client (axios/fetch) does not enforce CORS, but this makes the
    # endpoints testable from a browser during debugging.
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


@app.get("/health")
def health():
    return jsonify({"status": "ok", "db": db.ping()})


def _clamp_days(raw, default):
    """Bound the window so a huge/negative ?days= can't blow up the date range
    (a pd.date_range of millions of days is an OOM DoS)."""
    try:
        d = int(raw) if raw is not None else default
    except (TypeError, ValueError):
        d = default
    return max(1, min(d, 400))


def _tz_offset():
    """Caller's UTC offset in minutes (?tzOffsetMinutes=180 for Israel DST),
    clamped to the real-world UTC-14..+14 range. 0 = legacy UTC-day buckets."""
    try:
        tz = int(request.args.get("tzOffsetMinutes") or 0)
    except (TypeError, ValueError):
        tz = 0
    return max(-14 * 60, min(14 * 60, tz))


# Generic error body — never echo str(exc) to the client (it can leak SQL text,
# the DB/server name, or file paths). The detail stays in the server log.
_ERR = "An unexpected error occurred."


@app.get("/api/ml/trainee/<int:trainee_id>/pmc")
def pmc(trainee_id):
    days = _clamp_days(request.args.get("days"), 42)
    try:
        return jsonify({"traineeId": trainee_id,
                        "series": features.pmc_series(trainee_id, days, _tz_offset())})
    except Exception:
        app.logger.exception("pmc failed")
        return jsonify({"error": _ERR, "series": []}), 500


@app.get("/api/ml/trainee/<int:trainee_id>/acwr")
def acwr(trainee_id):
    days = _clamp_days(request.args.get("days"), 28)
    try:
        data = features.acwr_series(trainee_id, days, _tz_offset())
        data["traineeId"] = trainee_id
        return jsonify(data)
    except Exception:
        app.logger.exception("acwr failed")
        return jsonify({"error": _ERR, "series": []}), 500


@app.get("/api/ml/trainee/<int:trainee_id>/analytics")
def analytics(trainee_id):
    # Full load analytics (rolling + bias-corrected EWMA AC ratio + training
    # summary) — same shape as the C# LoadAnalyticsBL, so the Load tab charts can
    # be served from the ML service. Default 56-day window.
    days = _clamp_days(request.args.get("days"), 56)
    try:
        data = features.analytics_series(trainee_id, days, _tz_offset())
        data["traineeId"] = trainee_id
        return jsonify(data)
    except Exception:
        app.logger.exception("analytics failed")
        return jsonify({"error": _ERR, "series": []}), 500


@app.get("/api/ml/trainee/<int:trainee_id>/forecast")
def forecast_endpoint(trainee_id):
    month = request.args.get("month", default=None, type=str)
    # Basic shape guard so a malformed month can't reach the parser.
    if month is not None and not re.fullmatch(r"\d{4}-\d{2}", month):
        return jsonify({"error": "month must be formatted YYYY-MM"}), 400
    try:
        result = forecast.get_forecast(trainee_id, month, _tz_offset())
        status = 404 if result.get("error") else 200
        return jsonify(result), status
    except Exception:
        app.logger.exception("forecast failed")
        return jsonify({"error": _ERR}), 500


@app.get("/api/ml/trainee/<int:trainee_id>/forecast/history")
def forecast_history(trainee_id):
    try:
        return jsonify({"traineeId": trainee_id, "months": forecast.read_history(trainee_id)})
    except Exception:
        app.logger.exception("forecast history failed")
        return jsonify({"error": _ERR, "months": []}), 500


if __name__ == "__main__":
    print(f"TrainWise ML service on http://{config.HOST}:{config.PORT}  "
          f"(DB {config.SQL_SERVER}/{config.SQL_DATABASE})")
    app.run(host=config.HOST, port=config.PORT, debug=False)

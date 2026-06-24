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
    GET /api/ml/trainee/<id>/forecast[?month=YYYY-MM]
    GET /api/ml/trainee/<id>/forecast/history
"""
from flask import Flask, jsonify, request

import config
import db
import features
import forecast

app = Flask(__name__)


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


@app.get("/api/ml/trainee/<int:trainee_id>/pmc")
def pmc(trainee_id):
    days = request.args.get("days", default=42, type=int)
    try:
        return jsonify({"traineeId": trainee_id, "series": features.pmc_series(trainee_id, days)})
    except Exception as exc:
        app.logger.exception("pmc failed")
        return jsonify({"error": str(exc), "series": []}), 500


@app.get("/api/ml/trainee/<int:trainee_id>/acwr")
def acwr(trainee_id):
    days = request.args.get("days", default=28, type=int)
    try:
        data = features.acwr_series(trainee_id, days)
        data["traineeId"] = trainee_id
        return jsonify(data)
    except Exception as exc:
        app.logger.exception("acwr failed")
        return jsonify({"error": str(exc), "series": []}), 500


@app.get("/api/ml/trainee/<int:trainee_id>/forecast")
def forecast_endpoint(trainee_id):
    month = request.args.get("month", default=None, type=str)
    try:
        result = forecast.get_forecast(trainee_id, month)
        status = 404 if result.get("error") else 200
        return jsonify(result), status
    except Exception as exc:
        app.logger.exception("forecast failed")
        return jsonify({"error": str(exc)}), 500


@app.get("/api/ml/trainee/<int:trainee_id>/forecast/history")
def forecast_history(trainee_id):
    try:
        return jsonify({"traineeId": trainee_id, "months": forecast.read_history(trainee_id)})
    except Exception as exc:
        app.logger.exception("forecast history failed")
        return jsonify({"error": str(exc), "months": []}), 500


if __name__ == "__main__":
    print(f"TrainWise ML service on http://{config.HOST}:{config.PORT}  "
          f"(DB {config.SQL_SERVER}/{config.SQL_DATABASE})")
    app.run(host=config.HOST, port=config.PORT, debug=False)

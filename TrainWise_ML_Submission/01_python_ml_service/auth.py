"""
Optional JWT auth for the ML service, matching the C# API's tokens.

Gated by config.ML_AUTH_ENFORCE (default OFF) so the local service keeps working
without any token during rollout. When enabled, requests must carry the same
signed bearer token the C# backend issues (validated with the shared JWT_KEY),
and a caller may only read a trainee they ARE or COACH.

PyJWT is imported lazily inside verify_token so the service still starts when the
package isn't installed (only needed once ML_AUTH_ENFORCE is turned on):
    pip install PyJWT
"""
import config
import db


def verify_token(auth_header):
    """Return the caller's UserID from a valid 'Bearer <jwt>' header, else None."""
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:].strip()
    if not config.JWT_KEY:
        print("[ml.auth] JWT_KEY not set — cannot validate tokens.")
        return None

    try:
        import jwt  # PyJWT, lazy so the service starts without it when auth is off
    except ImportError:
        print("[ml.auth] PyJWT not installed — run: pip install PyJWT")
        return None

    try:
        payload = jwt.decode(
            token, config.JWT_KEY, algorithms=["HS256"],
            audience=config.JWT_AUDIENCE, issuer=config.JWT_ISSUER,
        )
    except Exception as exc:
        print(f"[ml.auth] token rejected: {exc}")
        return None

    raw = payload.get("uid") or payload.get("sub")
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def may_view(caller_uid, trainee_id):
    """True if the caller is the trainee themselves or a coach linked to them."""
    if caller_uid == trainee_id:
        return True
    try:
        df = db.query_df(
            "SELECT 1 AS ok FROM CoachTrainees ct "
            "JOIN Coaches c ON c.CoachID = ct.CoachID "
            "WHERE c.UserID = ? AND ct.UserID = ?",
            [caller_uid, trainee_id],
        )
        return not df.empty
    except Exception:
        return False

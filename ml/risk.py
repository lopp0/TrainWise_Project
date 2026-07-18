"""
Overload-risk classification (PDF Task 2): Safe / Warning / High.

If the notebook has exported models/risk_model.pkl we use it; otherwise we
fall back to the same rule the app uses on the AC ratio. Either way the coach
gets a stable label.
"""
import os
import joblib

import config

_model = None
_load_attempted = False


def _maybe_load():
    global _model, _load_attempted
    if _load_attempted:
        return _model
    _load_attempted = True
    try:
        if os.path.exists(config.RISK_MODEL_PATH):
            _model = joblib.load(config.RISK_MODEL_PATH)
    except Exception as exc:  # corrupt/incompatible pickle -> rule fallback
        print(f"[risk] could not load model, using rules: {exc}")
        _model = None
    return _model


def rule_class(ac_ratio):
    """Rule-based fallback mirroring DetermineLoadLevel: >1.3 High, >=0.8
    Warning, else Safe."""
    if ac_ratio is None:
        return "Safe"
    if ac_ratio > config.AC_YELLOW_MAX:
        return "High"
    if ac_ratio >= config.AC_GREEN_MAX:
        return "Warning"
    return "Safe"


def classify(features: dict):
    """features expects at least 'ac_ratio'; the trained model may also use
    'acute', 'chronic', 'experience', 'age', 'active_injuries'. Returns one of
    Safe | Warning | High."""
    model = _maybe_load()
    if model is None:
        return rule_class(features.get("ac_ratio"))
    try:
        import pandas as pd
        # The exported model is an sklearn Pipeline trained on this exact
        # column order (see the notebook's "export" cell).
        cols = ["ac_ratio", "acute", "chronic", "experience", "age", "active_injuries"]
        row = pd.DataFrame([[features.get(c, 0) or 0 for c in cols]], columns=cols)
        pred = model.predict(row)[0]
        return str(pred)
    except Exception as exc:
        print(f"[risk] model.predict failed, using rules: {exc}")
        return rule_class(features.get("ac_ratio"))

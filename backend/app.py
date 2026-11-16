"""
Python Flask REST API for MudraLab ISL Hand Gesture Recognition.

Connects the browser MediaPipe Hand Landmarker frontend to the trained
Scikit-Learn Random Forest classifier, feature preprocessing pipeline,
dataset collector, and retraining orchestrator.
"""

from __future__ import annotations

import csv
import json
import sys
import threading
from pathlib import Path
from typing import Any, Dict, List

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

ROOT_DIR = Path(__file__).resolve().parent.parent
ML_DIR = ROOT_DIR / "ml"
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

from isl_alphabet_spec import ISL_DYNAMIC_CLASSES, ISL_HAND_MODE, ISL_STATIC_CLASSES
from preprocessing import TOTAL_FEATURES, extract_features_from_hands, get_feature_names
from train import run_training_pipeline

DATA_CSV = ML_DIR / "data" / "isl_landmarks.csv"
ARTIFACTS_DIR = ML_DIR / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "isl_rf_model.joblib"
EVAL_PATH = ARTIFACTS_DIR / "evaluation_report.json"
PREPROC_PATH = ARTIFACTS_DIR / "preprocessing.json"
HELDOUT_PATH = ARTIFACTS_DIR / "heldout_samples.json"

DEFAULT_CONFIDENCE_THRESHOLD = 0.55

app = Flask(__name__)
CORS(app)

_model_lock = threading.Lock()
_model_bundle: Dict[str, Any] | None = None


def _load_model() -> Dict[str, Any]:
    global _model_bundle
    if not MODEL_PATH.exists():
        run_training_pipeline(DATA_CSV, ARTIFACTS_DIR)
    _model_bundle = joblib.load(MODEL_PATH)
    return _model_bundle


def _get_model() -> Dict[str, Any]:
    with _model_lock:
        if _model_bundle is None:
            return _load_model()
        return _model_bundle


@app.get("/api/health")
def health() -> Any:
    bundle = _get_model()
    return jsonify({
        "status": "ok",
        "backend": "python-flask-sklearn",
        "model_loaded": bundle is not None,
        "static_classes": bundle["classes"] if bundle else ISL_STATIC_CLASSES,
        "dynamic_classes": ISL_DYNAMIC_CLASSES,
        "total_features": TOTAL_FEATURES,
    })


@app.post("/api/predict")
def predict() -> Any:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be valid JSON"}), 400

    threshold = float(payload.get("confidence_threshold", DEFAULT_CONFIDENCE_THRESHOLD))
    threshold = max(0.1, min(0.99, threshold))

    try:
        if "hands" in payload and payload["hands"] is not None:
            hands = payload["hands"]
            if not isinstance(hands, list) or len(hands) == 0:
                return jsonify({"error": "No hand landmarks provided in 'hands'"}), 400
            features = extract_features_from_hands(hands)
        elif "features" in payload and payload["features"] is not None:
            raw = payload["features"]
            if not isinstance(raw, list) or len(raw) != TOTAL_FEATURES:
                return jsonify({
                    "error": f"Expected {TOTAL_FEATURES} numeric features, got {len(raw) if isinstance(raw, list) else type(raw).__name__}"
                }), 400
            features = np.asarray(raw, dtype=np.float64)
            if not np.isfinite(features).all():
                return jsonify({"error": "Features contain NaN or infinite values"}), 400
        else:
            return jsonify({"error": "Provide either 'hands' (MediaPipe landmarks) or 'features' (130 floats)"}), 400
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Invalid landmark input: {exc}"}), 400

    bundle = _get_model()
    rf = bundle["model"]
    classes: List[str] = bundle["classes"]

    probs = rf.predict_proba(features.reshape(1, -1))[0]
    sorted_idx = np.argsort(probs)[::-1]
    top_idx = int(sorted_idx[0])
    top_label = str(classes[top_idx])
    top_conf = float(probs[top_idx])

    top_k = [
        {
            "label": str(classes[int(i)]),
            "confidence": round(float(probs[int(i)]), 4),
            "hand_mode": ISL_HAND_MODE.get(str(classes[int(i)]), "unknown"),
        }
        for i in sorted_idx[:3]
    ]

    uncertain = top_conf < threshold
    return jsonify({
        "predicted_label": None if uncertain else top_label,
        "raw_top_label": top_label,
        "confidence": round(top_conf, 4),
        "uncertain": uncertain,
        "threshold": threshold,
        "hand_count": int(round(float(features[126]))),
        "expected_hand_mode": ISL_HAND_MODE.get(top_label, "unknown"),
        "top_predictions": top_k,
        "engine": "python-flask-sklearn",
    })


@app.get("/api/evaluate")
@app.get("/api/model-info")
def model_info() -> Any:
    if not EVAL_PATH.exists():
        run_training_pipeline(DATA_CSV, ARTIFACTS_DIR)
    with open(EVAL_PATH, "r", encoding="utf-8") as f:
        report = json.load(f)
    preproc = {}
    if PREPROC_PATH.exists():
        with open(PREPROC_PATH, "r", encoding="utf-8") as f:
            preproc = json.load(f)
    return jsonify({
        "evaluation": report,
        "preprocessing": preproc,
        "engine": "python-flask-sklearn",
    })


@app.get("/api/dataset")
def get_dataset() -> Any:
    if not DATA_CSV.exists():
        return jsonify({"total_samples": 0, "class_counts": {}, "sources": {}, "custom_samples": 0})
    df = pd.read_csv(DATA_CSV, usecols=["label", "hand_mode", "signer_id", "source"])
    counts = {str(k): int(v) for k, v in df["label"].value_counts().sort_index().items()}
    sources = {str(k): int(v) for k, v in df["source"].value_counts().items()}
    custom_count = int((df["source"] != "anatomical_prototype").sum())
    return jsonify({
        "total_samples": int(len(df)),
        "class_counts": counts,
        "sources": sources,
        "custom_samples": custom_count,
        "static_classes": ISL_STATIC_CLASSES,
        "dynamic_classes": ISL_DYNAMIC_CLASSES,
    })


@app.post("/api/dataset/sample")
def add_dataset_sample() -> Any:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be valid JSON"}), 400

    label = str(payload.get("label", "")).strip().upper()
    if label not in ISL_STATIC_CLASSES:
        return jsonify({"error": f"Invalid static ISL label '{label}'. Must be A-I or K-Y."}), 400

    signer_id = str(payload.get("signer_id", "web_collector")).strip() or "web_collector"
    hands = payload.get("hands")
    if not isinstance(hands, list) or len(hands) == 0:
        return jsonify({"error": "No valid hand landmarks detected for collection"}), 400

    try:
        features = extract_features_from_hands(hands)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    # Prevent exact duplicate of last recorded frame if provided
    feature_list = [round(float(v), 6) for v in features]
    file_exists = DATA_CSV.exists()
    DATA_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_CSV, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["label", "hand_mode", "signer_id", "source"] + get_feature_names())
        writer.writerow([label, ISL_HAND_MODE[label], signer_id, "web_collector"] + feature_list)

    return jsonify({
        "status": "saved",
        "label": label,
        "hand_count": int(round(float(features[126]))),
        "source": "web_collector",
    }), 201


@app.delete("/api/dataset/custom")
def clear_custom_samples() -> Any:
    if not DATA_CSV.exists():
        return jsonify({"status": "ok", "removed": 0})
    df = pd.read_csv(DATA_CSV)
    before = len(df)
    df_clean = df[df["source"] == "anatomical_prototype"].copy()
    df_clean.to_csv(DATA_CSV, index=False)
    return jsonify({"status": "ok", "removed": int(before - len(df_clean)), "remaining": int(len(df_clean))})


@app.post("/api/train")
def trigger_training() -> Any:
    try:
        with _model_lock:
            report = run_training_pipeline(DATA_CSV, ARTIFACTS_DIR)
            _load_model()
        return jsonify({"status": "trained", "evaluation": report})
    except Exception as exc:
        return jsonify({"error": f"Training failed: {exc}"}), 500


@app.get("/api/sample-frame/<letter>")
def get_heldout_sample(letter: str) -> Any:
    lbl = letter.strip().upper()
    if not HELDOUT_PATH.exists():
        return jsonify({"error": "Held-out samples not generated yet"}), 404
    with open(HELDOUT_PATH, "r", encoding="utf-8") as f:
        samples = json.load(f)
    if lbl not in samples:
        return jsonify({"error": f"No static held-out sample for '{lbl}'"}), 404
    return jsonify({
        "label": lbl,
        "hand_mode": ISL_HAND_MODE.get(lbl, "unknown"),
        "features": samples[lbl],
        "source": "heldout_test_split",
    })


if __name__ == "__main__":
    _get_model()
    app.run(host="127.0.0.1", port=5001, debug=False)

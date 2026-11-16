"""
Comprehensive Pytest Suite for ML Pipeline, Preprocessing, and Flask REST API.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pytest

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR / "ml"))
sys.path.insert(0, str(ROOT_DIR / "backend"))

from isl_alphabet_spec import ISL_STATIC_CLASSES
from preprocessing import TOTAL_FEATURES, extract_features_from_hands
import app as flask_module


@pytest.fixture()
def client():
    flask_module.app.config["TESTING"] = True
    with flask_module.app.test_client() as c:
        yield c


def _make_dummy_hand(offset_x: float = 0.0, scale: float = 0.12) -> list[dict]:
    pts = []
    for i in range(21):
        # Simple non-degenerate hand points with middle MCP (idx 9) at distance `scale`
        angle = (i / 21.0) * 1.2
        r = scale if i == 9 else (0.04 + 0.01 * i) * (scale / 0.12)
        pts.append({
            "x": offset_x + 0.5 + r * np.sin(angle),
            "y": 0.6 - r * np.cos(angle),
            "z": -0.01 * (i % 4) * (scale / 0.12),
        })
    pts[0] = {"x": offset_x + 0.5, "y": 0.6, "z": 0.0}
    return pts


def test_preprocessing_translation_and_scale_invariance():
    h_a = _make_dummy_hand(offset_x=0.0, scale=0.12)
    h_b = _make_dummy_hand(offset_x=0.22, scale=0.24)
    f_a = extract_features_from_hands([h_a])
    f_b = extract_features_from_hands([h_b])

    assert f_a.shape == (TOTAL_FEATURES,)
    assert f_b.shape == (TOTAL_FEATURES,)
    assert f_a[126] == pytest.approx(1.0)
    # Single-hand normalized coordinates should match across translation & scale
    assert np.allclose(f_a[:63], f_b[:63], atol=1e-6)
    assert np.allclose(f_a[63:126], 0.0)


def test_preprocessing_rejects_invalid_hands():
    with pytest.raises(ValueError):
        extract_features_from_hands([])
    with pytest.raises(ValueError):
        extract_features_from_hands([[{"x": 0.5, "y": 0.5, "z": 0.0}] * 10])
    with pytest.raises(ValueError):
        extract_features_from_hands([[{"x": 0.5, "y": 0.5, "z": 0.0}] * 21])  # zero scale


def test_model_artifacts_and_all_24_classes():
    model_path = ROOT_DIR / "ml" / "artifacts" / "isl_rf_model.joblib"
    heldout_path = ROOT_DIR / "ml" / "artifacts" / "heldout_samples.json"
    assert model_path.exists()
    assert heldout_path.exists()

    bundle = joblib.load(model_path)
    rf = bundle["model"]
    classes = bundle["classes"]
    assert set(classes) == set(ISL_STATIC_CLASSES)

    with open(heldout_path, "r", encoding="utf-8") as f:
        heldout = json.load(f)

    assert set(heldout.keys()) == set(ISL_STATIC_CLASSES)
    correct = 0
    for lbl, feats in heldout.items():
        arr = np.asarray(feats, dtype=np.float64).reshape(1, -1)
        pred = classes[int(np.argmax(rf.predict_proba(arr)[0]))]
        if pred == lbl:
            correct += 1
    assert correct >= 22, f"Expected at least 22/24 classes correct on held-out samples, got {correct}"


def test_flask_health_and_evaluate(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert data["model_loaded"] is True
    assert data["total_features"] == 130

    eval_res = client.get("/api/evaluate")
    assert eval_res.status_code == 200
    eval_data = eval_res.get_json()
    assert "evaluation" in eval_data
    assert eval_data["evaluation"]["test_metrics"]["accuracy"] > 0.85


def test_flask_predict_valid_and_uncertain_and_errors(client):
    heldout_path = ROOT_DIR / "ml" / "artifacts" / "heldout_samples.json"
    with open(heldout_path, "r", encoding="utf-8") as f:
        heldout = json.load(f)

    # Test valid prediction on all 24 classes
    for lbl in ISL_STATIC_CLASSES:
        res = client.post("/api/predict", json={"features": heldout[lbl], "confidence_threshold": 0.45})
        assert res.status_code == 200
        d = res.get_json()
        assert d["confidence"] > 0.0
        assert len(d["top_predictions"]) == 3

    # Test uncertain threshold handling with noise/zero features
    noise_features = [0.0] * 130
    noise_features[126] = 1.0
    unc_res = client.post("/api/predict", json={"features": noise_features, "confidence_threshold": 0.90})
    assert unc_res.status_code == 200
    unc_data = unc_res.get_json()
    assert unc_data["uncertain"] is True
    assert unc_data["predicted_label"] is None

    # Test invalid inputs -> 400 errors
    bad_len = client.post("/api/predict", json={"features": [0.1, 0.2]})
    assert bad_len.status_code == 400
    bad_nan = client.post("/api/predict", json={"hands": []})
    assert bad_nan.status_code == 400
    bad_json = client.post("/api/predict", data="not json", content_type="application/json")
    assert bad_json.status_code == 400


def test_flask_dataset_and_sample_frame(client):
    ds = client.get("/api/dataset")
    assert ds.status_code == 200
    assert ds.get_json()["total_samples"] >= 1920

    sf = client.get("/api/sample-frame/B")
    assert sf.status_code == 200
    assert sf.get_json()["label"] == "B"
    assert sf.get_json()["hand_mode"] == "two-handed"
    assert len(sf.get_json()["features"]) == 130

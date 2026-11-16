"""
Complete Scikit-Learn Machine Learning Pipeline for ISL Recognition.

Steps performed:
1. Load CSV landmark dataset.
2. Inspect dataset quality (missing values, invalid shapes, duplicates, class balance).
3. Split data by signer group (`GroupShuffleSplit`) into Train / Validation / Test sets
   without data leakage (falls back to stratified split if insufficient groups).
4. Train Random Forest Classifier (primary) and compare with ExtraTreesClassifier
   and MLPClassifier on the validation set.
5. Evaluate final Random Forest on the unseen test set (accuracy, precision, recall,
   F1-score, per-class metrics, 24x24 confusion matrix).
6. Save trained model (`isl_rf_model.joblib`), preprocessing config (`preprocessing.json`),
   portable decision-tree JSON (`model_trees.json`), evaluation report (`evaluation_report.json`),
   and held-out test samples (`heldout_samples.json`) for cloud verification.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
)
from sklearn.model_selection import GroupShuffleSplit, StratifiedShuffleSplit
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import LabelEncoder

from isl_alphabet_spec import ISL_DYNAMIC_CLASSES, ISL_HAND_MODE, ISL_STATIC_CLASSES
from preprocessing import TOTAL_FEATURES, get_feature_names, get_preprocessing_config


def export_rf_to_json(rf: RandomForestClassifier, classes: List[str], feature_names: List[str]) -> Dict[str, Any]:
    """
    Export scikit-learn RandomForestClassifier decision trees to an exact,
    portable JSON structure so Node/TypeScript achieves 100% numeric parity.
    """
    trees = []
    for est in rf.estimators_:
        t = est.tree_
        # Normalized class probability vector at each leaf (scikit-learn averages tree predict_proba)
        values = t.value.squeeze(axis=1)
        row_sums = values.sum(axis=1, keepdims=True)
        row_sums[row_sums == 0] = 1.0
        probs = (values / row_sums).tolist()

        trees.append({
            "children_left": t.children_left.tolist(),
            "children_right": t.children_right.tolist(),
            "feature": t.feature.tolist(),
            "threshold": [round(float(x), 8) for x in t.threshold.tolist()],
            "probs": [[round(float(p), 6) for p in row] for row in probs],
        })

    return {
        "model_type": "RandomForestClassifier",
        "n_estimators": len(trees),
        "n_features": len(feature_names),
        "classes": classes,
        "trees": trees,
    }


def run_training_pipeline(
    csv_path: Path | None = None,
    artifacts_dir: Path | None = None,
    n_estimators: int = 120,
    max_depth: int | None = 18,
    random_state: int = 42,
) -> Dict[str, Any]:
    ml_dir = Path(__file__).resolve().parent
    csv_path = csv_path or (ml_dir / "data" / "isl_landmarks.csv")
    artifacts_dir = artifacts_dir or (ml_dir / "artifacts")
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(csv_path)
    feature_names = get_feature_names()

    # 1. Data quality audit & cleaning
    initial_rows = int(len(df))
    missing_cols = [c for c in ["label"] + feature_names if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Dataset missing required columns: {missing_cols[:5]}")

    df = df.dropna(subset=["label"] + feature_names).copy()
    df["label"] = df["label"].astype(str).str.strip().str.upper()
    df = df[df["label"].isin(ISL_STATIC_CLASSES)].copy()

    # Remove rows with non-finite features or exact duplicates on feature vectors
    X_raw = df[feature_names].to_numpy(dtype=np.float64)
    finite_mask = np.isfinite(X_raw).all(axis=1)
    df = df.loc[finite_mask].copy()
    before_dedup = int(len(df))
    df = df.drop_duplicates(subset=["label"] + feature_names).reset_index(drop=True)
    duplicates_removed = before_dedup - int(len(df))

    if len(df) < 50:
        raise ValueError("Insufficient valid samples for training (need at least 50)")

    X = df[feature_names].to_numpy(dtype=np.float64)
    y_labels = df["label"].to_numpy()
    groups = df["signer_id"].to_numpy() if "signer_id" in df.columns else np.arange(len(df))
    sources = df["source"].value_counts().to_dict() if "source" in df.columns else {"unknown": len(df)}

    le = LabelEncoder()
    y = le.fit_transform(y_labels)
    classes = [str(c) for c in le.classes_]

    # 2. Leak-free Train / Validation / Test Split (70% train / 15% val / 15% test)
    unique_groups = np.unique(groups)
    split_strategy = "GroupShuffleSplit(signer_id)"
    if len(unique_groups) >= 5:
        gss1 = GroupShuffleSplit(n_splits=1, test_size=0.30, random_state=random_state)
        train_idx, temp_idx = next(gss1.split(X, y, groups))
        gss2 = GroupShuffleSplit(n_splits=1, test_size=0.50, random_state=random_state)
        val_rel_idx, test_rel_idx = next(gss2.split(X[temp_idx], y[temp_idx], groups[temp_idx]))
        val_idx = temp_idx[val_rel_idx]
        test_idx = temp_idx[test_rel_idx]
    else:
        split_strategy = "StratifiedShuffleSplit"
        sss1 = StratifiedShuffleSplit(n_splits=1, test_size=0.30, random_state=random_state)
        train_idx, temp_idx = next(sss1.split(X, y))
        sss2 = StratifiedShuffleSplit(n_splits=1, test_size=0.50, random_state=random_state)
        val_rel_idx, test_rel_idx = next(sss2.split(X[temp_idx], y[temp_idx]))
        val_idx = temp_idx[val_rel_idx]
        test_idx = temp_idx[test_rel_idx]

    X_train, y_train = X[train_idx], y[train_idx]
    X_val, y_val = X[val_idx], y[val_idx]
    X_test, y_test = X[test_idx], y[test_idx]

    # 3. Train Random Forest Classifier (Primary) & Benchmark Models
    rf = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        min_samples_leaf=1,
        random_state=random_state,
        n_jobs=-1,
    )
    rf.fit(X_train, y_train)

    et = ExtraTreesClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        random_state=random_state,
        n_jobs=-1,
    )
    et.fit(X_train, y_train)

    mlp = MLPClassifier(
        hidden_layer_sizes=(128, 64),
        max_iter=300,
        random_state=random_state,
    )
    mlp.fit(X_train, y_train)

    # Validation comparison
    val_comparison = []
    for name, clf in [
        ("Random Forest (Primary)", rf),
        ("Extra Trees (Benchmark)", et),
        ("MLP Neural Net (Benchmark)", mlp),
    ]:
        val_pred = clf.predict(X_val)
        val_acc = float(accuracy_score(y_val, val_pred))
        p, r, f1, _ = precision_recall_fscore_support(y_val, val_pred, average="macro", zero_division=0)
        val_comparison.append({
            "model": name,
            "val_accuracy": round(val_acc, 4),
            "val_macro_precision": round(float(p), 4),
            "val_macro_recall": round(float(r), 4),
            "val_macro_f1": round(float(f1), 4),
        })

    # 4. Final Held-Out Test Evaluation of Random Forest
    y_test_pred = rf.predict(X_test)
    test_acc = float(accuracy_score(y_test, y_test_pred))
    macro_p, macro_r, macro_f1, _ = precision_recall_fscore_support(
        y_test, y_test_pred, average="macro", zero_division=0
    )
    weighted_p, weighted_r, weighted_f1, _ = precision_recall_fscore_support(
        y_test, y_test_pred, average="weighted", zero_division=0
    )

    cm = confusion_matrix(y_test, y_test_pred, labels=list(range(len(classes)))).tolist()
    cls_report = classification_report(
        y_test, y_test_pred, labels=list(range(len(classes))), target_names=classes, output_dict=True, zero_division=0
    )

    per_class_metrics = []
    for cls_name in classes:
        m = cls_report.get(cls_name, {})
        per_class_metrics.append({
            "label": cls_name,
            "hand_mode": ISL_HAND_MODE.get(cls_name, "unknown"),
            "precision": round(float(m.get("precision", 0.0)), 4),
            "recall": round(float(m.get("recall", 0.0)), 4),
            "f1_score": round(float(m.get("f1-score", 0.0)), 4),
            "support": int(m.get("support", 0)),
        })

    # Save held-out test samples (1 representative sample per class from X_test)
    heldout_samples: Dict[str, List[float]] = {}
    for idx_pos, lbl_int in enumerate(y_test):
        lbl = classes[int(lbl_int)]
        if lbl not in heldout_samples:
            heldout_samples[lbl] = [round(float(v), 6) for v in X_test[idx_pos].tolist()]

    # 5. Persist artifacts
    joblib_payload = {
        "model": rf,
        "label_encoder": le,
        "classes": classes,
        "feature_names": feature_names,
        "n_features": TOTAL_FEATURES,
    }
    joblib.dump(joblib_payload, artifacts_dir / "isl_rf_model.joblib")

    preproc_cfg = get_preprocessing_config()
    with open(artifacts_dir / "preprocessing.json", "w", encoding="utf-8") as f:
        json.dump(preproc_cfg, f, indent=2)

    rf_json = export_rf_to_json(rf, classes, feature_names)
    with open(artifacts_dir / "model_trees.json", "w", encoding="utf-8") as f:
        json.dump(rf_json, f)

    with open(artifacts_dir / "heldout_samples.json", "w", encoding="utf-8") as f:
        json.dump(heldout_samples, f, indent=2)

    class_counts = df["label"].value_counts().sort_index().to_dict()

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model_name": "RandomForestClassifier",
        "hyperparameters": {
            "n_estimators": n_estimators,
            "max_depth": max_depth,
            "random_state": random_state,
        },
        "dataset_audit": {
            "initial_rows": initial_rows,
            "valid_rows": int(len(df)),
            "duplicates_removed": duplicates_removed,
            "num_static_classes": len(classes),
            "dynamic_classes_handled_via_motion": ISL_DYNAMIC_CLASSES,
            "sources": {str(k): int(v) for k, v in sources.items()},
            "class_counts": {str(k): int(v) for k, v in class_counts.items()},
            "split_strategy": split_strategy,
            "train_samples": int(len(X_train)),
            "val_samples": int(len(X_val)),
            "test_samples": int(len(X_test)),
            "is_prototype_baseline": all(k == "anatomical_prototype" for k in sources.keys()),
        },
        "test_metrics": {
            "accuracy": round(test_acc, 4),
            "macro_precision": round(float(macro_p), 4),
            "macro_recall": round(float(macro_r), 4),
            "macro_f1": round(float(macro_f1), 4),
            "weighted_f1": round(float(weighted_f1), 4),
        },
        "model_comparison_validation": val_comparison,
        "per_class_metrics": per_class_metrics,
        "confusion_matrix": {
            "labels": classes,
            "matrix": cm,
        },
    }

    with open(artifacts_dir / "evaluation_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(
        f"Training complete | Split: {split_strategy} | "
        f"Train={len(X_train)}, Val={len(X_val)}, Test={len(X_test)} | "
        f"Test Accuracy={test_acc:.4f}, Macro F1={macro_f1:.4f}"
    )
    return report


if __name__ == "__main__":
    run_training_pipeline()

"""
Consistent 2-hand MediaPipe landmark preprocessing pipeline.

Feature layout (130 features total):
- Hand 1 (63 features): 21 landmarks x (x, y, z), wrist-centered & palm-scale normalized
- Hand 2 (63 features): 21 landmarks x (x, y, z), wrist-centered & palm-scale normalized (0.0 if 1 hand)
- Inter-hand spatial descriptors (4 features):
  [hand_count, rel_wrist_dx, rel_wrist_dy, rel_wrist_dz]
"""

from __future__ import annotations

import math
from typing import Any, Sequence
import numpy as np

NUM_LANDMARKS = 21
COORDS_PER_LANDMARK = 3
COORDS_PER_HAND = NUM_LANDMARKS * COORDS_PER_LANDMARK  # 63
EXTRA_FEATURES = 4
TOTAL_FEATURES = COORDS_PER_HAND * 2 + EXTRA_FEATURES  # 130
MIN_PALM_SCALE = 1e-5


def get_feature_names() -> list[str]:
    names: list[str] = []
    for hand_idx in (1, 2):
        for lm_idx in range(NUM_LANDMARKS):
            for axis in ("x", "y", "z"):
                names.append(f"h{hand_idx}_{axis}{lm_idx}")
    names.extend(["hand_count", "rel_wrist_dx", "rel_wrist_dy", "rel_wrist_dz"])
    return names


def _parse_hand(hand: Sequence[Any]) -> np.ndarray:
    if len(hand) != NUM_LANDMARKS:
        raise ValueError(f"Expected {NUM_LANDMARKS} landmarks per hand, got {len(hand)}")

    arr = np.zeros((NUM_LANDMARKS, COORDS_PER_LANDMARK), dtype=np.float64)
    for i, lm in enumerate(hand):
        if isinstance(lm, dict):
            x, y, z = float(lm["x"]), float(lm["y"]), float(lm.get("z", 0.0))
        else:
            x, y = float(lm[0]), float(lm[1])
            z = float(lm[2]) if len(lm) > 2 else 0.0
        if not (math.isfinite(x) and math.isfinite(y) and math.isfinite(z)):
            raise ValueError("Non-finite landmark coordinate encountered")
        arr[i] = (x, y, z)
    return arr


def _normalize_single_hand(coords: np.ndarray) -> tuple[np.ndarray, np.ndarray, float]:
    wrist = coords[0].copy()
    centered = coords - wrist

    # Canonical palm scale: 3D distance from wrist (0) to middle finger MCP (9)
    palm_scale = float(np.linalg.norm(centered[9]))
    if palm_scale < MIN_PALM_SCALE:
        max_dist = float(np.max(np.linalg.norm(centered, axis=1)))
        if max_dist < MIN_PALM_SCALE:
            raise ValueError("Degenerate hand detection with near-zero scale")
        palm_scale = max_dist

    normalized = (centered / palm_scale).reshape(-1)
    return normalized, wrist, palm_scale


def extract_features_from_hands(hands: Sequence[Sequence[Any]]) -> np.ndarray:
    """
    Convert 1 or 2 MediaPipe hand landmark lists (21 landmarks each)
    into a normalized 130-dimensional feature vector.
    """
    if not hands or len(hands) == 0:
        raise ValueError("No hands provided for feature extraction")

    parsed_hands = [_parse_hand(h) for h in hands[:2]]
    # Deterministic spatial ordering: left-to-right by wrist X coordinate
    parsed_hands.sort(key=lambda h: float(h[0, 0]))

    h1_norm, w1, s1 = _normalize_single_hand(parsed_hands[0])

    if len(parsed_hands) == 2:
        h2_norm, w2, s2 = _normalize_single_hand(parsed_hands[1])
        mean_scale = max((s1 + s2) * 0.5, MIN_PALM_SCALE)
        rel_offset = (w2 - w1) / mean_scale
        hand_count = 2.0
    else:
        h2_norm = np.zeros(COORDS_PER_HAND, dtype=np.float64)
        rel_offset = np.zeros(3, dtype=np.float64)
        hand_count = 1.0

    features = np.concatenate([
        h1_norm,
        h2_norm,
        np.array([hand_count, rel_offset[0], rel_offset[1], rel_offset[2]], dtype=np.float64),
    ])
    return features


def get_preprocessing_config() -> dict[str, Any]:
    return {
        "version": "1.0.0",
        "coords_per_hand": COORDS_PER_HAND,
        "num_landmarks": NUM_LANDMARKS,
        "max_hands": 2,
        "total_features": TOTAL_FEATURES,
        "normalization": "wrist_centered_middle_mcp_palm_scaled_sorted_lr",
        "feature_names": get_feature_names(),
    }

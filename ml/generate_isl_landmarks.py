"""
Anatomical 3D Hand-Skeleton Prototype Generator for Authentic ISL A-Z.

Generates realistic 21-landmark MediaPipe hand poses for all 24 static ISL
alphabet classes (1-handed: C, I, L, O, U, V; 2-handed: A, B, D, E, F, G, H,
K, M, N, P, Q, R, S, T, W, X, Y) across multiple simulated signer profiles
(`signer_id` s01..s10) for leak-free GroupShuffleSplit evaluation.

IMPORTANT: This provides a calibrated anatomical prototype baseline so the
application can be demonstrated and tested end-to-end when no physical webcam
or external multi-GB Mendeley image download is available in the cloud.
Production deployment should augment or replace these rows with real human
webcam samples collected via the built-in Data Collection Studio.
"""

from __future__ import annotations

import csv
import math
from pathlib import Path
from typing import Dict, List, Tuple
import numpy as np

from isl_alphabet_spec import ISL_HAND_MODE, ISL_STATIC_CLASSES
from preprocessing import extract_features_from_hands, get_feature_names


# Anatomical hand segment lengths relative to palm size
FINGER_BASES = {
    "thumb": (0.28, -0.24, -0.02),
    "index": (0.22, -0.92, 0.0),
    "middle": (0.02, -1.00, 0.0),
    "ring": (-0.18, -0.94, 0.0),
    "pinky": (-0.36, -0.82, 0.0),
}

FINGER_SEGMENTS = {
    "thumb": (0.26, 0.24, 0.20),
    "index": (0.38, 0.26, 0.20),
    "middle": (0.42, 0.28, 0.22),
    "ring": (0.38, 0.26, 0.20),
    "pinky": (0.30, 0.20, 0.16),
}


def _rot_x(vec: np.ndarray, angle: float) -> np.ndarray:
    c, s = math.cos(angle), math.sin(angle)
    x, y, z = vec
    return np.array([x, y * c - z * s, y * s + z * c])


def _rot_y(vec: np.ndarray, angle: float) -> np.ndarray:
    c, s = math.cos(angle), math.sin(angle)
    x, y, z = vec
    return np.array([x * c + z * s, y, -x * s + z * c])


def _rot_z(vec: np.ndarray, angle: float) -> np.ndarray:
    c, s = math.cos(angle), math.sin(angle)
    x, y, z = vec
    return np.array([x * c - y * s, x * s + y * c, z])


def _build_hand_skeleton(
    curls: Dict[str, float],
    spreads: Dict[str, float] | None = None,
    hand_rot: Tuple[float, float, float] = (0.0, 0.0, 0.0),
    translation: Tuple[float, float, float] = (0.5, 0.65, 0.0),
    scale: float = 0.14,
    mirror_x: bool = False,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    """
    Construct 21 landmarks (x, y, z) following MediaPipe Hands topology:
    0: wrist
    1-4: thumb (CMC, MCP, IP, TIP)
    5-8: index (MCP, PIP, DIP, TIP)
    9-12: middle
    13-16: ring
    17-20: pinky
    """
    spreads = spreads or {}
    pts = np.zeros((21, 3), dtype=np.float64)
    pts[0] = np.array([0.0, 0.0, 0.0])

    finger_order = ["thumb", "index", "middle", "ring", "pinky"]
    idx = 1
    for fname in finger_order:
        bx, by, bz = FINGER_BASES[fname]
        if fname == "thumb":
            # Thumb CMC starts lower on wrist side
            cmc = np.array([0.16, -0.22, -0.02])
            pts[idx] = cmc
            curl = curls.get("thumb", 0.0)
            splay = spreads.get("thumb", 0.35)
            # Direction vectors along thumb segments
            d1 = np.array([math.sin(splay) * 0.9, -math.cos(splay) * 0.85, -0.15])
            d1 /= np.linalg.norm(d1)
            pts[idx + 1] = pts[idx] + d1 * FINGER_SEGMENTS["thumb"][0]

            # Curl bends inward toward palm (+z or -x)
            d2 = _rot_y(d1, curl * 1.15)
            d2 = _rot_x(d2, curl * 0.45)
            pts[idx + 2] = pts[idx + 1] + d2 * FINGER_SEGMENTS["thumb"][1]

            d3 = _rot_y(d2, curl * 0.85)
            pts[idx + 3] = pts[idx + 2] + d3 * FINGER_SEGMENTS["thumb"][2]
            idx += 4
        else:
            mcp = np.array([bx, by, bz])
            pts[idx] = mcp
            curl = curls.get(fname, 0.0)  # 0 = straight up, 1 = curled into palm
            splay = spreads.get(fname, 0.0)

            base_dir = _rot_z(np.array([0.0, -1.0, 0.0]), splay)
            d1 = _rot_x(base_dir, curl * 1.35)
            pts[idx + 1] = pts[idx] + d1 * FINGER_SEGMENTS[fname][0]

            d2 = _rot_x(d1, curl * 1.45)
            pts[idx + 2] = pts[idx + 1] + d2 * FINGER_SEGMENTS[fname][1]

            d3 = _rot_x(d2, curl * 0.95)
            pts[idx + 3] = pts[idx + 2] + d3 * FINGER_SEGMENTS[fname][2]
            idx += 4

    if mirror_x:
        pts[:, 0] = -pts[:, 0]

    # Apply 3D hand orientation and small anatomical noise
    rx, ry, rz = hand_rot
    for i in range(21):
        v = _rot_x(pts[i], rx)
        v = _rot_y(v, ry)
        v = _rot_z(v, rz)
        if rng is not None:
            v = v + rng.normal(0.0, 0.022, size=3)
        pts[i] = v * scale + np.array(translation)

    return pts


def _pose_spec(letter: str) -> List[Dict]:
    """
    Return authentic ISL hand configuration descriptors for each static letter.
    Each descriptor defines 1 or 2 hands with finger curls, splays, 3D rotation, and relative translation.
    """
    open_hand = {"thumb": 0.15, "index": 0.05, "middle": 0.05, "ring": 0.05, "pinky": 0.05}
    fist = {"thumb": 0.75, "index": 0.95, "middle": 0.95, "ring": 0.95, "pinky": 0.95}
    point_index = {"thumb": 0.65, "index": 0.05, "middle": 0.95, "ring": 0.95, "pinky": 0.95}

    specs: Dict[str, List[Dict]] = {
        # 1-handed ISL letters
        "C": [
            {"curls": {"thumb": 0.42, "index": 0.48, "middle": 0.50, "ring": 0.52, "pinky": 0.52},
             "spreads": {"thumb": 0.65}, "rot": (0.1, 1.15, 0.15), "pos": (0.50, 0.64, 0.0), "mirror": False}
        ],
        "I": [
            {"curls": {"thumb": 0.70, "index": 0.95, "middle": 0.95, "ring": 0.95, "pinky": 0.05},
             "spreads": {"pinky": -0.15}, "rot": (0.05, 0.15, 0.0), "pos": (0.50, 0.66, 0.0), "mirror": False}
        ],
        "L": [
            {"curls": {"thumb": 0.05, "index": 0.05, "middle": 0.95, "ring": 0.95, "pinky": 0.95},
             "spreads": {"thumb": 0.95}, "rot": (0.0, 0.05, 0.0), "pos": (0.50, 0.66, 0.0), "mirror": False}
        ],
        "O": [
            {"curls": {"thumb": 0.60, "index": 0.72, "middle": 0.74, "ring": 0.76, "pinky": 0.78},
             "spreads": {"thumb": 0.45}, "rot": (0.15, 0.85, 0.08), "pos": (0.50, 0.64, 0.0), "mirror": False}
        ],
        "U": [
            {"curls": {"thumb": 0.72, "index": 0.05, "middle": 0.05, "ring": 0.95, "pinky": 0.95},
             "spreads": {"index": 0.02, "middle": -0.02}, "rot": (0.0, 0.1, 0.0), "pos": (0.50, 0.66, 0.0), "mirror": False}
        ],
        "V": [
            {"curls": {"thumb": 0.72, "index": 0.05, "middle": 0.05, "ring": 0.95, "pinky": 0.95},
             "spreads": {"index": 0.24, "middle": -0.24}, "rot": (0.0, 0.05, 0.0), "pos": (0.50, 0.66, 0.0), "mirror": False}
        ],

        # 2-handed ISL letters
        "A": [
            {"curls": {"thumb": 0.10, "index": 0.92, "middle": 0.92, "ring": 0.92, "pinky": 0.92},
             "spreads": {"thumb": 0.75}, "rot": (0.1, 0.4, 0.1), "pos": (0.41, 0.65, 0.0), "mirror": True},
            {"curls": point_index, "spreads": {}, "rot": (0.1, -0.5, -0.45), "pos": (0.59, 0.62, -0.03), "mirror": False},
        ],
        "B": [
            {"curls": {"thumb": 0.55, "index": 0.45, "middle": 0.45, "ring": 0.45, "pinky": 0.45},
             "spreads": {"thumb": 0.55}, "rot": (0.05, 0.85, 0.0), "pos": (0.43, 0.64, 0.0), "mirror": True},
            {"curls": {"thumb": 0.55, "index": 0.45, "middle": 0.45, "ring": 0.45, "pinky": 0.45},
             "spreads": {"thumb": 0.55}, "rot": (0.05, -0.85, 0.0), "pos": (0.57, 0.64, 0.0), "mirror": False},
        ],
        "D": [
            {"curls": point_index, "spreads": {}, "rot": (0.0, 0.1, 0.0), "pos": (0.43, 0.66, 0.0), "mirror": True},
            {"curls": {"thumb": 0.45, "index": 0.52, "middle": 0.55, "ring": 0.55, "pinky": 0.55},
             "spreads": {"thumb": 0.65}, "rot": (0.1, -0.95, 0.0), "pos": (0.56, 0.62, -0.02), "mirror": False},
        ],
        "E": [
            {"curls": open_hand, "spreads": {}, "rot": (0.85, 0.25, -0.6), "pos": (0.41, 0.67, 0.03), "mirror": True},
            {"curls": {"thumb": 0.65, "index": 0.55, "middle": 0.55, "ring": 0.55, "pinky": 0.55},
             "spreads": {}, "rot": (0.2, -0.4, 0.9), "pos": (0.57, 0.60, -0.03), "mirror": False},
        ],
        "F": [
            {"curls": {"thumb": 0.60, "index": 0.08, "middle": 0.08, "ring": 0.95, "pinky": 0.95},
             "spreads": {}, "rot": (0.35, 0.2, -0.95), "pos": (0.40, 0.63, 0.02), "mirror": True},
            {"curls": {"thumb": 0.60, "index": 0.08, "middle": 0.08, "ring": 0.95, "pinky": 0.95},
             "spreads": {}, "rot": (-0.25, -0.2, 0.95), "pos": (0.60, 0.62, -0.02), "mirror": False},
        ],
        "G": [
            {"curls": {"thumb": 0.25, "index": 0.35, "middle": 0.85, "ring": 0.85, "pinky": 0.85},
             "spreads": {"thumb": 0.65}, "rot": (0.35, 0.4, 0.25), "pos": (0.42, 0.63, 0.01), "mirror": True},
            {"curls": {"thumb": 0.45, "index": 0.55, "middle": 0.92, "ring": 0.92, "pinky": 0.92},
             "spreads": {"thumb": 0.5}, "rot": (0.35, -0.4, -0.25), "pos": (0.58, 0.63, -0.01), "mirror": False},
        ],
        "H": [
            {"curls": open_hand, "spreads": {}, "rot": (1.15, 0.1, -0.35), "pos": (0.42, 0.68, 0.02), "mirror": True},
            {"curls": open_hand, "spreads": {}, "rot": (0.65, -0.25, 0.85), "pos": (0.56, 0.59, -0.04), "mirror": False},
        ],
        "K": [
            {"curls": point_index, "spreads": {}, "rot": (0.0, 0.15, 0.05), "pos": (0.43, 0.67, 0.0), "mirror": True},
            {"curls": {"thumb": 0.55, "index": 0.35, "middle": 0.35, "ring": 0.92, "pinky": 0.92},
             "spreads": {"index": 0.28, "middle": -0.28}, "rot": (0.1, -0.2, 0.75), "pos": (0.56, 0.60, -0.02), "mirror": False},
        ],
        "M": [
            {"curls": open_hand, "spreads": {}, "rot": (1.20, 0.1, -0.25), "pos": (0.42, 0.69, 0.03), "mirror": True},
            {"curls": {"thumb": 0.72, "index": 0.18, "middle": 0.18, "ring": 0.18, "pinky": 0.92},
             "spreads": {}, "rot": (0.95, -0.15, 0.75), "pos": (0.57, 0.60, -0.04), "mirror": False},
        ],
        "N": [
            {"curls": open_hand, "spreads": {}, "rot": (1.20, 0.1, -0.25), "pos": (0.42, 0.69, 0.03), "mirror": True},
            {"curls": {"thumb": 0.72, "index": 0.18, "middle": 0.18, "ring": 0.92, "pinky": 0.92},
             "spreads": {}, "rot": (0.95, -0.15, 0.75), "pos": (0.57, 0.60, -0.04), "mirror": False},
        ],
        "P": [
            {"curls": point_index, "spreads": {}, "rot": (0.05, 0.15, 0.0), "pos": (0.43, 0.67, 0.0), "mirror": True},
            {"curls": {"thumb": 0.55, "index": 0.62, "middle": 0.92, "ring": 0.92, "pinky": 0.92},
             "spreads": {"thumb": 0.45}, "rot": (0.15, -0.55, 0.35), "pos": (0.55, 0.58, -0.02), "mirror": False},
        ],
        "Q": [
            {"curls": {"thumb": 0.55, "index": 0.65, "middle": 0.68, "ring": 0.70, "pinky": 0.72},
             "spreads": {"thumb": 0.50}, "rot": (0.15, 0.55, 0.1), "pos": (0.43, 0.63, 0.01), "mirror": True},
            {"curls": point_index, "spreads": {}, "rot": (0.2, -0.35, 2.35), "pos": (0.57, 0.57, -0.02), "mirror": False},
        ],
        "R": [
            {"curls": open_hand, "spreads": {}, "rot": (1.05, 0.15, -0.20), "pos": (0.42, 0.68, 0.03), "mirror": True},
            {"curls": {"thumb": 0.70, "index": 0.42, "middle": 0.92, "ring": 0.92, "pinky": 0.92},
             "spreads": {}, "rot": (0.65, -0.25, 0.60), "pos": (0.56, 0.59, -0.03), "mirror": False},
        ],
        "S": [
            {"curls": {"thumb": 0.45, "index": 0.55, "middle": 0.55, "ring": 0.55, "pinky": 0.15},
             "spreads": {}, "rot": (0.25, 0.75, 0.45), "pos": (0.43, 0.64, 0.01), "mirror": True},
            {"curls": {"thumb": 0.45, "index": 0.55, "middle": 0.55, "ring": 0.55, "pinky": 0.15},
             "spreads": {}, "rot": (0.25, -0.75, -0.45), "pos": (0.57, 0.64, -0.01), "mirror": False},
        ],
        "T": [
            {"curls": point_index, "spreads": {}, "rot": (0.05, 0.25, 0.0), "pos": (0.42, 0.66, 0.0), "mirror": True},
            {"curls": point_index, "spreads": {}, "rot": (0.1, -0.2, 1.48), "pos": (0.56, 0.54, -0.02), "mirror": False},
        ],
        "W": [
            {"curls": {"thumb": 0.20, "index": 0.15, "middle": 0.15, "ring": 0.15, "pinky": 0.20},
             "spreads": {"index": 0.22, "ring": -0.18, "pinky": -0.35}, "rot": (0.2, 0.55, 0.25), "pos": (0.42, 0.65, 0.01), "mirror": True},
            {"curls": {"thumb": 0.20, "index": 0.15, "middle": 0.15, "ring": 0.15, "pinky": 0.20},
             "spreads": {"index": 0.22, "ring": -0.18, "pinky": -0.35}, "rot": (0.2, -0.55, -0.25), "pos": (0.58, 0.65, -0.01), "mirror": False},
        ],
        "X": [
            {"curls": point_index, "spreads": {}, "rot": (0.05, 0.15, -0.65), "pos": (0.42, 0.65, 0.02), "mirror": True},
            {"curls": point_index, "spreads": {}, "rot": (0.05, -0.15, 0.65), "pos": (0.58, 0.65, -0.02), "mirror": False},
        ],
        "Y": [
            {"curls": {"thumb": 0.05, "index": 0.15, "middle": 0.90, "ring": 0.90, "pinky": 0.90},
             "spreads": {"thumb": 0.75}, "rot": (0.15, 0.3, 0.15), "pos": (0.42, 0.66, 0.01), "mirror": True},
            {"curls": point_index, "spreads": {}, "rot": (0.15, -0.3, 0.55), "pos": (0.58, 0.61, -0.02), "mirror": False},
        ],
    }
    return specs[letter]


def generate_dataset(
    output_csv: Path,
    samples_per_signer: int = 8,
    num_signers: int = 10,
    seed: int = 42,
) -> Path:
    rng = np.random.default_rng(seed)
    output_csv.parent.mkdir(parents=True, exist_ok=True)

    feature_names = get_feature_names()
    header = ["label", "hand_mode", "signer_id", "source"] + feature_names

    rows: List[List] = []
    for letter in ISL_STATIC_CLASSES:
        hand_mode = ISL_HAND_MODE[letter]
        hand_specs = _pose_spec(letter)

        for signer_idx in range(1, num_signers + 1):
            signer_id = f"s{signer_idx:02d}"
            # Per-signer anatomical scale & global pose variation
            signer_scale = float(rng.uniform(0.11, 0.17))
            signer_tilt = rng.normal(0.0, 0.10, size=3)

            for _ in range(samples_per_signer):
                sample_jitter_pos = rng.normal(0.0, 0.025, size=3)
                hands_landmarks = []
                for hs in hand_specs:
                    # Add slight realistic pose variance
                    curls = {
                        k: float(np.clip(v + rng.normal(0.0, 0.045), 0.0, 1.0))
                        for k, v in hs["curls"].items()
                    }
                    rot = (
                        hs["rot"][0] + float(signer_tilt[0] + rng.normal(0.0, 0.08)),
                        hs["rot"][1] + float(signer_tilt[1] + rng.normal(0.0, 0.08)),
                        hs["rot"][2] + float(signer_tilt[2] + rng.normal(0.0, 0.08)),
                    )
                    pos = (
                        hs["pos"][0] + float(sample_jitter_pos[0] + rng.normal(0.0, 0.012)),
                        hs["pos"][1] + float(sample_jitter_pos[1] + rng.normal(0.0, 0.012)),
                        hs["pos"][2] + float(sample_jitter_pos[2]),
                    )
                    pts = _build_hand_skeleton(
                        curls=curls,
                        spreads=hs.get("spreads"),
                        hand_rot=rot,
                        translation=pos,
                        scale=signer_scale * float(rng.uniform(0.95, 1.05)),
                        mirror_x=hs["mirror"],
                        rng=rng,
                    )
                    hands_landmarks.append(pts)

                features = extract_features_from_hands(hands_landmarks)
                rows.append([letter, hand_mode, signer_id, "anatomical_prototype"] + [round(float(v), 6) for v in features])

    with open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)

    print(f"Generated {len(rows)} samples across {len(ISL_STATIC_CLASSES)} static ISL classes -> {output_csv}")
    return output_csv


if __name__ == "__main__":
    base = Path(__file__).resolve().parent
    generate_dataset(base / "data" / "isl_landmarks.csv")

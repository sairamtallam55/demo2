"""
Offline OpenCV + MediaPipe Image Dataset Landmark Extractor.

Use this script locally or on a GPU/CPU workstation to extract 130-dimensional
normalized two-hand landmark features from public ISL image datasets
(e.g., Mendeley Static ISL, ISLAN, THISL, or Kaggle ISL directories organized
as dataset_dir/<ALPHABET>/<image>.jpg).
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import List

from isl_alphabet_spec import ISL_HAND_MODE, ISL_STATIC_CLASSES
from preprocessing import extract_features_from_hands, get_feature_names


def extract_directory_to_csv(dataset_dir: Path, output_csv: Path, signer_id: str = "image_corpus") -> int:
    try:
        import cv2
        import mediapipe as mp
    except ImportError as exc:
        raise RuntimeError(
            "Offline image extraction requires `opencv-python` and `mediapipe`. "
            "Install via: pip install opencv-python mediapipe"
        ) from exc

    mp_hands = mp.solutions.hands
    feature_names = get_feature_names()
    header = ["label", "hand_mode", "signer_id", "source"] + feature_names
    written = 0

    with mp_hands.Hands(
        static_image_mode=True,
        max_num_hands=2,
        min_detection_confidence=0.5,
    ) as hands, open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)

        for label in ISL_STATIC_CLASSES:
            class_dir = dataset_dir / label
            if not class_dir.is_dir():
                continue
            for img_path in sorted(class_dir.iterdir()):
                if img_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".bmp"}:
                    continue
                img = cv2.imread(str(img_path))
                if img is None:
                    continue
                rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                res = hands.process(rgb)
                if not res.multi_hand_landmarks:
                    continue
                hand_lists: List[List[List[float]]] = []
                for h_lm in res.multi_hand_landmarks[:2]:
                    hand_lists.append([[lm.x, lm.y, lm.z] for lm in h_lm.landmark])
                try:
                    feats = extract_features_from_hands(hand_lists)
                except ValueError:
                    continue
                writer.writerow(
                    [label, ISL_HAND_MODE[label], signer_id, "extracted_image_corpus"]
                    + [round(float(v), 6) for v in feats]
                )
                written += 1
    return written


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract MediaPipe 2-hand landmarks from ISL image folders")
    parser.add_argument("--input", type=Path, required=True, help="Root folder containing A..Z subdirectories")
    parser.add_argument("--output", type=Path, default=Path("ml/data/extracted_isl.csv"))
    parser.add_argument("--signer", type=str, default="image_corpus")
    args = parser.parse_args()
    count = extract_directory_to_csv(args.input, args.output, args.signer)
    print(f"Extracted {count} valid landmark samples -> {args.output}")

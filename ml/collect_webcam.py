"""
Offline OpenCV + MediaPipe Webcam Landmark Collector.

Use this script locally on a computer with a webcam to record real human
ISL alphabet samples into `ml/data/isl_landmarks.csv`.
(For browser-based cloud collection without local Python setup, use the
Collect & Train studio inside the web application.)
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import List

from isl_alphabet_spec import ISL_HAND_MODE, ISL_STATIC_CLASSES
from preprocessing import extract_features_from_hands, get_feature_names


def collect_from_webcam(label: str, num_samples: int, signer_id: str, output_csv: Path) -> None:
    label = label.strip().upper()
    if label not in ISL_STATIC_CLASSES:
        raise ValueError(f"Label must be one of static ISL classes {ISL_STATIC_CLASSES}")

    try:
        import cv2
        import mediapipe as mp
    except ImportError as exc:
        raise RuntimeError(
            "Offline webcam collection requires `opencv-python` and `mediapipe`."
        ) from exc

    file_exists = output_csv.exists()
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    feature_names = get_feature_names()

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Could not open webcam device 0")

    mp_hands = mp.solutions.hands
    mp_draw = mp.solutions.drawing_utils
    collected = 0
    recording = False

    with mp_hands.Hands(max_num_hands=2, min_detection_confidence=0.6) as hands, open(
        output_csv, "a", newline="", encoding="utf-8"
    ) as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["label", "hand_mode", "signer_id", "source"] + feature_names)

        while collected < num_samples:
            ok, frame = cap.read()
            if not ok:
                break
            frame = cv2.flip(frame, 1)
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            res = hands.process(rgb)

            if res.multi_hand_landmarks:
                for h_lm in res.multi_hand_landmarks[:2]:
                    mp_draw.draw_landmarks(frame, h_lm, mp_hands.HAND_CONNECTIONS)
                if recording:
                    hand_lists: List[List[List[float]]] = [
                        [[lm.x, lm.y, lm.z] for lm in h_lm.landmark]
                        for h_lm in res.multi_hand_landmarks[:2]
                    ]
                    try:
                        feats = extract_features_from_hands(hand_lists)
                        writer.writerow(
                            [label, ISL_HAND_MODE[label], signer_id, "webcam_local"]
                            + [round(float(v), 6) for v in feats]
                        )
                        collected += 1
                    except ValueError:
                        pass

            status = f"Label {label} | {collected}/{num_samples} | {'RECORDING' if recording else 'Press R to record, Q to quit'}"
            cv2.putText(frame, status, (16, 36), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 180, 120), 2)
            cv2.imshow("MudraLab ISL Local Collector", frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("r"):
                recording = not recording
            elif key == ord("q"):
                break

    cap.release()
    cv2.destroyAllWindows()
    print(f"Saved {collected} webcam samples for '{label}' -> {output_csv}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Collect real ISL hand landmarks from local webcam")
    parser.add_argument("--label", required=True, help="Target alphabet (A-I, K-Y)")
    parser.add_argument("--samples", type=int, default=40)
    parser.add_argument("--signer", default="local_user")
    parser.add_argument("--output", type=Path, default=Path("ml/data/isl_landmarks.csv"))
    args = parser.parse_args()
    collect_from_webcam(args.label, args.samples, args.signer, args.output)

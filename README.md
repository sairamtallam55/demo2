# MudraLab ISL — Indian Sign Language Real-Time Hand Gesture Recognition

An end-to-end web application that recognizes authentic **Indian Sign Language (ISL)** alphabet gestures (A–Z) using **MediaPipe 21-point hand landmarks** and a **Scikit-Learn Random Forest** classifier served via a **Python Flask REST API** and **Node/Express** full-stack bridge.

## Authentic ISL vs. ASL

Unlike American Sign Language (ASL), which is strictly one-handed, authentic Indian Sign Language (standardized by ISLRTC and documented in corpora such as ISLAN and THISL) combines:
- **6 One-Handed (Unimanual) Signs:** `C, I, L, O, U, V`
- **18 Two-Handed (Bimanual) Signs:** `A, B, D, E, F, G, H, K, M, N, P, Q, R, S, T, W, X, Y`
- **2 Dynamic Motion Signs:** `J, Z` (classified via temporal finger-tip trajectory detection rather than static frames)

Because ISL requires two-hand interactions, MudraLab tracks up to **2 hands simultaneously** (`21 × 3 = 63` coordinates per hand, normalized relative to wrist & palm scale + inter-hand wrist offset = **130 features total**).

## Project Folder Structure

```
├── backend/app.py                  # Python Flask REST API (predict, dataset, train, evaluate)
├── ml/
│   ├── isl_alphabet_spec.py        # Authentic ISL A-Z handedness & dynamic class definitions
│   ├── preprocessing.py            # Canonical 130-feature wrist/palm normalization
│   ├── generate_isl_landmarks.py   # Calibrated anatomical 3D prototype generator (10 signers)
│   ├── extract_from_images.py      # Offline OpenCV + MediaPipe image dataset extractor
│   ├── collect_webcam.py           # Offline OpenCV + MediaPipe local webcam collector
│   ├── train.py                    # Leak-free GroupShuffleSplit + RF/ExtraTrees/MLP pipeline
│   ├── data/isl_landmarks.csv      # Labeled landmark dataset CSV
│   └── artifacts/                  # Saved joblib model, JSON trees, preprocessing & evaluation report
├── server.ts                       # Express server (port 3000) bridging Vite + Flask + TS RF parity
├── src/
│   ├── components/                 # TopBar, HomeView, LiveRecognitionView, CollectTrainView, LearnIslView, AboutProjectView
│   ├── data/islAlphabet.ts         # Authentic ISL A-Z study guide & instructions
│   ├── utils/landmarks.ts          # TS preprocessing parity, PredictionSmoother, J/Z motion detector
│   └── server/rfEngine.ts          # TS Random Forest tree evaluator for Node-only Cloud Run parity
└── tests/test_ml_and_api.py        # Pytest suite for ML pipeline & Flask API
```

## Setup & Execution

### 1. Install Dependencies
```bash
npm install
pip install -r requirements.txt
```

### 2. Generate Prototype Baseline & Train Model
```bash
python3 ml/generate_isl_landmarks.py
python3 ml/train.py
```

### 3. Run Full-Stack Application
```bash
npm run dev
```
Open `https://localhost:3000` (HTTPS is required in production for browser webcam `getUserMedia` access).

## REST API Reference

- `GET /api/health` — Returns backend engine status and supported classes.
- `POST /api/predict` — Accepts `{ "hands": [...] }` or `{ "features": [130 floats] }` plus optional `confidence_threshold`. Returns predicted label, confidence, top-3 candidates, and `uncertain` flag.
- `GET /api/evaluate` — Returns test metrics, validation model comparison, and 24×24 confusion matrix.
- `GET /api/dataset` — Returns sample counts per class and data sources.
- `POST /api/dataset/sample` — Saves validated 21-point MediaPipe landmarks into `ml/data/isl_landmarks.csv`.
- `POST /api/train` — Retrains the Scikit-Learn Random Forest model and hot-reloads artifacts.
- `GET /api/sample-frame/:letter` — Returns a held-out test split feature vector for static verification.

## Testing

```bash
# Python ML & Flask API tests
pytest -v tests/test_ml_and_api.py

# TypeScript pure logic & RF parity tests
npx --yes tsx --test src/utils/landmarks.test.ts src/server/rfEngine.test.ts
```

## Dataset Transparency & Manual Physical Webcam Testing

- **Prototype Baseline Disclosure:** The shipped model is trained on a calibrated 3D anatomical prototype dataset (`1,920` samples across 10 simulated signers) so all 24 static ISL classes can be tested end-to-end without bundling multi-GB Mendeley image archives.
- **Real Webcam Calibration:** Use the **Collect & Train** tab (or `ml/collect_webcam.py` / `ml/extract_from_images.py` with Mendeley/ISLAN/THISL image datasets) to record real human webcam samples before production use.
- **Physical Webcam Check:** In headless cloud environments without a hardware webcam, automated tests verify camera error/idle handling and held-out test samples. On a laptop/phone with a camera, open **Live Studio**, grant camera permission, test `C` (1-hand), `B` (2-hand), and `J`/`Z` (motion), and verify stable recognition without flickering.

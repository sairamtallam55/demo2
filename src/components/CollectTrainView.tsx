import { Camera, CameraOff, CheckCircle2, Database, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ISL_ALPHABET_GUIDE } from '../data/islAlphabet';
import type { Landmark3D } from '../utils/landmarks';
import { drawHandLandmarks, getHandLandmarker } from '../utils/mediapipeClient';

interface DatasetSummary {
  total_samples: number;
  class_counts: Record<string, number>;
  sources: Record<string, number>;
  custom_samples: number;
  static_classes: string[];
}

const STATIC_GUIDES = ISL_ALPHABET_GUIDE.filter((g) => g.handMode !== 'dynamic');

export function CollectTrainView() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const latestHandsRef = useRef<Landmark3D[][]>([]);
  const lastSavedSigRef = useRef<string>('');

  const [selectedLabel, setSelectedLabel] = useState<string>('A');
  const [signerId, setSignerId] = useState<string>('user_01');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [handsCount, setHandsCount] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [dataset, setDataset] = useState<DatasetSummary | null>(null);
  const [loadingDataset, setLoadingDataset] = useState<boolean>(true);
  const [training, setTraining] = useState<boolean>(false);
  const [trainResult, setTrainResult] = useState<string | null>(null);

  const fetchDataset = useCallback(async () => {
    setLoadingDataset(true);
    try {
      const res = await fetch('/api/dataset');
      if (res.ok) {
        const data = (await res.json()) as DatasetSummary;
        setDataset(data);
      }
    } catch {
      // Ignore transient load error
    } finally {
      setLoadingDataset(false);
    }
  }, []);

  useEffect(() => {
    void fetchDataset();
  }, [fetchDataset]);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    latestHandsRef.current = [];
    setHandsCount(0);
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setErrorMessage(null);
    setStatusMessage('Initializing camera & MediaPipe...');
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage('Camera API unavailable in this browser context.');
      setStatusMessage(null);
      return;
    }
    try {
      const [stream, landmarker] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 }, audio: false }),
        getHandLandmarker(),
      ]);
      streamRef.current = stream;
      const vid = videoRef.current;
      if (!vid) return;
      vid.srcObject = stream;
      await vid.play();
      setCameraActive(true);
      setStatusMessage('Camera ready. Form the selected ISL gesture and click Capture Sample.');

      const loop = () => {
        const v = videoRef.current;
        const c = canvasRef.current;
        if (!v || !c || !streamRef.current) return;
        if (v.readyState >= 2) {
          c.width = v.videoWidth || 640;
          c.height = v.videoHeight || 360;
          const res = landmarker.detectForVideo(v, performance.now());
          const extracted = drawHandLandmarks(c, res, true);
          latestHandsRef.current = extracted;
          setHandsCount(extracted.length);
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      stopCamera();
      setErrorMessage(err instanceof Error ? err.message : 'Unable to start webcam');
      setStatusMessage(null);
    }
  }, [stopCamera]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const captureSingleSample = async () => {
    setErrorMessage(null);
    const hands = latestHandsRef.current;
    if (!hands || hands.length === 0) {
      setErrorMessage('No hand detected in the current frame. Hold your hand clearly in view.');
      return;
    }
    const sig = JSON.stringify(hands[0].slice(0, 3).map((p) => [p.x.toFixed(3), p.y.toFixed(3)]));
    if (sig === lastSavedSigRef.current) {
      setErrorMessage('Duplicate frame detected — slightly shift hand angle or distance before saving.');
      return;
    }

    try {
      const res = await fetch('/api/dataset/sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: selectedLabel, hands, signer_id: signerId }),
      });
      const data = (await res.json()) as { error?: string; hand_count?: number };
      if (!res.ok) throw new Error(data.error || 'Failed to save sample');
      lastSavedSigRef.current = sig;
      setStatusMessage(
        `Saved 1 sample for ISL '${selectedLabel}' (${data.hand_count} hand${data.hand_count === 2 ? 's' : ''}).`
      );
      await fetchDataset();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const handleRetrain = async () => {
    setTraining(true);
    setErrorMessage(null);
    setTrainResult(null);
    try {
      const res = await fetch('/api/train', { method: 'POST' });
      const data = (await res.json()) as {
        error?: string;
        evaluation?: { test_metrics: { accuracy: number; macro_f1: number } };
      };
      if (!res.ok) throw new Error(data.error || 'Training failed');
      const acc = data.evaluation?.test_metrics.accuracy ?? 0;
      const f1 = data.evaluation?.test_metrics.macro_f1 ?? 0;
      setTrainResult(
        `Model retrained cleanly — Test Accuracy: ${(acc * 100).toFixed(2)}% · Macro F1: ${(f1 * 100).toFixed(2)}%`
      );
      await fetchDataset();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Retraining requires the Python Flask backend (available locally and in this dev container).'
      );
    } finally {
      setTraining(false);
    }
  };

  const handleClearCustom = async () => {
    try {
      await fetch('/api/dataset/custom', { method: 'DELETE' });
      setStatusMessage('Cleared custom webcam-collected samples; prototype baseline retained.');
      await fetchDataset();
    } catch {
      setErrorMessage('Failed to clear custom samples');
    }
  };

  const activeGuide = STATIC_GUIDES.find((g) => g.letter === selectedLabel) ?? STATIC_GUIDES[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
          Landmark Data Collection & Model Training
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Record labeled 21-point MediaPipe hand landmarks across different lighting conditions and
          hand angles directly into <code className="text-xs">ml/data/isl_landmarks.csv</code>, then
          retrain the Scikit-Learn Random Forest classifier.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Webcam Collector */}
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-xs font-medium text-slate-700">
                Target Alphabet Class (Static A–I, K–Y)
                <select
                  value={selectedLabel}
                  onChange={(e) => setSelectedLabel(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                >
                  {STATIC_GUIDES.map((g) => (
                    <option key={g.letter} value={g.letter}>
                      {g.letter} — {g.handMode}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium text-slate-700">
                Signer Session ID (prevents split leakage)
                <input
                  type="text"
                  value={signerId}
                  onChange={(e) => setSignerId(e.target.value)}
                  placeholder="e.g. user_01"
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
            </div>

            {/* Posture Reminder */}
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">
                ISL {activeGuide.letter}: {activeGuide.postureTitle}
              </p>
              <p className="mt-1 text-slate-600">{activeGuide.instructions[0]}</p>
            </div>

            {/* Preview Box */}
            <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-lg bg-slate-900">
              <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                  <Camera className="h-8 w-8 text-teal-400" aria-hidden="true" />
                  <p className="mt-2 text-xs">Start collection camera to record landmarks</p>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                {!cameraActive ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                  >
                    <Camera className="h-4 w-4" aria-hidden="true" />
                    Start Collector Camera
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <CameraOff className="h-4 w-4" aria-hidden="true" />
                    Stop Camera
                  </button>
                )}

                <button
                  type="button"
                  onClick={captureSingleSample}
                  disabled={!cameraActive}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
                >
                  Capture Landmark Sample
                </button>
              </div>

              <span className="text-xs font-medium text-slate-600 tabular-nums">
                Detected: {handsCount} {handsCount === 1 ? 'hand' : 'hands'}
              </span>
            </div>

            {statusMessage && (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                {statusMessage}
              </p>
            )}
            {errorMessage && (
              <p role="alert" className="mt-3 text-xs font-medium text-rose-700">
                {errorMessage}
              </p>
            )}
          </div>
        </div>

        {/* Right: Dataset Inventory + Retrain */}
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-slate-900">
                <Database className="h-4 w-4 text-teal-700" aria-hidden="true" />
                CSV Dataset Inventory
              </h2>
              <button
                type="button"
                onClick={fetchDataset}
                className="text-xs font-medium text-teal-700 hover:text-teal-800"
              >
                Refresh
              </button>
            </div>

            {loadingDataset || !dataset ? (
              <p className="mt-4 text-xs text-slate-500">Loading dataset inventory...</p>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-3 gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-xs text-slate-500">Total Samples</p>
                    <p className="mt-0.5 font-display text-xl font-bold text-slate-900 tabular-nums">
                      {dataset.total_samples.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Static Classes</p>
                    <p className="mt-0.5 font-display text-xl font-bold text-slate-900 tabular-nums">
                      {Object.keys(dataset.class_counts).length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Custom Webcam</p>
                    <p className="mt-0.5 font-display text-xl font-bold text-teal-700 tabular-nums">
                      {dataset.custom_samples}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-medium text-slate-500">Samples Per Class</p>
                  <div className="mt-2 grid grid-cols-6 gap-1.5">
                    {STATIC_GUIDES.map((g) => (
                      <button
                        key={g.letter}
                        type="button"
                        onClick={() => setSelectedLabel(g.letter)}
                        className={`rounded border px-2 py-1.5 text-center text-xs transition-colors ${
                          selectedLabel === g.letter
                            ? 'border-teal-700 bg-teal-50 font-semibold text-teal-900'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="font-display font-bold">{g.letter}</div>
                        <div className="font-mono text-[10px] text-slate-500 tabular-nums">
                          {dataset.class_counts[g.letter] ?? 0}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6 space-y-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={handleRetrain}
                    disabled={training}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${training ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    {training ? 'Training Random Forest Model...' : 'Retrain Random Forest Model'}
                  </button>

                  {dataset.custom_samples > 0 && (
                    <button
                      type="button"
                      onClick={handleClearCustom}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Reset Custom Webcam Samples
                    </button>
                  )}

                  {trainResult && (
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
                      {trainResult}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

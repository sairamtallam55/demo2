import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  Copy,
  Delete,
  FlaskConical,
  Hand,
  HelpCircle,
  RotateCcw,
  Space,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DynamicMotionDetector,
  PredictionSmoother,
  extractFeaturesFromHands,
  type Landmark3D,
  type SmoothedResult,
} from '../utils/landmarks';
import { drawHandLandmarks, getHandLandmarker } from '../utils/mediapipeClient';

export interface HistoryEntry {
  id: string;
  letter: string;
  confidence: number;
  handMode: string;
  source: 'webcam' | 'motion' | 'sample-test';
  timestamp: string;
}

interface TopPrediction {
  label: string;
  confidence: number;
  hand_mode: string;
}

interface PredictApiResponse {
  predicted_label: string | null;
  raw_top_label: string;
  confidence: number;
  uncertain: boolean;
  threshold: number;
  hand_count: number;
  expected_hand_mode: string;
  top_predictions: TopPrediction[];
  engine?: string;
}

const STATIC_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
  'T', 'U', 'V', 'W', 'X', 'Y',
];

export function LiveRecognitionView() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastInferenceAtRef = useRef<number>(0);
  const lastCommittedRef = useRef<{ label: string; time: number }>({ label: '', time: 0 });
  const smootherRef = useRef<PredictionSmoother>(new PredictionSmoother(6, 4));
  const motionRef = useRef<DynamicMotionDetector>(new DynamicMotionDetector());
  const inflightRef = useRef<boolean>(false);

  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'active' | 'error'>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [mirrored, setMirrored] = useState<boolean>(true);
  const [intervalMs, setIntervalMs] = useState<number>(200);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.55);

  const [handsDetected, setHandsDetected] = useState<number>(0);
  const [smoothed, setSmoothed] = useState<SmoothedResult>({
    stableLabel: null,
    confidence: 0,
    isStable: false,
    status: 'no-hand',
  });
  const [topPredictions, setTopPredictions] = useState<TopPrediction[]>([]);
  const [rawTopLabel, setRawTopLabel] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [activeEngine, setActiveEngine] = useState<string>('python-flask-sklearn');

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sequenceText, setSequenceText] = useState<string>('');
  const [selectedTestLetter, setSelectedTestLetter] = useState<string>('B');
  const [testRunning, setTestRunning] = useState<boolean>(false);
  const [copiedBanner, setCopiedBanner] = useState<boolean>(false);

  const commitLetter = useCallback(
    (letter: string, confidence: number, handMode: string, source: HistoryEntry['source']) => {
      const now = Date.now();
      // Cooldown prevents repeating the same held letter rapidly
      if (
        source !== 'sample-test' &&
        lastCommittedRef.current.label === letter &&
        now - lastCommittedRef.current.time < 1600
      ) {
        return;
      }
      lastCommittedRef.current = { label: letter, time: now };
      setSequenceText((prev) => prev + letter);
      setHistory((prev) => [
        {
          id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
          letter,
          confidence,
          handMode,
          source,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        },
        ...prev.slice(0, 49),
      ]);
    },
    []
  );

  const callPredictApi = useCallback(
    async (
      payload: { hands?: Landmark3D[][]; features?: number[] },
      source: 'webcam' | 'sample-test'
    ) => {
      if (inflightRef.current && source === 'webcam') return;
      inflightRef.current = true;
      const t0 = performance.now();
      try {
        const res = await fetch('/api/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            confidence_threshold: confidenceThreshold,
          }),
        });
        const data = (await res.json()) as PredictApiResponse & { error?: string };
        if (!res.ok) {
          throw new Error(data.error || `API returned status ${res.status}`);
        }
        setLatencyMs(Math.round(performance.now() - t0));
        setBackendError(null);
        if (data.engine) setActiveEngine(data.engine);
        setTopPredictions(data.top_predictions ?? []);
        setRawTopLabel(data.raw_top_label);

        if (source === 'sample-test') {
          // Run single test sample through smoother consensus check or immediate display
          smootherRef.current.reset();
          const finalResult: SmoothedResult = {
            stableLabel: data.uncertain ? null : data.predicted_label,
            confidence: data.confidence,
            isStable: !data.uncertain,
            status: data.uncertain ? 'uncertain' : 'confident',
          };
          setSmoothed(finalResult);
          if (!data.uncertain && data.predicted_label) {
            commitLetter(
              data.predicted_label,
              data.confidence,
              data.expected_hand_mode,
              'sample-test'
            );
          }
        } else {
          const nextSmoothed = smootherRef.current.push({
            label: data.predicted_label,
            confidence: data.confidence,
            uncertain: data.uncertain,
          });
          setSmoothed(nextSmoothed);
          if (nextSmoothed.isStable && nextSmoothed.stableLabel) {
            commitLetter(
              nextSmoothed.stableLabel,
              nextSmoothed.confidence,
              data.expected_hand_mode,
              'webcam'
            );
          }
        }
      } catch (err) {
        setBackendError(err instanceof Error ? err.message : 'Prediction API unreachable');
      } finally {
        inflightRef.current = false;
      }
    },
    [commitLetter, confidenceThreshold]
  );

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    smootherRef.current.reset();
    motionRef.current.reset();
    setHandsDetected(0);
    setCameraState('idle');
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setBackendError(null);
    setCameraState('starting');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState('error');
      setCameraError(
        'Webcam API (navigator.mediaDevices.getUserMedia) is unavailable in this browser context. Ensure HTTPS is active or use the Held-Out Test Landmark runner below.'
      );
      return;
    }

    try {
      const [stream, landmarker] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' },
          audio: false,
        }),
        getHandLandmarker(),
      ]);

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      setCameraState('active');

      const renderLoop = () => {
        const vid = videoRef.current;
        const canvas = canvasRef.current;
        if (!vid || !canvas || !streamRef.current) return;

        if (vid.readyState >= 2) {
          if (canvas.width !== vid.videoWidth || canvas.height !== vid.videoHeight) {
            canvas.width = vid.videoWidth || 640;
            canvas.height = vid.videoHeight || 360;
          }

          const nowMs = performance.now();
          const result = landmarker.detectForVideo(vid, nowMs);
          const extractedHands = drawHandLandmarks(canvas, result, mirrored);
          setHandsDetected(extractedHands.length);

          if (extractedHands.length === 0) {
            motionRef.current.reset();
            setSmoothed(smootherRef.current.push(null));
          } else {
            // Check dynamic J/Z trajectories when 1 hand is extended
            if (extractedHands.length === 1) {
              const motionRes = motionRef.current.pushHand(extractedHands[0]);
              if (motionRes.detected) {
                setSmoothed({
                  stableLabel: motionRes.detected,
                  confidence: motionRes.confidence,
                  isStable: true,
                  status: 'confident',
                });
                commitLetter(motionRes.detected, motionRes.confidence, 'dynamic', 'motion');
              }
            } else {
              motionRef.current.reset();
            }

            if (nowMs - lastInferenceAtRef.current >= intervalMs) {
              lastInferenceAtRef.current = nowMs;
              try {
                const features = extractFeaturesFromHands(extractedHands);
                void callPredictApi({ features }, 'webcam');
              } catch {
                // Degenerate frame skipped safely
              }
            }
          }
        }

        rafRef.current = requestAnimationFrame(renderLoop);
      };

      rafRef.current = requestAnimationFrame(renderLoop);
    } catch (err) {
      stopCamera();
      setCameraState('error');
      const msg = err instanceof Error ? err.message : 'Unable to start webcam';
      setCameraError(
        msg.includes('Permission') || msg.includes('NotAllowed')
          ? 'Camera permission was denied. Allow camera access in your browser site settings and click Restart Camera.'
          : `Could not access webcam (${msg}). You can still verify the ML backend below using held-out test landmarks.`
      );
    }
  }, [callPredictApi, commitLetter, intervalMs, mirrored, stopCamera]);

  const restartCamera = useCallback(async () => {
    stopCamera();
    await new Promise((r) => setTimeout(r, 150));
    await startCamera();
  }, [startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const runHeldoutSampleTest = async () => {
    setTestRunning(true);
    setBackendError(null);
    try {
      const res = await fetch(`/api/sample-frame/${selectedTestLetter}`);
      const data = (await res.json()) as { features?: number[]; error?: string };
      if (!res.ok || !data.features) {
        throw new Error(data.error || 'Failed to load held-out sample');
      }
      setHandsDetected(Math.round(data.features[126]));
      await callPredictApi({ features: data.features }, 'sample-test');
    } catch (err) {
      setBackendError(err instanceof Error ? err.message : 'Sample test failed');
    } finally {
      setTestRunning(false);
    }
  };

  const handleSpeak = () => {
    if (!sequenceText.trim() || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(sequenceText);
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  };

  const handleCopySequence = async () => {
    if (!sequenceText) return;
    try {
      await navigator.clipboard.writeText(sequenceText);
      setCopiedBanner(true);
      setTimeout(() => setCopiedBanner(false), 1800);
    } catch {
      // Clipboard unavailable in restricted context
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    setSequenceText('');
    lastCommittedRef.current = { label: '', time: 0 };
  };

  const confidencePercent = Math.round(smoothed.confidence * 100);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            Live ISL Recognition Studio
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Detects 1-handed and 2-handed ISL gestures via MediaPipe 21-point landmarks and predicts
            with Random Forest confidence smoothing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>Engine: {activeEngine}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            Latency: {latencyMs !== null ? `${latencyMs} ms` : '—'}
          </span>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Stage: Webcam + Controls */}
        <div className="space-y-6 lg:col-span-7">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {/* Stage Status Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                {cameraState === 'active' ? (
                  handsDetected > 0 ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      <span>
                        Camera Active · {handsDetected}{' '}
                        {handsDetected === 1 ? 'Hand Detected' : 'Hands Detected'} (
                        {handsDetected * 21} landmarks)
                      </span>
                    </>
                  ) : (
                    <>
                      <Hand className="h-4 w-4 text-amber-600" aria-hidden="true" />
                      <span>Camera Active · No Hand Detected</span>
                    </>
                  )
                ) : cameraState === 'error' ? (
                  <>
                    <AlertTriangle className="h-4 w-4 text-rose-600" aria-hidden="true" />
                    <span>Camera Unavailable</span>
                  </>
                ) : (
                  <>
                    <CameraOff className="h-4 w-4 text-slate-500" aria-hidden="true" />
                    <span>Camera Idle — Click Start Camera to begin</span>
                  </>
                )}
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={mirrored}
                  onChange={(e) => setMirrored(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                />
                Mirror preview
              </label>
            </div>

            {/* Video + Canvas Viewport */}
            <div
              data-testid="live-camera-stage"
              className="relative aspect-video w-full bg-slate-900"
            >
              <video
                ref={videoRef}
                playsInline
                muted
                className={`h-full w-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
              />
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />

              {cameraState !== 'active' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 p-6 text-center text-white">
                  <Camera className="h-10 w-10 text-teal-400" aria-hidden="true" />
                  <p className="mt-3 font-display text-base font-semibold">
                    {cameraState === 'starting'
                      ? 'Requesting Camera Permission & Loading MediaPipe...'
                      : 'Webcam Preview Paused'}
                  </p>
                  <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-300">
                    Position your hands at chest height with even lighting. Both 1-handed (C, I, L,
                    O, U, V) and 2-handed ISL letters are tracked automatically.
                  </p>
                </div>
              )}
            </div>

            {/* Camera Error Alert */}
            {cameraError && (
              <div
                role="alert"
                className="border-t border-rose-200 bg-rose-50 px-5 py-3 text-xs leading-relaxed text-rose-800"
              >
                {cameraError}
              </div>
            )}

            {/* Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/70 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={cameraState === 'active' || cameraState === 'starting'}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  Start Camera
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  disabled={cameraState === 'idle'}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <CameraOff className="h-4 w-4" aria-hidden="true" />
                  Stop Camera
                </button>
                <button
                  type="button"
                  onClick={restartCamera}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Restart Camera
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <span>Interval</span>
                  <select
                    value={intervalMs}
                    onChange={(e) => setIntervalMs(Number(e.target.value))}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800"
                  >
                    <option value={150}>150 ms</option>
                    <option value={200}>200 ms</option>
                    <option value={350}>350 ms</option>
                  </select>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <span className="tabular-nums">
                    Min Confidence: {Math.round(confidenceThreshold * 100)}%
                  </span>
                  <input
                    type="range"
                    min={0.35}
                    max={0.85}
                    step={0.05}
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                    className="h-1.5 w-24 accent-teal-700"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Held-Out Sample Verification Runner (for cloud / no-webcam testing) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="flex items-center gap-2 font-display text-sm font-bold text-slate-900">
                  <FlaskConical className="h-4 w-4 text-teal-700" aria-hidden="true" />
                  Held-Out Test Landmark Simulator
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Test the live ML REST API without a physical webcam by running a real unseen test
                  landmark sample from the evaluation split.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <label htmlFor="test-letter-select" className="sr-only">
                  Select test ISL letter
                </label>
                <select
                  id="test-letter-select"
                  value={selectedTestLetter}
                  onChange={(e) => setSelectedTestLetter(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                >
                  {STATIC_LETTERS.map((ltr) => (
                    <option key={ltr} value={ltr}>
                      ISL {ltr}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={runHeldoutSampleTest}
                  disabled={testRunning}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {testRunning ? 'Predicting...' : 'Run Test Landmark'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Deck: Live Prediction + Recognition History */}
        <div className="space-y-6 lg:col-span-5">
          {/* Prediction Card */}
          <section
            aria-label="Live prediction readout"
            className="rounded-xl border border-slate-200 bg-white p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900">
                Predicted ISL Alphabet
              </h2>
              <span className="text-xs font-medium text-slate-500">
                {smoothed.status === 'confident' && 'Confident Match'}
                {smoothed.status === 'stabilizing' && 'Stabilizing Frames...'}
                {smoothed.status === 'uncertain' && 'Uncertain Gesture'}
                {smoothed.status === 'no-hand' && 'Waiting for Hand'}
              </span>
            </div>

            {backendError && (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800"
              >
                {backendError}
              </div>
            )}

            <div className="mt-5 flex items-center gap-6">
              <div
                data-testid="predicted-letter-box"
                className={`flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border text-5xl font-extrabold font-display ${
                  smoothed.status === 'confident'
                    ? 'border-teal-200 bg-teal-50 text-teal-800'
                    : smoothed.status === 'uncertain'
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-slate-200 bg-slate-50 text-slate-400'
                }`}
              >
                {smoothed.stableLabel ?? '?'}
              </div>

              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-600">Model Confidence</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {confidencePercent}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full transition-all duration-200 ${
                        smoothed.status === 'confident'
                          ? 'bg-teal-600'
                          : smoothed.status === 'uncertain'
                          ? 'bg-amber-500'
                          : 'bg-slate-300'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, confidencePercent))}%` }}
                    />
                  </div>
                </div>

                {smoothed.status === 'uncertain' && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-700">
                    <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      Below {Math.round(confidenceThreshold * 100)}% threshold (closest:{' '}
                      {rawTopLabel ?? '—'}). Hold hand steady or improve lighting.
                    </span>
                  </p>
                )}

                {smoothed.status === 'no-hand' && (
                  <p className="text-xs text-slate-500">
                    Show 1 or 2 hands clearly inside the frame, or run a held-out test sample.
                  </p>
                )}
              </div>
            </div>

            {/* Top-3 Class Probabilities */}
            {topPredictions.length > 0 && (
              <div className="mt-6 border-t border-slate-100 pt-4">
                <p className="text-xs font-medium text-slate-500">Top Candidate Classes</p>
                <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                  {topPredictions.map((pred) => (
                    <div
                      key={pred.label}
                      className="rounded-lg bg-slate-50 px-3 py-2"
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="font-display text-base font-bold text-slate-900">
                          {pred.label}
                        </span>
                        <span className="font-mono text-xs text-slate-700 tabular-nums">
                          {Math.round(pred.confidence * 100)}%
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">{pred.hand_mode}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Recognition History Card */}
          <section
            aria-label="Recognition history"
            className="rounded-xl border border-slate-200 bg-white p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900">
                Recognition History
              </h2>
              <button
                type="button"
                onClick={handleClearHistory}
                disabled={history.length === 0 && sequenceText.length === 0}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Clear History
              </button>
            </div>

            {/* Recognized Sequence Output */}
            <div className="mt-4 rounded-lg bg-slate-50 p-3.5">
              <p className="text-[11px] font-medium text-slate-500">Recognized Sequence</p>
              <p
                data-testid="recognized-sequence"
                className="mt-1 min-h-[28px] break-all font-mono text-lg font-semibold tracking-wider text-slate-900"
              >
                {sequenceText || <span className="text-sm font-normal text-slate-400">No letters recorded yet</span>}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2.5">
                <button
                  type="button"
                  onClick={() => setSequenceText((prev) => prev + ' ')}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Space className="h-3.5 w-3.5" aria-hidden="true" />
                  Space
                </button>
                <button
                  type="button"
                  onClick={() => setSequenceText((prev) => prev.slice(0, -1))}
                  disabled={!sequenceText}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  <Delete className="h-3.5 w-3.5" aria-hidden="true" />
                  Backspace
                </button>
                <button
                  type="button"
                  onClick={handleSpeak}
                  disabled={!sequenceText.trim()}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Speak
                </button>
                <button
                  type="button"
                  onClick={handleCopySequence}
                  disabled={!sequenceText}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  {copiedBanner ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Event Log */}
            <div className="mt-4 max-h-56 divide-y divide-slate-100 overflow-y-auto pr-1">
              {history.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  Confirmed predictions will appear here with confidence scores and timestamps.
                </p>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-1 py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-display text-base font-bold text-slate-900">
                        {item.letter}
                      </span>
                      <span className="text-slate-600">
                        {item.handMode} · {item.source}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-slate-600 tabular-nums">
                      <span>{Math.round(item.confidence * 100)}%</span>
                      <span className="text-slate-400">{item.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

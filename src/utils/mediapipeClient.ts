import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision';
import type { Landmark3D } from './landmarks';

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

let cachedLandmarker: HandLandmarker | null = null;
let loadPromise: Promise<HandLandmarker> | null = null;

export async function getHandLandmarker(): Promise<HandLandmarker> {
  if (cachedLandmarker) return cachedLandmarker;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks('/mediapipe-wasm');
    const landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    }).catch(async () => {
      // CPU delegate fallback when WebGL GPU delegate is unavailable
      return HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });
    });

    cachedLandmarker = landmarker;
    return landmarker;
  })();

  try {
    return await loadPromise;
  } catch (err) {
    loadPromise = null;
    throw err;
  }
}

export function drawHandLandmarks(
  canvas: HTMLCanvasElement,
  result: HandLandmarkerResult | null,
  mirrored = true
): Landmark3D[][] {
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!result || !result.landmarks || result.landmarks.length === 0) {
    return [];
  }

  const palette = [
    { stroke: '#0F766E', fill: '#14B8A6' }, // Hand 1: Teal
    { stroke: '#0369A1', fill: '#38BDF8' }, // Hand 2: Sky Blue
  ];

  const extracted: Landmark3D[][] = [];

  result.landmarks.slice(0, 2).forEach((hand, handIdx) => {
    const colors = palette[handIdx % palette.length];
    const mapped: Landmark3D[] = hand.map((lm) => ({
      x: mirrored ? 1 - lm.x : lm.x,
      y: lm.y,
      z: lm.z,
    }));
    extracted.push(mapped);

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = colors.stroke;
    ctx.lineCap = 'round';

    for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
      const a = mapped[startIdx];
      const b = mapped[endIdx];
      ctx.beginPath();
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
      ctx.stroke();
    }

    for (let i = 0; i < mapped.length; i++) {
      const pt = mapped[i];
      const radius = i === 0 || i % 4 === 0 ? 4.5 : 3.2;
      ctx.beginPath();
      ctx.arc(pt.x * w, pt.y * h, radius, 0, Math.PI * 2);
      ctx.fillStyle = colors.fill;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    }
  });

  return extracted;
}

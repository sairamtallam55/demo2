/**
 * Pure TypeScript Landmark Preprocessing, Temporal Smoothing, and
 * Dynamic Gesture Trajectory Detection (J & Z) matching `ml/preprocessing.py`.
 */

export interface Landmark3D {
  x: number;
  y: number;
  z?: number;
}

export const NUM_LANDMARKS = 21;
export const COORDS_PER_HAND = 63;
export const TOTAL_FEATURES = 130;
export const MIN_PALM_SCALE = 1e-5;

function parseAndValidateHand(hand: Landmark3D[]): number[][] {
  if (!Array.isArray(hand) || hand.length !== NUM_LANDMARKS) {
    throw new Error(`Expected ${NUM_LANDMARKS} landmarks per hand, got ${hand?.length ?? 0}`);
  }
  const coords: number[][] = [];
  for (let i = 0; i < NUM_LANDMARKS; i++) {
    const lm = hand[i];
    const x = Number(lm?.x);
    const y = Number(lm?.y);
    const z = Number(lm?.z ?? 0);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new Error('Non-finite landmark coordinate encountered');
    }
    coords.push([x, y, z]);
  }
  return coords;
}

function norm3(a: number[]): number {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}

function normalizeSingleHand(coords: number[][]): {
  normalized: number[];
  wrist: number[];
  palmScale: number;
} {
  const wrist = [...coords[0]];
  const centered: number[][] = coords.map((p) => [
    p[0] - wrist[0],
    p[1] - wrist[1],
    p[2] - wrist[2],
  ]);

  let palmScale = norm3(centered[9]);
  if (palmScale < MIN_PALM_SCALE) {
    let maxDist = 0;
    for (const c of centered) {
      const d = norm3(c);
      if (d > maxDist) maxDist = d;
    }
    if (maxDist < MIN_PALM_SCALE) {
      throw new Error('Degenerate hand detection with near-zero scale');
    }
    palmScale = maxDist;
  }

  const normalized: number[] = [];
  for (const c of centered) {
    normalized.push(
      Number((c[0] / palmScale).toFixed(6)),
      Number((c[1] / palmScale).toFixed(6)),
      Number((c[2] / palmScale).toFixed(6))
    );
  }
  return { normalized, wrist, palmScale };
}

/**
 * Convert 1 or 2 MediaPipe hand landmark arrays into the exact 130-feature
 * vector expected by the Random Forest model.
 */
export function extractFeaturesFromHands(hands: Landmark3D[][]): number[] {
  if (!Array.isArray(hands) || hands.length === 0) {
    throw new Error('No hands provided for feature extraction');
  }

  const parsed = hands.slice(0, 2).map(parseAndValidateHand);
  // Canonical left-to-right ordering by wrist X coordinate
  parsed.sort((a, b) => a[0][0] - b[0][0]);

  const h1 = normalizeSingleHand(parsed[0]);
  let h2Norm: number[];
  let relOffset: number[];
  let handCount: number;

  if (parsed.length === 2) {
    const h2 = normalizeSingleHand(parsed[1]);
    h2Norm = h2.normalized;
    const meanScale = Math.max((h1.palmScale + h2.palmScale) * 0.5, MIN_PALM_SCALE);
    relOffset = [
      Number(((h2.wrist[0] - h1.wrist[0]) / meanScale).toFixed(6)),
      Number(((h2.wrist[1] - h1.wrist[1]) / meanScale).toFixed(6)),
      Number(((h2.wrist[2] - h1.wrist[2]) / meanScale).toFixed(6)),
    ];
    handCount = 2.0;
  } else {
    h2Norm = new Array(COORDS_PER_HAND).fill(0);
    relOffset = [0, 0, 0];
    handCount = 1.0;
  }

  return [...h1.normalized, ...h2Norm, handCount, ...relOffset];
}

export interface RawPredictionFrame {
  label: string | null;
  confidence: number;
  uncertain: boolean;
}

export interface SmoothedResult {
  stableLabel: string | null;
  confidence: number;
  isStable: boolean;
  status: 'confident' | 'uncertain' | 'stabilizing' | 'no-hand';
}

/**
 * Sliding-window consensus filter to prevent flickering predictions
 * across consecutive webcam frames.
 */
export class PredictionSmoother {
  private windowSize: number;
  private minConsensus: number;
  private buffer: RawPredictionFrame[] = [];

  constructor(windowSize = 6, minConsensus = 4) {
    this.windowSize = windowSize;
    this.minConsensus = minConsensus;
  }

  public reset(): void {
    this.buffer = [];
  }

  public push(frame: RawPredictionFrame | null): SmoothedResult {
    if (!frame) {
      this.buffer = [];
      return { stableLabel: null, confidence: 0, isStable: false, status: 'no-hand' };
    }

    this.buffer.push(frame);
    if (this.buffer.length > this.windowSize) {
      this.buffer.shift();
    }

    const validFrames = this.buffer.filter((f) => !f.uncertain && f.label !== null);
    if (validFrames.length === 0) {
      return {
        stableLabel: null,
        confidence: frame.confidence,
        isStable: false,
        status: 'uncertain',
      };
    }

    const counts = new Map<string, { count: number; confSum: number }>();
    for (const f of validFrames) {
      const lbl = f.label as string;
      const entry = counts.get(lbl) ?? { count: 0, confSum: 0 };
      entry.count += 1;
      entry.confSum += f.confidence;
      counts.set(lbl, entry);
    }

    let bestLabel = '';
    let bestCount = 0;
    let bestAvgConf = 0;
    for (const [lbl, stats] of counts.entries()) {
      if (stats.count > bestCount || (stats.count === bestCount && stats.confSum / stats.count > bestAvgConf)) {
        bestLabel = lbl;
        bestCount = stats.count;
        bestAvgConf = stats.confSum / stats.count;
      }
    }

    if (bestCount >= this.minConsensus) {
      return {
        stableLabel: bestLabel,
        confidence: Number(bestAvgConf.toFixed(4)),
        isStable: true,
        status: 'confident',
      };
    }

    return {
      stableLabel: null,
      confidence: Number(bestAvgConf.toFixed(4)),
      isStable: false,
      status: 'stabilizing',
    };
  }
}

export interface MotionDetectionResult {
  detected: 'J' | 'Z' | null;
  confidence: number;
}

/**
 * Temporal trajectory detector for dynamic ISL alphabet gestures ('J' and 'Z')
 * that cannot be classified accurately from a single static frame.
 */
export class DynamicMotionDetector {
  private indexTrail: { x: number; y: number }[] = [];
  private pinkyTrail: { x: number; y: number }[] = [];
  private readonly maxFrames = 24;

  public reset(): void {
    this.indexTrail = [];
    this.pinkyTrail = [];
  }

  public pushHand(hand: Landmark3D[] | null): MotionDetectionResult {
    if (!hand || hand.length !== NUM_LANDMARKS) {
      this.reset();
      return { detected: null, confidence: 0 };
    }

    const indexTip = hand[8];
    const indexPip = hand[6];
    const pinkyTip = hand[20];
    const pinkyPip = hand[18];

    // Check which finger is extended upward (smaller Y is higher in screen coords)
    const pinkyExtended = pinkyTip.y < pinkyPip.y - 0.03;
    const indexExtended = indexTip.y < indexPip.y - 0.03;

    this.indexTrail.push({ x: indexTip.x, y: indexTip.y });
    this.pinkyTrail.push({ x: pinkyTip.x, y: pinkyTip.y });
    if (this.indexTrail.length > this.maxFrames) this.indexTrail.shift();
    if (this.pinkyTrail.length > this.maxFrames) this.pinkyTrail.shift();

    if (this.pinkyTrail.length >= 12 && pinkyExtended && !indexExtended) {
      if (this.matchesJHook(this.pinkyTrail)) {
        this.reset();
        return { detected: 'J', confidence: 0.84 };
      }
    }

    if (this.indexTrail.length >= 14 && indexExtended) {
      if (this.matchesZZigZag(this.indexTrail)) {
        this.reset();
        return { detected: 'Z', confidence: 0.85 };
      }
    }

    return { detected: null, confidence: 0 };
  }

  private matchesJHook(pts: { x: number; y: number }[]): boolean {
    const start = pts[0];
    const mid = pts[Math.floor(pts.length * 0.6)];
    const end = pts[pts.length - 1];
    // J: moves downward first (mid.y > start.y + dy) and hooks horizontally & slightly upward
    const dropY = mid.y - start.y;
    const hookX = Math.abs(end.x - mid.x);
    const hookUp = mid.y - end.y;
    return dropY > 0.08 && hookX > 0.05 && hookUp > 0.015;
  }

  private matchesZZigZag(pts: { x: number; y: number }[]): boolean {
    const n = pts.length;
    const p0 = pts[0];
    const p1 = pts[Math.floor(n * 0.33)];
    const p2 = pts[Math.floor(n * 0.66)];
    const p3 = pts[n - 1];

    // Z: right sweep (p1.x - p0.x), diagonal down-left (p1.x - p2.x & p2.y - p1.y), right sweep (p3.x - p2.x)
    const seg1Right = p1.x - p0.x;
    const seg2Left = p1.x - p2.x;
    const seg2Down = p2.y - p1.y;
    const seg3Right = p3.x - p2.x;

    return seg1Right > 0.06 && seg2Left > 0.06 && seg2Down > 0.06 && seg3Right > 0.06;
  }
}

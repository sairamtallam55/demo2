import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DynamicMotionDetector,
  PredictionSmoother,
  TOTAL_FEATURES,
  extractFeaturesFromHands,
  type Landmark3D,
} from './landmarks';

function makeHand(offsetX = 0, scale = 0.12): Landmark3D[] {
  const pts: Landmark3D[] = [];
  for (let i = 0; i < 21; i++) {
    const angle = (i / 21) * 1.2;
    const r = i === 9 ? scale : (0.04 + 0.01 * i) * (scale / 0.12);
    pts.push({
      x: offsetX + 0.5 + r * Math.sin(angle),
      y: 0.6 - r * Math.cos(angle),
      z: -0.01 * (i % 4) * (scale / 0.12),
    });
  }
  pts[0] = { x: offsetX + 0.5, y: 0.6, z: 0 };
  return pts;
}

test('extractFeaturesFromHands produces 130 translation- and scale-invariant features', () => {
  const f1 = extractFeaturesFromHands([makeHand(0, 0.12)]);
  const f2 = extractFeaturesFromHands([makeHand(0.25, 0.24)]);

  assert.equal(f1.length, TOTAL_FEATURES);
  assert.equal(f1[126], 1);
  for (let i = 0; i < 63; i++) {
    assert.ok(Math.abs(f1[i] - f2[i]) < 1e-5, `Mismatch at index ${i}`);
    assert.equal(f1[63 + i], 0);
  }
});

test('extractFeaturesFromHands sorts two hands canonically left-to-right', () => {
  const left = makeHand(-0.15, 0.12);
  const right = makeHand(0.15, 0.12);

  const fLR = extractFeaturesFromHands([left, right]);
  const fRL = extractFeaturesFromHands([right, left]);

  assert.equal(fLR[126], 2);
  assert.deepEqual(fLR, fRL);
});

test('extractFeaturesFromHands rejects degenerate or missing hands', () => {
  assert.throws(() => extractFeaturesFromHands([]));
  const zeroHand = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  assert.throws(() => extractFeaturesFromHands([zeroHand]));
});

test('PredictionSmoother stabilizes consensus and filters jitter', () => {
  const smoother = new PredictionSmoother(5, 3);
  assert.equal(smoother.push(null).status, 'no-hand');

  const r1 = smoother.push({ label: 'A', confidence: 0.82, uncertain: false });
  assert.equal(r1.status, 'stabilizing');
  assert.equal(r1.isStable, false);

  smoother.push({ label: 'B', confidence: 0.61, uncertain: false });
  smoother.push({ label: 'A', confidence: 0.85, uncertain: false });
  const r4 = smoother.push({ label: 'A', confidence: 0.88, uncertain: false });

  assert.equal(r4.status, 'confident');
  assert.equal(r4.isStable, true);
  assert.equal(r4.stableLabel, 'A');
});

test('DynamicMotionDetector detects J hook and Z zig-zag trajectories', () => {
  const detector = new DynamicMotionDetector();

  // Build synthetic Z trajectory with index finger extended
  const baseHand = makeHand(0, 0.12);
  const zPath = [
    { x: 0.30, y: 0.30 }, { x: 0.33, y: 0.30 }, { x: 0.36, y: 0.30 }, { x: 0.39, y: 0.30 }, { x: 0.42, y: 0.30 },
    { x: 0.39, y: 0.34 }, { x: 0.36, y: 0.37 }, { x: 0.33, y: 0.40 }, { x: 0.30, y: 0.43 },
    { x: 0.33, y: 0.43 }, { x: 0.36, y: 0.43 }, { x: 0.39, y: 0.43 }, { x: 0.42, y: 0.43 }, { x: 0.45, y: 0.43 },
  ];

  let detectedZ = false;
  for (const pt of zPath) {
    const frame = baseHand.map((p) => ({ ...p }));
    frame[6] = { x: pt.x, y: pt.y + 0.08, z: 0 };
    frame[8] = { x: pt.x, y: pt.y, z: 0 };
    const res = detector.pushHand(frame);
    if (res.detected === 'Z') detectedZ = true;
  }
  assert.equal(detectedZ, true);

  // Build synthetic J hook with pinky extended
  detector.reset();
  const jPath = [
    { x: 0.50, y: 0.30 }, { x: 0.50, y: 0.33 }, { x: 0.50, y: 0.36 }, { x: 0.50, y: 0.39 },
    { x: 0.50, y: 0.42 }, { x: 0.50, y: 0.45 }, { x: 0.50, y: 0.48 }, { x: 0.48, y: 0.49 },
    { x: 0.45, y: 0.49 }, { x: 0.43, y: 0.48 }, { x: 0.42, y: 0.46 }, { x: 0.41, y: 0.44 },
  ];

  let detectedJ = false;
  for (const pt of jPath) {
    const frame = baseHand.map((p) => ({ ...p }));
    frame[6] = { x: 0.5, y: 0.55, z: 0 };
    frame[8] = { x: 0.5, y: 0.58, z: 0 }; // index folded
    frame[18] = { x: pt.x, y: pt.y + 0.08, z: 0 };
    frame[20] = { x: pt.x, y: pt.y, z: 0 }; // pinky extended
    const res = detector.pushHand(frame);
    if (res.detected === 'J') detectedJ = true;
  }
  assert.equal(detectedJ, true);
});

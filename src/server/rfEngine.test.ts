import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { evaluateRandomForest, loadExportedForest } from './rfEngine';

test('TypeScript Random Forest evaluator predicts held-out test samples accurately', () => {
  const forest = loadExportedForest(process.cwd());
  const heldoutPath = path.join(process.cwd(), 'ml', 'artifacts', 'heldout_samples.json');
  const heldout = JSON.parse(fs.readFileSync(heldoutPath, 'utf-8')) as Record<string, number[]>;

  const labels = Object.keys(heldout);
  assert.equal(labels.length, 24);

  let correct = 0;
  for (const lbl of labels) {
    const res = evaluateRandomForest(forest, heldout[lbl]);
    if (res.topLabel === lbl) correct++;
    assert.ok(res.topConfidence > 0);
    assert.equal(res.topPredictions.length, 3);
  }
  assert.ok(correct >= 22, `Expected at least 22/24 classes correct, got ${correct}`);
});

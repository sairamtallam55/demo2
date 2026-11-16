/**
 * Pure TypeScript Random Forest Tree Evaluator & Parity Engine.
 *
 * Reads the exact Scikit-Learn exported `ml/artifacts/model_trees.json`
 * so Node/Express produces identical `predict_proba` outputs even in
 * Node-only Cloud Run deployments without a Python runtime.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface ExportedTree {
  children_left: number[];
  children_right: number[];
  feature: number[];
  threshold: number[];
  probs: number[][];
}

export interface ExportedRandomForest {
  model_type: string;
  n_estimators: number;
  n_features: number;
  classes: string[];
  trees: ExportedTree[];
}

export interface TopPrediction {
  label: string;
  confidence: number;
  hand_mode: string;
}

export const ISL_HAND_MODE_MAP: Record<string, string> = {
  A: 'two-handed', B: 'two-handed', C: 'one-handed', D: 'two-handed',
  E: 'two-handed', F: 'two-handed', G: 'two-handed', H: 'two-handed',
  I: 'one-handed', J: 'dynamic', K: 'two-handed', L: 'one-handed',
  M: 'two-handed', N: 'two-handed', O: 'one-handed', P: 'two-handed',
  Q: 'two-handed', R: 'two-handed', S: 'two-handed', T: 'two-handed',
  U: 'one-handed', V: 'one-handed', W: 'two-handed', X: 'two-handed',
  Y: 'two-handed', Z: 'dynamic',
};

export function evaluateRandomForest(
  model: ExportedRandomForest,
  features: number[]
): { probs: number[]; topPredictions: TopPrediction[]; topLabel: string; topConfidence: number } {
  if (features.length !== model.n_features) {
    throw new Error(`Expected ${model.n_features} features, got ${features.length}`);
  }
  const numClasses = model.classes.length;
  const avgProbs = new Array<number>(numClasses).fill(0);

  for (const tree of model.trees) {
    let node = 0;
    while (tree.children_left[node] !== -1) {
      const featIdx = tree.feature[node];
      const thresh = tree.threshold[node];
      if (features[featIdx] <= thresh) {
        node = tree.children_left[node];
      } else {
        node = tree.children_right[node];
      }
    }
    const leafProbs = tree.probs[node];
    for (let c = 0; c < numClasses; c++) {
      avgProbs[c] += leafProbs[c];
    }
  }

  const nTrees = Math.max(model.trees.length, 1);
  for (let c = 0; c < numClasses; c++) {
    avgProbs[c] /= nTrees;
  }

  const ranked = model.classes
    .map((label, idx) => ({
      label,
      confidence: Number(avgProbs[idx].toFixed(4)),
      hand_mode: ISL_HAND_MODE_MAP[label] ?? 'unknown',
    }))
    .sort((a, b) => b.confidence - a.confidence);

  return {
    probs: avgProbs,
    topPredictions: ranked.slice(0, 3),
    topLabel: ranked[0].label,
    topConfidence: ranked[0].confidence,
  };
}

export function loadExportedForest(rootDir = process.cwd()): ExportedRandomForest {
  const modelPath = path.join(rootDir, 'ml', 'artifacts', 'model_trees.json');
  const raw = fs.readFileSync(modelPath, 'utf-8');
  return JSON.parse(raw) as ExportedRandomForest;
}

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  ISL_HAND_MODE_MAP,
  evaluateRandomForest,
  loadExportedForest,
  type ExportedRandomForest,
} from './src/server/rfEngine';
import { TOTAL_FEATURES, extractFeaturesFromHands, type Landmark3D } from './src/utils/landmarks';

const PORT = Number(process.env.PORT ?? 3000);
const FLASK_PORT = Number(process.env.FLASK_PORT ?? 5001);
const FLASK_URL = `http://127.0.0.1:${FLASK_PORT}`;
const ROOT_DIR = process.cwd();

let flaskProcess: ChildProcess | null = null;
let flaskReady = false;
let cachedForest: ExportedRandomForest | null = null;

function getForest(): ExportedRandomForest {
  if (!cachedForest) {
    cachedForest = loadExportedForest(ROOT_DIR);
  }
  return cachedForest;
}

function startPythonFlask(): void {
  const backendPath = path.join(ROOT_DIR, 'backend', 'app.py');
  if (!fs.existsSync(backendPath)) return;

  flaskProcess = spawn('python3', [backendPath], {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FLASK_ENV: 'production' },
  });

  flaskProcess.stdout?.on('data', (chunk) => {
    const text = chunk.toString();
    if (text.includes('Running on') || text.includes('5001')) {
      flaskReady = true;
    }
  });

  flaskProcess.stderr?.on('data', (chunk) => {
    const text = chunk.toString();
    if (text.includes('Running on') || text.includes('5001')) {
      flaskReady = true;
    }
  });

  flaskProcess.on('exit', () => {
    flaskReady = false;
    flaskProcess = null;
  });

  // Active readiness probe
  const probe = setInterval(async () => {
    try {
      const res = await fetch(`${FLASK_URL}/api/health`, { signal: AbortSignal.timeout(800) });
      if (res.ok) {
        flaskReady = true;
        clearInterval(probe);
      }
    } catch {
      // Waiting for Flask startup
    }
  }, 400);
  setTimeout(() => clearInterval(probe), 15000);
}

async function tryProxyToFlask(req: express.Request, res: express.Response): Promise<boolean> {
  if (!flaskReady) return false;
  try {
    const targetUrl = `${FLASK_URL}${req.originalUrl}`;
    const headers: Record<string, string> = {};
    if (req.headers['content-type']) {
      headers['content-type'] = String(req.headers['content-type']);
    }
    const init: RequestInit = {
      method: req.method,
      headers,
      signal: AbortSignal.timeout(req.path === '/api/train' ? 30000 : 5000),
    };
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined) {
      init.body = JSON.stringify(req.body);
      headers['content-type'] = 'application/json';
    }
    const upstream = await fetch(targetUrl, init);
    const bodyText = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(bodyText);
    return true;
  } catch {
    return false;
  }
}

async function bootstrap() {
  startPythonFlask();

  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(
    '/mediapipe-wasm',
    express.static(path.join(ROOT_DIR, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm'))
  );

  // Proxy /api/* to Python Flask when available, otherwise execute parity TS Random Forest engine
  app.use('/api', async (req, res, next) => {
    const proxied = await tryProxyToFlask(req, res);
    if (proxied) return;
    next();
  });

  app.get('/api/health', (_req, res) => {
    const forest = getForest();
    res.json({
      status: 'ok',
      backend: 'node-ts-rf-parity',
      model_loaded: true,
      static_classes: forest.classes,
      dynamic_classes: ['J', 'Z'],
      total_features: TOTAL_FEATURES,
    });
  });

  app.post('/api/predict', (req, res) => {
    try {
      const payload = req.body ?? {};
      const threshold = Math.max(0.1, Math.min(0.99, Number(payload.confidence_threshold ?? 0.55)));
      let features: number[];

      if (Array.isArray(payload.hands) && payload.hands.length > 0) {
        features = extractFeaturesFromHands(payload.hands as Landmark3D[][]);
      } else if (Array.isArray(payload.features) && payload.features.length === TOTAL_FEATURES) {
        features = payload.features.map(Number);
        if (features.some((v) => !Number.isFinite(v))) {
          res.status(400).json({ error: 'Features contain non-finite numbers' });
          return;
        }
      } else {
        res.status(400).json({ error: 'Provide either valid hands landmarks or 130 features' });
        return;
      }

      const forest = getForest();
      const result = evaluateRandomForest(forest, features);
      const uncertain = result.topConfidence < threshold;

      res.json({
        predicted_label: uncertain ? null : result.topLabel,
        raw_top_label: result.topLabel,
        confidence: result.topConfidence,
        uncertain,
        threshold,
        hand_count: Math.round(features[126]),
        expected_hand_mode: ISL_HAND_MODE_MAP[result.topLabel] ?? 'unknown',
        top_predictions: result.topPredictions,
        engine: 'node-ts-rf-parity',
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Prediction failed' });
    }
  });

  app.get(['/api/evaluate', '/api/model-info'], (_req, res) => {
    const evalPath = path.join(ROOT_DIR, 'ml', 'artifacts', 'evaluation_report.json');
    const preprocPath = path.join(ROOT_DIR, 'ml', 'artifacts', 'preprocessing.json');
    const evaluation = JSON.parse(fs.readFileSync(evalPath, 'utf-8'));
    const preprocessing = fs.existsSync(preprocPath)
      ? JSON.parse(fs.readFileSync(preprocPath, 'utf-8'))
      : {};
    res.json({ evaluation, preprocessing, engine: 'node-ts-rf-parity' });
  });

  app.get('/api/dataset', (_req, res) => {
    const csvPath = path.join(ROOT_DIR, 'ml', 'data', 'isl_landmarks.csv');
    if (!fs.existsSync(csvPath)) {
      res.json({ total_samples: 0, class_counts: {}, sources: {}, custom_samples: 0 });
      return;
    }
    const lines = fs.readFileSync(csvPath, 'utf-8').trim().split('\n');
    const classCounts: Record<string, number> = {};
    const sources: Record<string, number> = {};
    let customSamples = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const lbl = cols[0];
      const src = cols[3] || 'unknown';
      if (lbl) classCounts[lbl] = (classCounts[lbl] ?? 0) + 1;
      sources[src] = (sources[src] ?? 0) + 1;
      if (src !== 'anatomical_prototype') customSamples++;
    }

    res.json({
      total_samples: Math.max(0, lines.length - 1),
      class_counts: classCounts,
      sources,
      custom_samples: customSamples,
      static_classes: getForest().classes,
      dynamic_classes: ['J', 'Z'],
    });
  });

  app.post('/api/dataset/sample', (req, res) => {
    try {
      const { label, hands, signer_id = 'web_collector' } = req.body ?? {};
      const cleanLabel = String(label ?? '').trim().toUpperCase();
      const forest = getForest();
      if (!forest.classes.includes(cleanLabel)) {
        res.status(400).json({ error: `Invalid static ISL label '${cleanLabel}'` });
        return;
      }
      if (!Array.isArray(hands) || hands.length === 0) {
        res.status(400).json({ error: 'No valid hand landmarks detected for collection' });
        return;
      }
      const features = extractFeaturesFromHands(hands as Landmark3D[][]);
      const csvPath = path.join(ROOT_DIR, 'ml', 'data', 'isl_landmarks.csv');
      const row = [
        cleanLabel,
        ISL_HAND_MODE_MAP[cleanLabel] ?? 'unknown',
        String(signer_id).replace(/,/g, '_'),
        'web_collector',
        ...features.map((v) => v.toFixed(6)),
      ].join(',');
      fs.appendFileSync(csvPath, `\n${row}`, 'utf-8');
      res.status(201).json({
        status: 'saved',
        label: cleanLabel,
        hand_count: Math.round(features[126]),
        source: 'web_collector',
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save sample' });
    }
  });

  app.get('/api/sample-frame/:letter', (req, res) => {
    const lbl = req.params.letter.trim().toUpperCase();
    const heldoutPath = path.join(ROOT_DIR, 'ml', 'artifacts', 'heldout_samples.json');
    const samples = JSON.parse(fs.readFileSync(heldoutPath, 'utf-8')) as Record<string, number[]>;
    if (!(lbl in samples)) {
      res.status(404).json({ error: `No static held-out sample for '${lbl}'` });
      return;
    }
    res.json({
      label: lbl,
      hand_mode: ISL_HAND_MODE_MAP[lbl] ?? 'unknown',
      features: samples[lbl],
      source: 'heldout_test_split',
    });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`MudraLab ISL server listening on http://0.0.0.0:${PORT}`);
  });

  const cleanup = () => {
    if (flaskProcess) flaskProcess.kill();
    server.close();
  };
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

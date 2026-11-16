import { useEffect, useState } from 'react';

interface EvaluationReport {
  generated_at: string;
  model_name: string;
  hyperparameters: {
    n_estimators: number;
    max_depth: number | null;
    random_state: number;
  };
  dataset_audit: {
    initial_rows: number;
    valid_rows: number;
    duplicates_removed: number;
    num_static_classes: number;
    dynamic_classes_handled_via_motion: string[];
    sources: Record<string, number>;
    split_strategy: string;
    train_samples: number;
    val_samples: number;
    test_samples: number;
    is_prototype_baseline: boolean;
  };
  test_metrics: {
    accuracy: number;
    macro_precision: number;
    macro_recall: number;
    macro_f1: number;
    weighted_f1: number;
  };
  model_comparison_validation: {
    model: string;
    val_accuracy: number;
    val_macro_precision: number;
    val_macro_recall: number;
    val_macro_f1: number;
  }[];
  per_class_metrics: {
    label: string;
    hand_mode: string;
    precision: number;
    recall: number;
    f1_score: number;
    support: number;
  }[];
  confusion_matrix: {
    labels: string[];
    matrix: number[][];
  };
}

export function AboutProjectView() {
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/evaluate')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load evaluation report');
        return res.json();
      })
      .then((data: { evaluation: EvaluationReport }) => setReport(data.evaluation))
      .catch((err) => setError(err instanceof Error ? err.message : 'Load error'));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
          Architecture, Datasets & ML Evaluation Report
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Complete engineering breakdown, verified Indian Sign Language dataset references, honest
          prototype limitations, and live Scikit-Learn evaluation metrics.
        </p>
      </div>

      {/* System Architecture Diagram */}
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">
          End-to-End System Architecture
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-6">
          {[
            { title: '1. Live Webcam', sub: 'Explicit browser consent · HTTPS stream' },
            { title: '2. MediaPipe Hands', sub: '21 × 3D landmarks · up to 2 hands' },
            { title: '3. Normalization', sub: 'Wrist-centered · Palm-scaled · 130 dims' },
            { title: '4. REST API', sub: 'POST /api/predict · Input validation' },
            { title: '5. Random Forest', sub: 'Scikit-Learn 120 trees + Joblib' },
            { title: '6. Result & History', sub: 'Confidence filter · Frame smoothing' },
          ].map((node) => (
            <div
              key={node.title}
              className="rounded-lg bg-slate-50 p-3.5"
            >
              <p className="font-display text-xs font-bold text-teal-800">{node.title}</p>
              <p className="mt-1 text-xs text-slate-600">{node.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Dataset Sources & Transparency */}
      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Verified Public ISL Dataset Research
          </h2>
          <ul className="mt-3 space-y-3 text-xs leading-relaxed text-slate-600">
            <li>
              <strong className="text-slate-900">ISLRTC Official Standard:</strong> Indian Sign
              Language Research and Training Centre guidelines, recognizing both unimanual and
              bimanual alphabet configurations.
            </li>
            <li>
              <strong className="text-slate-900">
                Mendeley Static ISL Alphabet Dataset (100,000+ images):
              </strong>{' '}
              Multi-age signer RGB corpus documenting static ISL letters across varied backgrounds
              and lighting.
            </li>
            <li>
              <strong className="text-slate-900">ISLAN & THISL Corpora (Mendeley / Academic):</strong>{' '}
              Explicitly categorize single-handed vs double-handed ISL letters and video sequences
              for dynamic signs J and Z.
            </li>
            <li>
              <strong className="text-slate-900">
                Multimodal ISL Dataset (DOI: 10.17632/2tj6c7pzfk.1):
              </strong>{' '}
              26 English letters captured with two-hand MediaPipe tracking.
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Baseline Disclosure & Stack
          </h2>
          <p className="mt-3 text-xs leading-relaxed text-slate-600">
            Public Mendeley/Kaggle datasets are multi-gigabyte image archives rather than open
            126-coordinate two-hand landmark CSVs. To deliver a runnable, leak-free baseline without
            fabricating human accuracy claims, the pre-trained model ships on a{' '}
            <strong className="text-slate-900">
              Calibrated Anatomical 3D Prototype Dataset (1,920 samples across 10 simulated signer
              groups)
            </strong>
            . Use the <strong className="text-slate-900">Collect & Train</strong> studio or offline{' '}
            <code>ml/extract_from_images.py</code> to train on real human gestures.
          </p>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-600">
            <strong className="text-slate-900">Technology Stack:</strong> React 19 + TypeScript +
            Tailwind CSS · MediaPipe Tasks Vision · Python 3.10 + Flask REST API · Scikit-Learn
            Random Forest + NumPy + Pandas + Joblib · Node Express Runtime Bridge.
          </div>
        </div>
      </section>

      {/* Live ML Evaluation Report */}
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">
          Live Model Evaluation Report
        </h2>

        {error && <p className="mt-4 text-xs text-rose-700">{error}</p>}
        {!report && !error && (
          <p className="mt-4 text-xs text-slate-500">Loading evaluation metrics...</p>
        )}

        {report && (
          <div className="mt-5 space-y-8">
            {/* Summary Metrics */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Test Accuracy</p>
                <p className="mt-1 font-display text-xl font-bold text-teal-800 tabular-nums">
                  {(report.test_metrics.accuracy * 100).toFixed(2)}%
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Macro Precision</p>
                <p className="mt-1 font-display text-xl font-bold text-slate-900 tabular-nums">
                  {(report.test_metrics.macro_precision * 100).toFixed(2)}%
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Macro Recall</p>
                <p className="mt-1 font-display text-xl font-bold text-slate-900 tabular-nums">
                  {(report.test_metrics.macro_recall * 100).toFixed(2)}%
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Macro F1-Score</p>
                <p className="mt-1 font-display text-xl font-bold text-slate-900 tabular-nums">
                  {(report.test_metrics.macro_f1 * 100).toFixed(2)}%
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Split Strategy</p>
                <p className="mt-1 font-mono text-xs font-semibold text-slate-800">
                  {report.dataset_audit.split_strategy}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums">
                  {report.dataset_audit.train_samples}/{report.dataset_audit.val_samples}/
                  {report.dataset_audit.test_samples}
                </p>
              </div>
            </div>

            {/* Model Comparison Table */}
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900">
                Validation Model Comparison
              </h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-4 font-medium">Classifier</th>
                      <th className="py-2 px-4 text-right font-medium">Val Accuracy</th>
                      <th className="py-2 px-4 text-right font-medium">Macro Precision</th>
                      <th className="py-2 px-4 text-right font-medium">Macro Recall</th>
                      <th className="py-2 pl-4 text-right font-medium">Macro F1</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.model_comparison_validation.map((row) => (
                      <tr key={row.model}>
                        <td className="py-2.5 pr-4 font-semibold text-slate-900">{row.model}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                          {(row.val_accuracy * 100).toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                          {(row.val_macro_precision * 100).toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                          {(row.val_macro_recall * 100).toFixed(2)}%
                        </td>
                        <td className="py-2.5 pl-4 text-right font-mono tabular-nums">
                          {(row.val_macro_f1 * 100).toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Confusion Matrix */}
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900">
                Test Set Confusion Matrix (24 Static ISL Classes)
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Rows represent true alphabet labels; columns represent predicted labels on unseen
                test signers.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="border-collapse font-mono text-[10px] tabular-nums">
                  <thead>
                    <tr>
                      <th className="p-1 text-left text-slate-500">T\P</th>
                      {report.confusion_matrix.labels.map((lbl) => (
                        <th key={lbl} className="w-6 p-1 text-center font-semibold text-slate-700">
                          {lbl}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.confusion_matrix.matrix.map((row, rIdx) => (
                      <tr key={report.confusion_matrix.labels[rIdx]}>
                        <td className="p-1 font-semibold text-slate-700">
                          {report.confusion_matrix.labels[rIdx]}
                        </td>
                        {row.map((val, cIdx) => {
                          const isDiag = rIdx === cIdx;
                          return (
                            <td
                              key={cIdx}
                              className={`h-6 w-6 border border-slate-100 text-center ${
                                val === 0
                                  ? 'text-slate-300'
                                  : isDiag
                                  ? 'bg-teal-600 font-bold text-white'
                                  : 'bg-amber-100 font-semibold text-amber-900'
                              }`}
                            >
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

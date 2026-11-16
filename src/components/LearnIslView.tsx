import { ArrowRight, CheckCircle2, Hand, Play } from 'lucide-react';
import { useState } from 'react';
import studyImage from '../assets/images/isl_study_guide_1794752516438.jpg';
import { ISL_ALPHABET_GUIDE, type IslHandMode, type IslLetterGuide } from '../data/islAlphabet';
import type { AppRoute } from './TopBar';

interface LearnIslViewProps {
  onNavigate: (route: AppRoute) => void;
}

type FilterMode = 'all' | IslHandMode;

function HandSchematic({ guide }: { guide: IslLetterGuide }) {
  const l = guide.letter;
  if (guide.handMode === 'dynamic') {
    return (
      <svg viewBox="0 0 180 110" className="h-28 w-full rounded-lg bg-slate-50">
        {l === 'J' ? (
          <path
            d="M 105 22 L 105 68 Q 105 90 80 88 Q 62 86 60 72"
            fill="none"
            stroke="#0F766E"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="6 4"
          />
        ) : (
          <path
            d="M 48 26 L 132 26 L 48 84 L 132 84"
            fill="none"
            stroke="#0F766E"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="6 4"
          />
        )}
        <circle cx={l === 'J' ? 60 : 132} cy={l === 'J' ? 72 : 84} r="6" fill="#0F766E" />
        <text x="12" y="102" className="fill-slate-500 font-mono text-[10px]">
          Dynamic motion path ({l})
        </text>
      </svg>
    );
  }

  // Letter-specific visual posture geometry (1-handed teal #0F766E, 2nd hand cobalt #0369A1)
  const renderDiagram = () => {
    switch (l) {
      case 'C':
        return (
          <path
            d="M 110 28 C 72 22, 66 82, 110 76"
            fill="none"
            stroke="#0F766E"
            strokeWidth="6"
            strokeLinecap="round"
          />
        );
      case 'I':
        return (
          <g transform="translate(90, 62)">
            <rect x="-14" y="-6" width="28" height="22" rx="8" fill="#0F766E" opacity="0.2" stroke="#0F766E" strokeWidth="2.5" />
            <line x1="10" y1="-6" x2="12" y2="-38" stroke="#0F766E" strokeWidth="4" strokeLinecap="round" />
          </g>
        );
      case 'L':
        return (
          <g transform="translate(88, 66)">
            <line x1="-6" y1="6" x2="-6" y2="-38" stroke="#0F766E" strokeWidth="4.5" strokeLinecap="round" />
            <line x1="-6" y1="6" x2="34" y2="6" stroke="#0F766E" strokeWidth="4.5" strokeLinecap="round" />
            <circle cx="-6" cy="6" r="4.5" fill="#0F766E" />
          </g>
        );
      case 'O':
        return (
          <ellipse cx="90" cy="52" rx="22" ry="25" fill="none" stroke="#0F766E" strokeWidth="5" />
        );
      case 'U':
        return (
          <g transform="translate(90, 64)">
            <rect x="-14" y="-4" width="28" height="20" rx="7" fill="#0F766E" opacity="0.2" stroke="#0F766E" strokeWidth="2.5" />
            <line x1="-4" y1="-4" x2="-4" y2="-38" stroke="#0F766E" strokeWidth="4" strokeLinecap="round" />
            <line x1="4" y1="-4" x2="4" y2="-38" stroke="#0F766E" strokeWidth="4" strokeLinecap="round" />
          </g>
        );
      case 'V':
        return (
          <g transform="translate(90, 64)">
            <rect x="-14" y="-4" width="28" height="20" rx="7" fill="#0F766E" opacity="0.2" stroke="#0F766E" strokeWidth="2.5" />
            <line x1="-3" y1="-4" x2="-15" y2="-38" stroke="#0F766E" strokeWidth="4" strokeLinecap="round" />
            <line x1="3" y1="-4" x2="15" y2="-38" stroke="#0F766E" strokeWidth="4" strokeLinecap="round" />
          </g>
        );
      case 'A':
        return (
          <g>
            <rect x="44" y="48" width="26" height="26" rx="8" fill="#0F766E" opacity="0.2" stroke="#0F766E" strokeWidth="2.5" />
            <line x1="70" y1="54" x2="78" y2="30" stroke="#0F766E" strokeWidth="4" strokeLinecap="round" />
            <line x1="126" y1="60" x2="80" y2="32" stroke="#0369A1" strokeWidth="4" strokeLinecap="round" />
          </g>
        );
      case 'B':
        return (
          <g>
            <path d="M 86 28 C 52 24, 52 78, 86 74" fill="none" stroke="#0F766E" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M 94 28 C 128 24, 128 78, 94 74" fill="none" stroke="#0369A1" strokeWidth="4.5" strokeLinecap="round" />
          </g>
        );
      case 'D':
        return (
          <g>
            <line x1="68" y1="22" x2="68" y2="78" stroke="#0F766E" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M 70 26 C 116 26, 116 74, 70 74" fill="none" stroke="#0369A1" strokeWidth="4.5" strokeLinecap="round" />
          </g>
        );
      case 'K':
        return (
          <g>
            <line x1="70" y1="22" x2="70" y2="78" stroke="#0F766E" strokeWidth="4.5" strokeLinecap="round" />
            <line x1="72" y1="50" x2="114" y2="26" stroke="#0369A1" strokeWidth="4" strokeLinecap="round" />
            <line x1="72" y1="50" x2="114" y2="74" stroke="#0369A1" strokeWidth="4" strokeLinecap="round" />
          </g>
        );
      case 'M':
      case 'N': {
        const fingers = l === 'M' ? [-10, 0, 10] : [-5, 5];
        return (
          <g>
            <rect x="44" y="54" width="46" height="14" rx="6" fill="#0F766E" opacity="0.25" stroke="#0F766E" strokeWidth="2.5" />
            {fingers.map((dx) => (
              <line key={dx} x1={67 + dx} y1="60" x2={98 + dx} y2="26" stroke="#0369A1" strokeWidth="3.5" strokeLinecap="round" />
            ))}
          </g>
        );
      }
      case 'T':
        return (
          <g>
            <line x1="88" y1="28" x2="88" y2="80" stroke="#0F766E" strokeWidth="4.5" strokeLinecap="round" />
            <line x1="56" y1="28" x2="122" y2="28" stroke="#0369A1" strokeWidth="4.5" strokeLinecap="round" />
          </g>
        );
      case 'X':
        return (
          <g>
            <line x1="62" y1="24" x2="118" y2="76" stroke="#0F766E" strokeWidth="4.5" strokeLinecap="round" />
            <line x1="118" y1="24" x2="62" y2="76" stroke="#0369A1" strokeWidth="4.5" strokeLinecap="round" />
          </g>
        );
      default:
        return (
          <g>
            <g transform={guide.handMode === 'two-handed' ? 'translate(58, 56)' : 'translate(90, 56)'}>
              <circle cx="0" cy="20" r="4.5" fill="#0F766E" />
              <line x1="0" y1="20" x2="-15" y2="2" stroke="#0F766E" strokeWidth="2.5" />
              <line x1="0" y1="20" x2="-8" y2="-22" stroke="#0F766E" strokeWidth="2.5" />
              <line x1="0" y1="20" x2="0" y2="-26" stroke="#0F766E" strokeWidth="2.5" />
              <line x1="0" y1="20" x2="8" y2="-22" stroke="#0F766E" strokeWidth="2.5" />
              <line x1="0" y1="20" x2="16" y2="-14" stroke="#0F766E" strokeWidth="2.5" />
            </g>
            {guide.handMode === 'two-handed' && (
              <g transform="translate(122, 56)">
                <circle cx="0" cy="20" r="4.5" fill="#0369A1" />
                <line x1="0" y1="20" x2="-16" y2="-14" stroke="#0369A1" strokeWidth="2.5" />
                <line x1="0" y1="20" x2="-8" y2="-22" stroke="#0369A1" strokeWidth="2.5" />
                <line x1="0" y1="20" x2="0" y2="-26" stroke="#0369A1" strokeWidth="2.5" />
                <line x1="0" y1="20" x2="8" y2="-22" stroke="#0369A1" strokeWidth="2.5" />
                <line x1="0" y1="20" x2="15" y2="2" stroke="#0369A1" strokeWidth="2.5" />
              </g>
            )}
          </g>
        );
    }
  };

  return (
    <svg viewBox="0 0 180 110" className="h-28 w-full rounded-lg bg-slate-50">
      {renderDiagram()}
      <text x="12" y="102" className="fill-slate-500 font-mono text-[10px]">
        {guide.handMode === 'two-handed' ? '2-hand coordination (42 landmarks)' : '1-hand posture (21 landmarks)'}
      </text>
    </svg>
  );
}

export function LearnIslView({ onNavigate }: LearnIslViewProps) {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [selected, setSelected] = useState<IslLetterGuide>(ISL_ALPHABET_GUIDE[0]);
  const [studyImgFailed, setStudyImgFailed] = useState(false);

  const [practiceTarget, setPracticeTarget] = useState<string>('B');
  const [practiceFeedback, setPracticeFeedback] = useState<string | null>(null);
  const [practiceChecking, setPracticeChecking] = useState(false);

  const filteredLetters = ISL_ALPHABET_GUIDE.filter((item) =>
    filter === 'all' ? true : item.handMode === filter
  );

  const runPracticeSampleCheck = async () => {
    if (practiceTarget === 'J' || practiceTarget === 'Z') {
      setPracticeFeedback(
        `Dynamic gesture '${practiceTarget}' requires continuous movement in Live Studio using the trajectory detector.`
      );
      return;
    }
    setPracticeChecking(true);
    setPracticeFeedback(null);
    try {
      const sampleRes = await fetch(`/api/sample-frame/${practiceTarget}`);
      const sampleData = (await sampleRes.json()) as { features?: number[] };
      if (!sampleData.features) throw new Error('Sample unavailable');

      const predRes = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: sampleData.features, confidence_threshold: 0.45 }),
      });
      const predData = (await predRes.json()) as {
        raw_top_label: string;
        confidence: number;
      };
      const matched = predData.raw_top_label === practiceTarget;
      setPracticeFeedback(
        matched
          ? `Practice Verified: Classifier matched '${predData.raw_top_label}' at ${Math.round(
              predData.confidence * 100
            )}% confidence.`
          : `Model predicted '${predData.raw_top_label}' (${Math.round(
              predData.confidence * 100
            )}%) — review finger separation for '${practiceTarget}'.`
      );
    } catch {
      setPracticeFeedback('Unable to reach prediction backend.');
    } finally {
      setPracticeChecking(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Positioning Banner */}
      <section className="grid grid-cols-1 items-stretch gap-6 rounded-xl border border-slate-200 bg-white p-6 lg:grid-cols-12">
        <div className="flex flex-col justify-center lg:col-span-7">
          <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            Authentic Indian Sign Language A–Z Guide
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Learn how each English letter is formed in Indian Sign Language. Keep your hands at
            chest-to-shoulder height, maintain even front lighting, and check whether the sign uses
            one hand, two hands, or dynamic motion.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  { id: 'all', label: 'All 26' },
                  { id: 'one-handed', label: 'One-Handed (6)' },
                  { id: 'two-handed', label: 'Two-Handed (18)' },
                  { id: 'dynamic', label: 'Dynamic Motion (2)' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    filter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="h-full min-h-[180px] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            {!studyImgFailed ? (
              <img
                src={studyImage}
                alt="Educator hands positioned at chest height demonstrating Indian Sign Language clarity"
                referrerPolicy="no-referrer"
                onError={() => setStudyImgFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-slate-500">
                <Hand className="h-10 w-10 text-teal-700" aria-hidden="true" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Alphabet Grid + Study Detail */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Letter Grid */}
        <div className="lg:col-span-7">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {filteredLetters.map((item) => {
              const isSelected = selected.letter === item.letter;
              return (
                <button
                  key={item.letter}
                  type="button"
                  onClick={() => {
                    setSelected(item);
                    setPracticeTarget(item.letter);
                    setPracticeFeedback(null);
                  }}
                  className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-colors ${
                    isSelected
                      ? 'border-teal-700 bg-teal-50/70 text-teal-950'
                      : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-display text-2xl font-bold">{item.letter}</span>
                  <span className="mt-1 text-[11px] font-medium text-slate-500">
                    {item.handMode === 'one-handed'
                      ? '1-hand'
                      : item.handMode === 'two-handed'
                      ? '2-hand'
                      : 'Motion'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Letter Study & Practice Card */}
        <aside className="space-y-6 lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-4xl font-extrabold text-teal-800">
                  {selected.letter}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {selected.handMode === 'one-handed'
                    ? 'One-Handed Sign'
                    : selected.handMode === 'two-handed'
                    ? 'Two-Handed Sign'
                    : 'Dynamic Trajectory Sign'}
                </span>
              </div>
            </div>

            <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
              {selected.postureTitle}
            </h2>

            <div className="mt-4">
              <HandSchematic guide={selected} />
            </div>

            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
              {selected.instructions.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>

            <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
              <p>
                <strong className="font-semibold text-slate-800">ISL vs ASL:</strong>{' '}
                {selected.islVsAslNote}
              </p>
              <p>
                <strong className="font-semibold text-slate-800">Camera Tip:</strong>{' '}
                {selected.cameraTip}
              </p>
            </div>

            {/* Practice Mode Actions */}
            <div className="mt-6 space-y-3 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => onNavigate('live')}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
                >
                  Practice in Live Studio
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={runPracticeSampleCheck}
                  disabled={practiceChecking}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                  {practiceChecking ? 'Checking...' : `Test Held-Out '${practiceTarget}'`}
                </button>
              </div>

              {practiceFeedback && (
                <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
                  <span>{practiceFeedback}</span>
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

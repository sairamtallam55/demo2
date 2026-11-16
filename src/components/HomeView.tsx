import { ArrowRight, BookOpen, Camera, Cpu, Hand, Layers } from 'lucide-react';
import { useState } from 'react';
import heroImage from '../assets/images/hero_isl_landmarks_1794752513340.jpg';
import type { AppRoute } from './TopBar';

interface HomeViewProps {
  onNavigate: (route: AppRoute) => void;
}

const PIPELINE_STEPS = [
  {
    step: '01',
    title: 'Webcam Capture',
    description:
      'Browser requests explicit camera permission and streams live frames locally without uploading raw video.',
    icon: Camera,
  },
  {
    step: '02',
    title: 'MediaPipe 21-Point Landmarks',
    description:
      'Tracks up to two hands simultaneously (42 total joints) to support both unimanual and bimanual ISL signs.',
    icon: Hand,
  },
  {
    step: '03',
    title: 'Wrist-Centered Normalization',
    description:
      'Converts 3D coordinates into a scale- and position-invariant 130-feature vector matching training preprocessing.',
    icon: Layers,
  },
  {
    step: '04',
    title: 'Random Forest & Motion Filter',
    description:
      'Predicts A–Z with confidence thresholds, multi-frame consensus smoothing, and trajectory tracking for J and Z.',
    icon: Cpu,
  },
];

export function HomeView({ onNavigate }: HomeViewProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      {/* Hero Split */}
      <section className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
        <div className="flex flex-col justify-center lg:col-span-6">
          <p className="text-xs font-semibold tracking-wider text-teal-700 uppercase">
            Indian Sign Language Computer Vision Workbench
          </p>
          <h1
            className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl"
            style={{ textWrap: 'balance' }}
          >
            Real-Time Indian Sign Language Alphabet Recognition
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
            Practice and recognize authentic Indian Sign Language (ISL) fingerspelling from A to Z
            directly in your browser. Unlike single-handed American Sign Language, authentic ISL
            combines one-handed, two-handed, and dynamic motion signs—tracked via 21-point
            MediaPipe hand landmarks and classified by a Scikit-Learn Random Forest model.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate('live')}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              Start Recognition
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('learn')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <BookOpen className="h-4 w-4 text-teal-700" aria-hidden="true" />
              Explore ISL Alphabet Guide
            </button>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="relative h-full min-h-[280px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            {!imgFailed ? (
              <img
                src={heroImage}
                alt="Two hands demonstrating Indian Sign Language gesture with 21-point MediaPipe landmark overlay"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-teal-50 p-8 text-center">
                <Hand className="h-12 w-12 text-teal-700" aria-hidden="true" />
                <p className="mt-3 font-display text-base font-semibold text-slate-800">
                  Dual-Hand 21-Landmark ISL Tracking
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Full-Width 4-Column Specification Strip */}
      <section
        aria-label="System specifications"
        className="mt-10 grid grid-cols-1 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x"
      >
        <div className="p-6">
          <p className="text-xs font-medium text-slate-500">Authentic ISL Coverage</p>
          <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            26 Letters
          </p>
          <p className="mt-1 text-xs text-slate-600">6 one-handed · 18 two-handed · 2 dynamic</p>
        </div>
        <div className="p-6">
          <p className="text-xs font-medium text-slate-500">Landmark Feature Vector</p>
          <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            130 Features
          </p>
          <p className="mt-1 text-xs text-slate-600">21 × 3 coords/hand · up to 2 hands</p>
        </div>
        <div className="p-6">
          <p className="text-xs font-medium text-slate-500">Classification Backend</p>
          <p className="mt-1 font-display text-2xl font-bold text-slate-900">Random Forest</p>
          <p className="mt-1 text-xs text-slate-600">Scikit-Learn · Joblib · Flask REST API</p>
        </div>
        <div className="p-6">
          <p className="text-xs font-medium text-slate-500">Prototype Held-Out Test</p>
          <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            96.09%
          </p>
          <p className="mt-1 text-xs text-slate-600">Leak-free GroupShuffleSplit · 24 static signs</p>
        </div>
      </section>

      {/* About ISL & Comparison */}
      <section className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-7 lg:col-span-5">
          <h2 className="font-display text-xl font-bold text-slate-900">
            Why Indian Sign Language Requires Two-Hand Tracking
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Many beginner tutorials mistakenly label American Sign Language (ASL) images as ISL.
            In reality, ASL fingerspelling is strictly one-handed, whereas authentic Indian Sign
            Language (standardized by ISLRTC and documented in datasets like ISLAN and THISL) uses
            both hands together for most letters—such as A, B, D, E, F, G, H, K, M, N, P, Q, R, S,
            T, W, X, and Y—while C, I, L, O, U, and V are unimanual, and J and Z require dynamic
            motion trajectories.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('collect')}
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800"
          >
            Record real webcam samples to customize the model
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* How It Works */}
        <div className="lg:col-span-7">
          <h2 className="font-display text-xl font-bold text-slate-900">
            How the Recognition Pipeline Works
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PIPELINE_STEPS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="rounded-xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-teal-700 tabular-nums">
                      {item.step}
                    </span>
                    <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  </div>
                  <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

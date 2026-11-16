import { useState } from 'react';
import { AboutProjectView } from './components/AboutProjectView';
import { CollectTrainView } from './components/CollectTrainView';
import { HomeView } from './components/HomeView';
import { LearnIslView } from './components/LearnIslView';
import { LiveRecognitionView } from './components/LiveRecognitionView';
import { TopBar, type AppRoute } from './components/TopBar';

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'live';
    }
    return 'home';
  });

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <TopBar activeRoute={route} onNavigate={setRoute} />

      <main className="flex-1">
        {route === 'home' && <HomeView onNavigate={setRoute} />}
        {route === 'live' && <LiveRecognitionView />}
        {route === 'learn' && <LearnIslView onNavigate={setRoute} />}
        {route === 'collect' && <CollectTrainView />}
        {route === 'about' && <AboutProjectView />}
      </main>

      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <p>MudraLab ISL · Authentic Indian Sign Language A–Z Recognition Workbench</p>
          <p>Camera video is processed locally in your browser via MediaPipe Hand Landmarker.</p>
        </div>
      </footer>
    </div>
  );
}

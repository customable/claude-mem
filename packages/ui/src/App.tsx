/**
 * Main App Component
 *
 * Simple dashboard layout with DaisyUI 5+
 */

import { useState } from 'react';
import { StatusBar } from './components/StatusBar';
import { ObservationList } from './components/ObservationList';
import { WorkerStatus } from './components/WorkerStatus';

type View = 'observations' | 'workers';

export function App() {
  const [view, setView] = useState<View>('observations');

  return (
    <div className="min-h-screen flex flex-col" data-theme="dark">
      {/* Header / Navbar */}
      <header className="navbar bg-base-100 border-b border-base-300 px-4 lg:px-6">
        <div className="flex-1">
          <span className="text-lg font-semibold text-base-content">Claude-Mem</span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex-none">
          <div role="tablist" className="tabs tabs-box">
            <button
              role="tab"
              className={`tab ${view === 'observations' ? 'tab-active' : ''}`}
              onClick={() => setView('observations')}
            >
              <span className="iconify ph--note size-4 mr-1.5" />
              Observations
            </button>
            <button
              role="tab"
              className={`tab ${view === 'workers' ? 'tab-active' : ''}`}
              onClick={() => setView('workers')}
            >
              <span className="iconify ph--cpu size-4 mr-1.5" />
              Workers
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex-none ml-4">
          <StatusBar />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-6">
        <div className="container max-w-6xl">
          {view === 'observations' && <ObservationList />}
          {view === 'workers' && <WorkerStatus />}
        </div>
      </main>
    </div>
  );
}

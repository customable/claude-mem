/**
 * Main App Component
 *
 * Dashboard layout with DaisyUI 5+
 */

import { useState } from 'react';
import { StatusBar } from './components/StatusBar';
import { ObservationList } from './components/ObservationList';
import { WorkerStatus } from './components/WorkerStatus';
import { Console } from './components/Console';
import { SearchView } from './views/Search';
import { SettingsView } from './views/Settings';

type View = 'observations' | 'workers' | 'search' | 'settings';

export function App() {
  const [view, setView] = useState<View>('observations');
  const [consoleOpen, setConsoleOpen] = useState(false);

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
            <button
              role="tab"
              className={`tab ${view === 'search' ? 'tab-active' : ''}`}
              onClick={() => setView('search')}
            >
              <span className="iconify ph--magnifying-glass size-4 mr-1.5" />
              Search
            </button>
            <button
              role="tab"
              className={`tab ${view === 'settings' ? 'tab-active' : ''}`}
              onClick={() => setView('settings')}
            >
              <span className="iconify ph--gear size-4 mr-1.5" />
              Settings
            </button>
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex-none ml-4 flex items-center gap-2">
          <button
            className={`btn btn-ghost btn-sm btn-square ${consoleOpen ? 'text-primary' : ''}`}
            onClick={() => setConsoleOpen(!consoleOpen)}
            title="Toggle Console"
          >
            <span className="iconify ph--terminal size-5" />
          </button>
          <StatusBar />
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 p-4 lg:p-6 ${consoleOpen ? 'pb-80' : ''}`}>
        <div className="container max-w-6xl mx-auto">
          {view === 'observations' && <ObservationList />}
          {view === 'workers' && <WorkerStatus />}
          {view === 'search' && <SearchView />}
          {view === 'settings' && <SettingsView />}
        </div>
      </main>

      {/* Console Drawer */}
      <Console isOpen={consoleOpen} onClose={() => setConsoleOpen(false)} />
    </div>
  );
}

/**
 * Main App Component
 *
 * Dashboard layout with DaisyUI 5+
 */

import { useState, useEffect } from 'react';
import { StatusBar } from './components/StatusBar';
import { WorkerStatus } from './components/WorkerStatus';
import { Console } from './components/Console';
import { DashboardView } from './views/Dashboard';
import { SessionsView } from './views/Sessions';
import { SearchView } from './views/Search';
import { SettingsView } from './views/Settings';
import { LiveView } from './views/Live';
import { MemoriesView } from './views/Memories';
import { AnalyticsView } from './views/Analytics';
import { ProjectsView } from './views/Projects';
import { DocumentsView } from './views/Documents';

type View = 'dashboard' | 'memories' | 'sessions' | 'live' | 'search' | 'analytics' | 'projects' | 'documents' | 'workers' | 'settings';

const VALID_VIEWS: View[] = ['dashboard', 'memories', 'sessions', 'live', 'search', 'analytics', 'projects', 'documents', 'workers', 'settings'];

function getViewFromHash(): View {
  const hash = window.location.hash.slice(1).split('?')[0]; // Remove # and query params
  if (VALID_VIEWS.includes(hash as View)) {
    return hash as View;
  }
  return 'dashboard';
}

function setViewInHash(view: View): void {
  window.history.pushState(null, '', `#${view}`);
}

export function App() {
  const [view, setView] = useState<View>(getViewFromHash);
  const [consoleOpen, setConsoleOpen] = useState(false);

  // Handle browser back/forward
  useEffect(() => {
    const handleHashChange = () => {
      setView(getViewFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Navigate to view (updates both state and hash)
  const navigateTo = (newView: View) => {
    setView(newView);
    setViewInHash(newView);
  };

  const tabs: { id: View; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'ph--house' },
    { id: 'memories', label: 'Memories', icon: 'ph--brain' },
    { id: 'sessions', label: 'Sessions', icon: 'ph--clock-counter-clockwise' },
    { id: 'live', label: 'Live', icon: 'ph--broadcast' },
    { id: 'search', label: 'Search', icon: 'ph--magnifying-glass' },
    { id: 'analytics', label: 'Analytics', icon: 'ph--chart-line' },
    { id: 'projects', label: 'Projects', icon: 'ph--folder-open' },
    { id: 'documents', label: 'Docs', icon: 'ph--files' },
    { id: 'workers', label: 'Workers', icon: 'ph--cpu' },
    { id: 'settings', label: 'Settings', icon: 'ph--gear' },
  ];

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
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                className={`tab ${view === tab.id ? 'tab-active' : ''}`}
                onClick={() => navigateTo(tab.id)}
              >
                <span className={`iconify ${tab.icon} size-4 mr-1.5`} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
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
          {view === 'dashboard' && <DashboardView />}
          {view === 'memories' && <MemoriesView />}
          {view === 'sessions' && <SessionsView />}
          {view === 'live' && <LiveView />}
          {view === 'search' && <SearchView />}
          {view === 'analytics' && <AnalyticsView />}
          {view === 'projects' && <ProjectsView />}
          {view === 'documents' && <DocumentsView />}
          {view === 'workers' && <WorkerStatus />}
          {view === 'settings' && <SettingsView />}
        </div>
      </main>

      {/* Console Drawer */}
      <Console isOpen={consoleOpen} onClose={() => setConsoleOpen(false)} />
    </div>
  );
}

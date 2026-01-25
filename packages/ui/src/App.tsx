/**
 * Main App Component
 *
 * Dashboard layout with responsive sidebar navigation.
 * Uses DaisyUI 5+ and CSS-only toggle pattern for mobile.
 */

import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
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
import { InsightsView } from './views/Insights';
import { TasksView } from './views/Tasks';

export type View = 'dashboard' | 'memories' | 'sessions' | 'live' | 'search' | 'analytics' | 'insights' | 'projects' | 'documents' | 'tasks' | 'workers' | 'settings';

const VALID_VIEWS: View[] = ['dashboard', 'memories', 'sessions', 'live', 'search', 'analytics', 'insights', 'projects', 'documents', 'tasks', 'workers', 'settings'];

function getViewFromHash(): View {
  const hash = window.location.hash.slice(1).split('?')[0];
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

  return (
    <div data-theme="dark">
      {/* Hidden checkbox for CSS-only sidebar toggle (mobile) */}
      <input
        type="checkbox"
        id="layout-sidebar-toggle"
        className="hidden"
        aria-label="Toggle sidebar"
      />

      {/* Backdrop overlay for mobile (closes sidebar on tap) */}
      <label
        htmlFor="layout-sidebar-toggle"
        id="layout-sidebar-backdrop"
        aria-label="Close sidebar"
      />

      {/* Main Layout Container */}
      <div id="layout-container">
        {/* Sidebar Navigation */}
        <Sidebar currentView={view} onNavigate={navigateTo} />

        {/* Main Content Area */}
        <div id="layout-main">
          {/* Topbar */}
          <header id="layout-topbar" className="flex items-center gap-2 px-4 h-14">
            {/* Hamburger Menu (mobile/tablet only) */}
            <label
              htmlFor="layout-sidebar-toggle"
              className="hamburger-btn lg:hidden"
              aria-label="Open menu"
            >
              <span className="iconify ph--list size-5" />
            </label>

            {/* Page Title - show current view */}
            <h1 className="text-lg font-medium capitalize flex-1 lg:hidden">
              {view}
            </h1>

            {/* Spacer for desktop */}
            <div className="flex-1 hidden lg:block" />

            {/* Right Side Actions */}
            <div className="flex items-center gap-2">
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
          <main id="layout-content" className={consoleOpen ? 'pb-80' : ''}>
            <div className="container max-w-6xl mx-auto">
              {view === 'dashboard' && <DashboardView />}
              {view === 'memories' && <MemoriesView />}
              {view === 'sessions' && <SessionsView />}
              {view === 'live' && <LiveView />}
              {view === 'search' && <SearchView />}
              {view === 'analytics' && <AnalyticsView />}
              {view === 'insights' && <InsightsView />}
              {view === 'projects' && <ProjectsView />}
              {view === 'documents' && <DocumentsView />}
              {view === 'tasks' && <TasksView />}
              {view === 'workers' && <WorkerStatus />}
              {view === 'settings' && <SettingsView />}
            </div>
          </main>
        </div>
      </div>

      {/* Console Drawer */}
      <Console isOpen={consoleOpen} onClose={() => setConsoleOpen(false)} />
    </div>
  );
}

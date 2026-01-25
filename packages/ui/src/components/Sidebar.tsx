/**
 * Sidebar Component
 *
 * Responsive sidebar navigation using CSS-only toggle pattern.
 * Based on the Nexus template implementation.
 */

import type { View } from '../App';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

interface NavItem {
  id: View;
  label: string;
  icon: string;
  section?: string;
}

const navItems: NavItem[] = [
  // Main
  { id: 'dashboard', label: 'Dashboard', icon: 'ph--house', section: 'Main' },
  { id: 'memories', label: 'Memories', icon: 'ph--brain' },
  { id: 'sessions', label: 'Sessions', icon: 'ph--clock-counter-clockwise' },
  { id: 'live', label: 'Live', icon: 'ph--broadcast' },
  // Search & Analytics
  { id: 'search', label: 'Search', icon: 'ph--magnifying-glass', section: 'Explore' },
  { id: 'analytics', label: 'Analytics', icon: 'ph--chart-line' },
  { id: 'insights', label: 'Insights', icon: 'ph--trophy' },
  // Data
  { id: 'projects', label: 'Projects', icon: 'ph--folder-open', section: 'Data' },
  { id: 'documents', label: 'Documents', icon: 'ph--files' },
  // System
  { id: 'tasks', label: 'Tasks', icon: 'ph--queue', section: 'System' },
  { id: 'workers', label: 'Workers', icon: 'ph--cpu' },
  { id: 'settings', label: 'Settings', icon: 'ph--gear' },
];

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  // Group items by section
  let currentSection = '';

  const handleClick = (view: View) => {
    onNavigate(view);
    // Close sidebar on mobile after navigation
    const toggle = document.getElementById('layout-sidebar-toggle') as HTMLInputElement;
    if (toggle) {
      toggle.checked = false;
    }
  };

  return (
    <aside id="layout-sidebar" className="sidebar-menu">
      {/* Logo / Brand */}
      <div className="flex h-14 items-center px-4 border-b border-base-300">
        <span className="text-lg font-semibold text-base-content">Claude-Mem</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map((item) => {
          const showSection = item.section && item.section !== currentSection;
          if (item.section) currentSection = item.section;

          return (
            <div key={item.id}>
              {showSection && (
                <div className="menu-label mt-4 first:mt-0">{item.section}</div>
              )}
              <button
                className={`menu-item w-full ${currentView === item.id ? 'active' : ''}`}
                onClick={() => handleClick(item.id)}
              >
                <span className={`iconify ${item.icon} size-5`} />
                <span className="flex-1 text-left">{item.label}</span>
              </button>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-base-300">
        <div className="text-xs text-base-content/50 text-center py-2">
          v2.49.6
        </div>
      </div>
    </aside>
  );
}

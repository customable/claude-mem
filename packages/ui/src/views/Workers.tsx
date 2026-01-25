/**
 * Workers View (Issue #263)
 *
 * Unified view for worker management with tabs for:
 * - Workers: Connected workers and spawning
 * - Hubs: Hub federation overview
 * - Tokens: Worker registration tokens
 */

import { useState } from 'react';
import { WorkerStatus } from '../components/WorkerStatus';
import { HubOverview } from '../components/HubOverview';
import { TokenList } from '../components/TokenList';

type Tab = 'workers' | 'hubs' | 'tokens';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'workers', label: 'Workers', icon: 'ph--cpu' },
  { id: 'hubs', label: 'Hubs', icon: 'ph--buildings' },
  { id: 'tokens', label: 'Tokens', icon: 'ph--key' },
];

export function WorkersView() {
  const [activeTab, setActiveTab] = useState<Tab>('workers');

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="tabs tabs-boxed bg-base-200 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab gap-2 ${activeTab === tab.id ? 'tab-active' : ''}`}
          >
            <span className={`iconify ${tab.icon} size-4`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'workers' && <WorkerStatus />}
        {activeTab === 'hubs' && <HubOverview />}
        {activeTab === 'tokens' && <TokenList />}
      </div>
    </div>
  );
}

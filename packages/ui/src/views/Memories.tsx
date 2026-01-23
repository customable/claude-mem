/**
 * Memories View
 *
 * Timeline-based visualization of observations with filtering.
 */

import { useState, useMemo } from 'react';
import { api, type Observation } from '../api/client';
import { useQuery } from '../hooks/useApi';

/**
 * Observation type configuration for UI rendering
 */
const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string; emoji: string }> = {
  // Work Types
  bugfix: { icon: 'ph--bug', color: 'text-error', label: 'Bug Fix', emoji: '🔴' },
  feature: { icon: 'ph--star', color: 'text-secondary', label: 'Feature', emoji: '🟣' },
  refactor: { icon: 'ph--arrows-clockwise', color: 'text-info', label: 'Refactor', emoji: '🔄' },
  change: { icon: 'ph--check-circle', color: 'text-success', label: 'Change', emoji: '✅' },
  // Documentation & Config
  docs: { icon: 'ph--file-text', color: 'text-base-content', label: 'Documentation', emoji: '📝' },
  config: { icon: 'ph--gear', color: 'text-base-content/80', label: 'Config', emoji: '⚙️' },
  // Quality & Testing
  test: { icon: 'ph--test-tube', color: 'text-accent', label: 'Test', emoji: '🧪' },
  security: { icon: 'ph--shield-check', color: 'text-error', label: 'Security', emoji: '🔒' },
  performance: { icon: 'ph--lightning', color: 'text-warning', label: 'Performance', emoji: '⚡' },
  // Infrastructure
  deploy: { icon: 'ph--rocket-launch', color: 'text-primary', label: 'Deployment', emoji: '🚀' },
  infra: { icon: 'ph--buildings', color: 'text-neutral', label: 'Infrastructure', emoji: '🏗️' },
  migration: { icon: 'ph--database', color: 'text-info', label: 'Migration', emoji: '🔀' },
  // Knowledge Types
  discovery: { icon: 'ph--magnifying-glass', color: 'text-primary', label: 'Discovery', emoji: '🔵' },
  decision: { icon: 'ph--scales', color: 'text-warning', label: 'Decision', emoji: '⚖️' },
  research: { icon: 'ph--flask', color: 'text-primary', label: 'Research', emoji: '🔬' },
  // Integration
  api: { icon: 'ph--plugs-connected', color: 'text-secondary', label: 'API', emoji: '🔌' },
  integration: { icon: 'ph--link', color: 'text-accent', label: 'Integration', emoji: '🔗' },
  dependency: { icon: 'ph--package', color: 'text-base-content/70', label: 'Dependency', emoji: '📦' },
  // Planning & Tasks
  task: { icon: 'ph--check-square', color: 'text-accent', label: 'Task', emoji: '☑️' },
  plan: { icon: 'ph--list-checks', color: 'text-info', label: 'Plan', emoji: '📋' },
  // Session
  'session-request': { icon: 'ph--chat-text', color: 'text-base-content/60', label: 'Request', emoji: '💬' },
};

interface Filters {
  project: string;
  type: string;
  search: string;
}

export function MemoriesView() {
  const [filters, setFilters] = useState<Filters>({ project: '', type: '', search: '' });
  const [limit] = useState(100);

  // Fetch observations
  const { data, loading, error, refetch } = useQuery(
    () => api.getObservations({ limit, project: filters.project || '' }),
    [limit, filters.project]
  );

  // Fetch projects for filter dropdown
  const { data: projectsData } = useQuery(() => api.getProjects(), []);

  const observations = useMemo(() => {
    let items = data?.items || [];

    // Client-side filtering
    if (filters.type) {
      items = items.filter((o) => o.type === filters.type);
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      items = items.filter(
        (o) =>
          o.title?.toLowerCase().includes(search) ||
          o.narrative?.toLowerCase().includes(search) ||
          o.text?.toLowerCase().includes(search)
      );
    }

    return items;
  }, [data, filters.type, filters.search]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, Observation[]> = {};

    observations.forEach((obs) => {
      const date = new Date(obs.created_at).toLocaleDateString('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(obs);
    });

    return groups;
  }, [observations]);

  const types = Object.keys(TYPE_CONFIG);
  const projects = projectsData?.projects || [];

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-base-content/60">
        <span className="loading loading-spinner loading-md mb-2" />
        <span>Loading memories...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span className="iconify ph--warning-circle size-5" />
        <span>Failed to load memories</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Memories</h2>
          <span className="badge badge-neutral badge-sm">{observations.length} items</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="join">
            <span className="join-item btn btn-sm btn-ghost pointer-events-none">
              <span className="iconify ph--magnifying-glass size-4" />
            </span>
            <input
              type="text"
              placeholder="Search..."
              className="input input-sm input-bordered join-item w-40"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </div>

          {/* Project Filter */}
          <select
            className="select select-sm select-bordered"
            value={filters.project}
            onChange={(e) => setFilters((f) => ({ ...f, project: e.target.value }))}
          >
            <option value="">All Projects</option>
            {projects.filter(Boolean).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            className="select select-sm select-bordered"
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="">All Types</option>
            {types.map((t) => (
              <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>
            ))}
          </select>

          {/* Refresh */}
          <button onClick={refetch} className="btn btn-ghost btn-sm btn-square">
            <span className="iconify ph--arrows-clockwise size-4" />
          </button>
        </div>
      </div>

      {/* Timeline */}
      {observations.length === 0 ? (
        <div className="card bg-base-100 card-border">
          <div className="card-body items-center justify-center py-12 text-base-content/60">
            <span className="iconify ph--brain size-12 mb-2" />
            <span>No memories found</span>
            {(filters.search || filters.type) && (
              <button
                className="btn btn-ghost btn-sm mt-2"
                onClick={() => setFilters({ project: filters.project, type: '', search: '' })}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([date, items]) => (
            <div key={date}>
              {/* Date Header */}
              <div className="sticky top-0 z-10 bg-base-200/80 backdrop-blur-sm px-3 py-2 rounded-lg mb-3">
                <span className="text-sm font-medium">{date}</span>
                <span className="text-xs text-base-content/50 ml-2">({items.length} items)</span>
              </div>

              {/* Timeline Items */}
              <div className="relative pl-6 border-l-2 border-base-300 space-y-3">
                {items.map((obs) => (
                  <MemoryCard key={obs.id} observation={obs} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MemoryCard({ observation }: { observation: Observation }) {
  const [expanded, setExpanded] = useState(false);
  const config = TYPE_CONFIG[observation.type] || { icon: 'ph--dot', color: 'text-base-content', label: observation.type };
  const time = new Date(observation.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="relative">
      {/* Timeline Dot */}
      <div className={`absolute -left-[1.6rem] w-3 h-3 rounded-full bg-base-100 border-2 ${config.color.replace('text-', 'border-')}`} />

      {/* Card */}
      <div
        className="card bg-base-100 card-border ml-2 cursor-pointer hover:bg-base-200/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="card-body p-3">
          <div className="flex items-start gap-3">
            <span className={`iconify ${config.icon} size-5 ${config.color} mt-0.5 shrink-0`} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{observation.title || 'Untitled'}</span>
                <span className="badge badge-ghost badge-xs">{config.label}</span>
                {observation.project && (
                  <span className="badge badge-primary badge-xs badge-outline">{observation.project}</span>
                )}
              </div>

              {observation.subtitle && (
                <p className="text-xs text-base-content/60 mt-0.5">{observation.subtitle}</p>
              )}
            </div>

            <span className="text-xs text-base-content/50 shrink-0">{time}</span>

            <span className={`iconify ph--caret-down size-4 text-base-content/40 transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`} />
          </div>

          {/* Expanded Content */}
          {expanded && observation.narrative && (
            <div className="mt-3 pt-3 border-t border-base-300">
              <p className="text-sm text-base-content/80 leading-relaxed">{observation.narrative}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Memories View
 *
 * Timeline-based visualization of observations with filtering.
 */

import { useState, useMemo } from 'react';
import { api, type Observation } from '../api/client';
import { useQuery } from '../hooks/useApi';
import { TYPE_CONFIG, getTypeConfig } from '../utils/observation';
import { ObservationDetails } from '../components/ObservationDetails';

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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Memories</h2>
          <span className="badge badge-neutral badge-sm">{observations.length} items</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <label className="input input-sm input-bordered flex items-center gap-2 w-40">
            <span className="iconify ph--magnifying-glass size-4 text-base-content/40" />
            <input
              type="text"
              placeholder="Search..."
              className="grow bg-transparent outline-none"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </label>

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
  const config = getTypeConfig(observation.type);
  const time = new Date(observation.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="relative">
      {/* Timeline Dot - centered on the 2px border line */}
      <div className={`absolute -left-[calc(1.5rem+7px)] top-4 w-3 h-3 rounded-full bg-base-100 border-2 ${config.color.replace('text-', 'border-')}`} />

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
                {observation.git_branch && (
                  <span className="badge badge-ghost badge-xs">
                    <span className="iconify ph--git-branch size-3 mr-1" />
                    {observation.git_branch}
                  </span>
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
          {expanded && (
            <div className="mt-3 pt-3 border-t border-base-300">
              <ObservationDetails observation={observation} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

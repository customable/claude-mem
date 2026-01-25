/**
 * Memories View
 *
 * Timeline-based visualization of observations with filtering.
 */

import { useState, useMemo, useEffect } from 'react';
import { api, type Observation } from '../api/client';
import { useQuery } from '../hooks/useApi';
import { useSSE } from '../hooks/useSSE';
import { TYPE_CONFIG, getTypeConfig } from '../utils/observation';
import { ObservationDetails } from '../components/ObservationDetails';

interface Filters {
  project: string;
  type: string;
  search: string;
}

// Page size options for pagination (Issue #277)
const PAGE_SIZES = [20, 50, 100] as const;

export function MemoriesView() {
  const [filters, setFilters] = useState<Filters>({ project: '', type: '', search: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // SSE for real-time updates
  const { lastEvent } = useSSE();

  // Fetch observations with pagination (Issue #277)
  const { data, loading, error, refetch } = useQuery(
    () => api.getObservations({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      project: filters.project || '',
    }),
    [pageSize, page, filters.project]
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filters.project, filters.type, filters.search, pageSize]);

  // Fetch projects for filter dropdown
  const { data: projectsData } = useQuery(() => api.getProjects(), []);

  // Auto-refresh on observation:created events
  useEffect(() => {
    if (lastEvent?.type === 'observation:created') {
      refetch();
    }
  }, [lastEvent, refetch]);

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

  // Calculate total pages (Issue #277)
  const totalItems = data?.total || observations.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Check if any filter is active (Issue #277)
  const hasActiveFilters = filters.search || filters.type || filters.project;

  // Clear all filters (Issue #277)
  const clearFilters = () => {
    setFilters({ project: '', type: '', search: '' });
    setPage(1);
  };

  // Format date with relative labels (Issue #277)
  const formatDateLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if same day
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';

    // Use browser locale for other dates
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Group by date with improved formatting (Issue #277)
  const groupedByDate = useMemo(() => {
    const groups: Record<string, { label: string; items: Observation[] }> = {};

    observations.forEach((obs) => {
      const dateKey = new Date(obs.created_at).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = {
          label: formatDateLabel(obs.created_at),
          items: [],
        };
      }
      groups[dateKey].items.push(obs);
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
      {/* Header & Filters (Issue #277) */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Memories</h2>
          <span className="badge badge-neutral badge-sm">{observations.length} items</span>
          {totalItems > observations.length && (
            <span className="text-xs text-base-content/50">of {totalItems} total</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Clear Filters (Issue #277) */}
          {hasActiveFilters && (
            <button
              className="btn btn-ghost btn-xs gap-1"
              onClick={clearFilters}
              title="Clear all filters"
            >
              <span className="iconify ph--x size-3" />
              Clear
            </button>
          )}

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
            {filters.search && (
              <button
                className="btn btn-ghost btn-xs btn-circle"
                onClick={() => setFilters((f) => ({ ...f, search: '' }))}
              >
                <span className="iconify ph--x size-3" />
              </button>
            )}
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

          {/* Page Size (Issue #277) */}
          <select
            className="select select-sm select-bordered w-20"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            title="Items per page"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>

          {/* Refresh */}
          <button onClick={refetch} className="btn btn-ghost btn-sm btn-square" title="Refresh">
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
          {Object.entries(groupedByDate).map(([dateKey, group]) => (
            <div key={dateKey}>
              {/* Date Header (Issue #277: improved localization) */}
              <div className="sticky top-0 z-10 bg-base-200/80 backdrop-blur-sm px-3 py-2 rounded-lg mb-3">
                <span className="text-sm font-medium">{group.label}</span>
                <span className="text-xs text-base-content/50 ml-2">({group.items.length} items)</span>
              </div>

              {/* Timeline Items */}
              <div className="relative pl-6 border-l-2 border-base-300 space-y-3">
                {group.items.map((obs) => (
                  <MemoryCard key={obs.id} observation={obs} />
                ))}
              </div>
            </div>
          ))}

          {/* Pagination Controls (Issue #277) */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage(1)}
                disabled={page === 1}
                title="First page"
              >
                <span className="iconify ph--caret-double-left size-4" />
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                title="Previous page"
              >
                <span className="iconify ph--caret-left size-4" />
              </button>

              <span className="text-sm px-2">
                Page {page} of {totalPages}
              </span>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                title="Next page"
              >
                <span className="iconify ph--caret-right size-4" />
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                title="Last page"
              >
                <span className="iconify ph--caret-double-right size-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MemoryCard({ observation }: { observation: Observation }) {
  const [expanded, setExpanded] = useState(false);
  const config = getTypeConfig(observation.type);
  // Use browser locale for time formatting (Issue #277)
  const time = new Date(observation.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

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

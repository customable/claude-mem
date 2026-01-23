/**
 * Observation List
 *
 * Displays observations with filtering.
 */

import { useState } from 'react';
import { api, type Observation } from '../api/client';
import { useQuery } from '../hooks/useApi';

const TYPE_ICONS: Record<string, string> = {
  bugfix: 'ph--bug',
  feature: 'ph--star',
  refactor: 'ph--arrows-clockwise',
  change: 'ph--check-circle',
  discovery: 'ph--magnifying-glass',
  decision: 'ph--scales',
  'session-request': 'ph--chat-text',
};

const TYPE_COLORS: Record<string, string> = {
  bugfix: 'text-error',
  feature: 'text-secondary',
  refactor: 'text-info',
  change: 'text-success',
  discovery: 'text-primary',
  decision: 'text-warning',
  'session-request': 'text-base-content/60',
};

interface Props {
  project?: string;
}

export function ObservationList({ project }: Props) {
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  const { data, loading, error, refetch } = useQuery(
    () => api.getObservations({ limit, offset, project }),
    [limit, offset, project]
  );

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-base-content/60">
        <span className="loading loading-spinner loading-md mb-2" />
        <span>Loading observations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span className="iconify ph--warning-circle size-5" />
        <span>Failed to load observations</span>
      </div>
    );
  }

  const observations = data?.data || [];
  const total = data?.total || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Observations</h2>
          <span className="badge badge-neutral badge-sm">{total} total</span>
        </div>
        <button onClick={refetch} className="btn btn-ghost btn-sm">
          <span className="iconify ph--arrows-clockwise size-4" />
          Refresh
        </button>
      </div>

      {/* Observation List */}
      {observations.length === 0 ? (
        <div className="card bg-base-100 card-border">
          <div className="card-body items-center justify-center py-12 text-base-content/60">
            <span className="iconify ph--note-blank size-12 mb-2" />
            <span>No observations yet</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {observations.map((obs) => (
            <ObservationItem key={obs.id} observation={obs} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            className="btn btn-ghost btn-sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            <span className="iconify ph--caret-left size-4" />
            Previous
          </button>
          <span className="text-sm text-base-content/60">
            {offset + 1} - {Math.min(offset + limit, total)} of {total}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
          >
            Next
            <span className="iconify ph--caret-right size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function ObservationItem({ observation }: { observation: Observation }) {
  const [expanded, setExpanded] = useState(false);
  const iconClass = TYPE_ICONS[observation.type] || 'ph--dot';
  const colorClass = TYPE_COLORS[observation.type] || 'text-base-content';
  const date = new Date(observation.createdAt).toLocaleString();

  return (
    <div className="card bg-base-100 card-border">
      <div
        className="card-body p-3 cursor-pointer hover:bg-base-200/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {/* Type Icon */}
          <span className={`iconify ${iconClass} size-5 ${colorClass}`} />

          {/* Title */}
          <span className="flex-1 font-medium truncate">{observation.title}</span>

          {/* Project Badge */}
          <span className="badge badge-primary badge-sm badge-outline">
            {observation.project}
          </span>

          {/* Date */}
          <span className="text-xs text-base-content/50">{date}</span>

          {/* Expand Arrow */}
          <span
            className={`iconify ph--caret-down size-4 text-base-content/40 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-base-300">
            <p className="text-sm text-base-content/80 whitespace-pre-wrap">
              {observation.text}
            </p>
            {observation.tokens && (
              <div className="mt-2 text-xs text-base-content/50">
                <span className="iconify ph--coin size-3 mr-1" />
                {observation.tokens.toLocaleString()} tokens
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

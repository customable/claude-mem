/**
 * Observation List
 *
 * Displays observations with filtering and detailed view.
 */

import { useState } from 'react';
import { api, type Observation } from '../api/client';
import { useQuery } from '../hooks/useApi';
import { getTypeConfig } from '../utils/observation';
import { ObservationDetails } from './ObservationDetails';

interface Props {
  project?: string;
}

export function ObservationList({ project }: Props) {
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  const { data, loading, error, refetch } = useQuery(
    () => api.getObservations({ limit, offset, project: project || '' }),
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

  const observations: Observation[] = data?.items || [];
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
  const config = getTypeConfig(observation.type);
  const date = new Date(observation.created_at).toLocaleString();

  return (
    <div className="card bg-base-100 card-border">
      {/* Header - Always visible */}
      <div
        className="card-body p-3 cursor-pointer hover:bg-base-200/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {/* Type Icon */}
          <span className={`iconify ${config.icon} size-5 ${config.color} shrink-0`} />

          {/* Title & Subtitle */}
          <div className="flex-1 min-w-0">
            <span className="font-medium block truncate">{observation.title}</span>
            {observation.subtitle && (
              <span className="text-xs text-base-content/60 block truncate">
                {observation.subtitle}
              </span>
            )}
          </div>

          {/* Meta badges */}
          <div className="flex items-center gap-2 shrink-0">
            {observation.git_branch && (
              <span className="badge badge-ghost badge-sm">
                <span className="iconify ph--git-branch size-3 mr-1" />
                {observation.git_branch}
              </span>
            )}
            <span className="badge badge-primary badge-sm badge-outline">
              {observation.project}
            </span>
          </div>

          {/* Date */}
          <span className="text-xs text-base-content/50 shrink-0">{date}</span>

          {/* Expand Arrow */}
          <span
            className={`iconify ph--caret-down size-4 text-base-content/40 transition-transform shrink-0 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4">
          <div className="border-t border-base-300 pt-4">
            <ObservationDetails observation={observation} />
          </div>
        </div>
      )}
    </div>
  );
}

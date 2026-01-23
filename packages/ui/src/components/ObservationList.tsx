/**
 * Observation List
 *
 * Displays observations with filtering and detailed view.
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

/** Parse JSON string safely */
function parseJsonArray(str?: string): string[] {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Shorten file path for display */
function shortenPath(path: string): string {
  const parts = path.split('/');
  if (parts.length <= 4) return path;
  return '.../' + parts.slice(-3).join('/');
}

function ObservationItem({ observation }: { observation: Observation }) {
  const [expanded, setExpanded] = useState(false);
  const iconClass = TYPE_ICONS[observation.type] || 'ph--dot';
  const colorClass = TYPE_COLORS[observation.type] || 'text-base-content';
  const date = new Date(observation.created_at).toLocaleString();

  // Parse JSON fields
  const facts = parseJsonArray(observation.facts);
  const concepts = parseJsonArray(observation.concepts);
  const filesRead = parseJsonArray(observation.files_read);
  const filesModified = parseJsonArray(observation.files_modified);

  return (
    <div className="card bg-base-100 card-border">
      {/* Header - Always visible */}
      <div
        className="card-body p-3 cursor-pointer hover:bg-base-200/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {/* Type Icon */}
          <span className={`iconify ${iconClass} size-5 ${colorClass} shrink-0`} />

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
        <div className="px-4 pb-4 space-y-4">
          <div className="border-t border-base-300 pt-4" />

          {/* Narrative */}
          {observation.narrative && (
            <div>
              <div className="text-xs font-medium text-base-content/60 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <span className="iconify ph--text-align-left size-3" />
                Narrative
              </div>
              <p className="text-sm text-base-content/80 leading-relaxed">
                {observation.narrative}
              </p>
            </div>
          )}

          {/* Facts */}
          {facts.length > 0 && (
            <div>
              <div className="text-xs font-medium text-base-content/60 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <span className="iconify ph--list-bullets size-3" />
                Facts
              </div>
              <ul className="space-y-1">
                {facts.map((fact, i) => (
                  <li key={i} className="text-sm text-base-content/80 flex items-start gap-2">
                    <span className="iconify ph--check size-4 text-success shrink-0 mt-0.5" />
                    {fact}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Concepts */}
          {concepts.length > 0 && (
            <div>
              <div className="text-xs font-medium text-base-content/60 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <span className="iconify ph--tag size-3" />
                Concepts
              </div>
              <div className="flex flex-wrap gap-1.5">
                {concepts.map((concept, i) => (
                  <span key={i} className="badge badge-secondary badge-sm badge-outline">
                    {concept}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {(filesRead.length > 0 || filesModified.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Files Read */}
              {filesRead.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-base-content/60 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <span className="iconify ph--file-text size-3" />
                    Files Read ({filesRead.length})
                  </div>
                  <ul className="space-y-0.5">
                    {filesRead.map((file, i) => (
                      <li
                        key={i}
                        className="text-xs font-mono text-base-content/70 truncate"
                        title={file}
                      >
                        {shortenPath(file)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Files Modified */}
              {filesModified.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-base-content/60 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <span className="iconify ph--pencil-simple size-3" />
                    Files Modified ({filesModified.length})
                  </div>
                  <ul className="space-y-0.5">
                    {filesModified.map((file, i) => (
                      <li
                        key={i}
                        className="text-xs font-mono text-warning truncate"
                        title={file}
                      >
                        {shortenPath(file)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Footer Meta */}
          <div className="flex items-center justify-between text-xs text-base-content/50 pt-2 border-t border-base-300">
            <div className="flex items-center gap-4">
              {observation.prompt_number && (
                <span className="flex items-center gap-1">
                  <span className="iconify ph--hash size-3" />
                  Prompt {observation.prompt_number}
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="iconify ph--identification-badge size-3" />
                ID {observation.id}
              </span>
            </div>
            {observation.discovery_tokens && (
              <span className="flex items-center gap-1">
                <span className="iconify ph--coins size-3" />
                {observation.discovery_tokens.toLocaleString()} tokens
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

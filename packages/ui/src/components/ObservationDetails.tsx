/**
 * Shared Observation Details Component
 *
 * Renders expanded observation details (narrative, facts, concepts, files, URLs).
 * Used by Memories, Search, and Sessions views.
 * Supports narrative/facts view toggle.
 */

import { useState } from 'react';
import { type Observation } from '../api/client';
import {
  parseJsonArray,
  separatePathsAndUrls,
  shortenPath,
  extractDomain,
} from '../utils/observation';

type ViewMode = 'narrative' | 'facts';

interface Props {
  observation: Observation;
  showText?: boolean;
  showFooter?: boolean;
  defaultView?: ViewMode;
  showViewToggle?: boolean;
}

export function ObservationDetails({
  observation,
  showText = true,
  showFooter = true,
  defaultView = 'narrative',
  showViewToggle = true,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);

  // Parse JSON fields
  const facts = parseJsonArray(observation.facts);
  const concepts = parseJsonArray(observation.concepts);
  const { paths: filesRead, urls: urlsRead } = separatePathsAndUrls(parseJsonArray(observation.files_read));
  const { paths: filesModified, urls: urlsModified } = separatePathsAndUrls(parseJsonArray(observation.files_modified));
  const allUrls = [...new Set([...urlsRead, ...urlsModified])];

  // Check if we have detailed content
  const hasDetails = facts.length > 0 || concepts.length > 0 || filesRead.length > 0 || filesModified.length > 0;

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      {showViewToggle && hasDetails && (
        <div className="flex items-center gap-1">
          <div className="tabs tabs-box tabs-xs">
            <button
              className={`tab ${viewMode === 'narrative' ? 'tab-active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setViewMode('narrative'); }}
            >
              <span className="iconify ph--text-align-left size-3 mr-1" />
              Narrative
            </button>
            <button
              className={`tab ${viewMode === 'facts' ? 'tab-active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setViewMode('facts'); }}
            >
              <span className="iconify ph--list-bullets size-3 mr-1" />
              Details
            </button>
          </div>
        </div>
      )}

      {/* Narrative View - Compact */}
      {viewMode === 'narrative' && (
        <>
          {observation.narrative ? (
            <p className="text-sm text-base-content/80 leading-relaxed">{observation.narrative}</p>
          ) : facts.length > 0 ? (
            <ul className="space-y-1">
              {facts.slice(0, 3).map((fact, i) => (
                <li key={i} className="text-sm text-base-content/80 flex items-start gap-2">
                  <span className="iconify ph--check size-4 text-success shrink-0 mt-0.5" />
                  {fact}
                </li>
              ))}
              {facts.length > 3 && (
                <li className="text-xs text-base-content/50">
                  +{facts.length - 3} more (switch to Details view)
                </li>
              )}
            </ul>
          ) : observation.text ? (
            <p className="text-sm text-base-content/70">{observation.text.slice(0, 200)}...</p>
          ) : null}
        </>
      )}

      {/* Facts/Details View - Full */}
      {viewMode === 'facts' && (
        <>
          {/* Narrative (if exists) */}
          {observation.narrative && (
            <div>
              <div className="text-xs font-medium text-base-content/60 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <span className="iconify ph--text-align-left size-3" />
                Narrative
              </div>
              <p className="text-sm text-base-content/80 leading-relaxed">{observation.narrative}</p>
            </div>
          )}

          {/* Facts */}
          {facts.length > 0 && (
            <div>
              <div className="text-xs font-medium text-base-content/60 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <span className="iconify ph--list-bullets size-3" />
                Facts ({facts.length})
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
              {filesRead.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-base-content/60 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <span className="iconify ph--file-text size-3" />
                    Files Read ({filesRead.length})
                  </div>
                  <ul className="space-y-0.5">
                    {filesRead.slice(0, 10).map((file, i) => (
                      <li key={i} className="text-xs font-mono text-base-content/70 truncate" title={file}>
                        {shortenPath(file)}
                      </li>
                    ))}
                    {filesRead.length > 10 && (
                      <li className="text-xs text-base-content/50">...and {filesRead.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}
              {filesModified.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-base-content/60 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <span className="iconify ph--pencil-simple size-3" />
                    Files Modified ({filesModified.length})
                  </div>
                  <ul className="space-y-0.5">
                    {filesModified.slice(0, 10).map((file, i) => (
                      <li key={i} className="text-xs font-mono text-warning truncate" title={file}>
                        {shortenPath(file)}
                      </li>
                    ))}
                    {filesModified.length > 10 && (
                      <li className="text-xs text-base-content/50">...and {filesModified.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Related URLs */}
          {allUrls.length > 0 && (
            <div>
              <div className="text-xs font-medium text-base-content/60 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <span className="iconify ph--link size-3" />
                References ({allUrls.length})
              </div>
              <ul className="space-y-0.5">
                {allUrls.slice(0, 5).map((url, i) => (
                  <li key={i} className="text-xs truncate">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {extractDomain(url)}
                    </a>
                  </li>
                ))}
                {allUrls.length > 5 && (
                  <li className="text-xs text-base-content/50">...and {allUrls.length - 5} more</li>
                )}
              </ul>
            </div>
          )}

          {/* Raw text if available */}
          {showText && observation.text && (
            <div>
              <div className="text-xs font-medium text-base-content/60 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <span className="iconify ph--article size-3" />
                Raw Text
              </div>
              <p className="text-sm text-base-content/70 whitespace-pre-wrap">{observation.text}</p>
            </div>
          )}
        </>
      )}

      {/* Footer Meta */}
      {showFooter && (
        <div className="flex items-center justify-between text-xs text-base-content/50 pt-2 border-t border-base-300">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="iconify ph--identification-badge size-3" />
              ID {observation.id}
            </span>
            {observation.prompt_number && (
              <span className="flex items-center gap-1">
                <span className="iconify ph--hash size-3" />
                Prompt {observation.prompt_number}
              </span>
            )}
            {observation.git_branch && (
              <span className="flex items-center gap-1">
                <span className="iconify ph--git-branch size-3" />
                {observation.git_branch}
              </span>
            )}
          </div>
          {observation.discovery_tokens && (
            <span className="flex items-center gap-1">
              <span className="iconify ph--coins size-3" />
              {observation.discovery_tokens.toLocaleString()} tokens
            </span>
          )}
        </div>
      )}
    </div>
  );
}

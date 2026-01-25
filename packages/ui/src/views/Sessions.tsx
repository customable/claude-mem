import { useState, useEffect, useCallback, useRef } from 'react';
import { api, type Observation, type Summary, type UserPrompt } from '../api/client';
import { ObservationDetails } from '../components/ObservationDetails';
import { useSSE } from '../hooks/useSSE';

interface Session {
  id: number;
  content_session_id: string;
  memory_session_id: string;
  project: string;
  user_prompt: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  observation_count: number;
  prompt_count: number;
  files_read?: string[];
  files_modified?: string[];
}

// Pagination and sorting options (Issue #278)
const PAGE_SIZES = [20, 50, 100] as const;
type SortOption = 'date' | 'observations' | 'prompts' | 'status';

export function SessionsView() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [sortBy, setSortBy] = useState<SortOption>('date');

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
      };
      if (projectFilter) {
        params.project = projectFilter;
      }
      if (statusFilter) {
        params.status = statusFilter;
      }
      const data = await api.getSessions(params);
      let items = data.items || [];

      // Client-side sorting (Issue #278)
      items = [...items].sort((a, b) => {
        switch (sortBy) {
          case 'observations':
            return (b.observation_count ?? 0) - (a.observation_count ?? 0);
          case 'prompts':
            return (b.prompt_count ?? 0) - (a.prompt_count ?? 0);
          case 'status':
            return (a.status || '').localeCompare(b.status || '');
          case 'date':
          default:
            return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
        }
      });

      setSessions(items);
      setTotalCount(data.total || items.length);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectFilter, statusFilter, page, pageSize, sortBy]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [projectFilter, statusFilter, pageSize]);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await api.getProjects();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchProjects();
  }, [fetchSessions, fetchProjects]);

  const handleToggleSession = (id: number) => {
    setExpandedSessionId(expandedSessionId === id ? null : id);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header (Issue #278: Add sorting and status filter) */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Sessions</h1>
          <span className="badge badge-neutral badge-sm">{sessions.length} items</span>
          {totalCount > sessions.length && (
            <span className="text-xs text-base-content/50">of {totalCount} total</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter (Issue #278) */}
          <select
            className="select select-bordered select-sm w-28"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>

          {/* Project Filter */}
          <select
            className="select select-bordered select-sm w-40"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* Sort By (Issue #278) */}
          <select
            className="select select-bordered select-sm w-36"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            title="Sort by"
          >
            <option value="date">Sort: Date</option>
            <option value="observations">Sort: Observations</option>
            <option value="prompts">Sort: Prompts</option>
            <option value="status">Sort: Status</option>
          </select>

          {/* Page Size (Issue #278) */}
          <select
            className="select select-bordered select-sm w-20"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            title="Items per page"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>

          <button className="btn btn-ghost btn-sm btn-square" onClick={fetchSessions} title="Refresh">
            <span className="iconify ph--arrows-clockwise size-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-base-content/50">
          <span className="iconify ph--clock-counter-clockwise size-12 mb-4" />
          <p className="font-medium">No sessions found</p>
          <p className="text-sm">Sessions will appear here as you use Claude Code</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              isExpanded={expandedSessionId === session.id}
              onToggle={() => handleToggleSession(session.id)}
              onOpen={() => setSelectedSession(session)}
            />
          ))}

          {/* Pagination Controls (Issue #278) */}
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

      {/* Session Detail Modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  );
}

function SessionCard({
  session,
  isExpanded,
  onToggle,
  onOpen,
}: {
  session: Session;
  isExpanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const [showFilesRead, setShowFilesRead] = useState(false);
  const [showFilesModified, setShowFilesModified] = useState(false);

  const filesReadCount = session.files_read?.length ?? 0;
  const filesModifiedCount = session.files_modified?.length ?? 0;

  return (
    <div className="card bg-base-200">
      <div className="card-body p-4">
        <div className="flex items-start justify-between gap-4">
          <div
            className="flex-1 min-w-0 cursor-pointer hover:opacity-80"
            onClick={onOpen}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`badge badge-sm ${
                  session.status === 'completed'
                    ? 'badge-success'
                    : session.status === 'active'
                    ? 'badge-info'
                    : 'badge-ghost'
                }`}
              >
                {session.status}
              </span>
              <span className="text-xs text-base-content/50 font-mono">
                {session.content_session_id?.slice(0, 8)}
              </span>
            </div>
            <p className="font-medium truncate">{session.user_prompt || 'No prompt recorded'}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-base-content/60">
              <span className="flex items-center gap-1">
                <span className="iconify ph--folder size-3" />
                {session.project}
              </span>
              <span className="flex items-center gap-1">
                <span className="iconify ph--brain size-3" />
                {session.observation_count ?? 0} observations
              </span>
              <span className="flex items-center gap-1">
                <span className="iconify ph--chat-text size-3" />
                {session.prompt_count ?? 0} prompts
              </span>
              {/* File counts - Issue #94 */}
              {filesReadCount > 0 && (
                <button
                  className="flex items-center gap-1 hover:text-primary transition-colors"
                  onClick={(e) => { e.stopPropagation(); setShowFilesRead(!showFilesRead); }}
                  title="Click to show files read"
                >
                  <span className="iconify ph--eye size-3" />
                  {filesReadCount} read
                </button>
              )}
              {filesModifiedCount > 0 && (
                <button
                  className="flex items-center gap-1 hover:text-secondary transition-colors"
                  onClick={(e) => { e.stopPropagation(); setShowFilesModified(!showFilesModified); }}
                  title="Click to show files modified"
                >
                  <span className="iconify ph--pencil-simple size-3" />
                  {filesModifiedCount} modified
                </button>
              )}
              <span>{formatDate(session.started_at)}</span>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm btn-square"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
          >
            <span
              className={`iconify ph--caret-down size-5 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>

        {/* Files Read Expandable Section - Issue #94 */}
        {showFilesRead && session.files_read && session.files_read.length > 0 && (
          <div className="mt-3 p-3 bg-base-300 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold flex items-center gap-1">
                <span className="iconify ph--eye size-3 text-primary" />
                Files Read ({filesReadCount})
              </span>
              <button
                className="btn btn-ghost btn-xs btn-square"
                onClick={() => setShowFilesRead(false)}
              >
                <span className="iconify ph--x size-3" />
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto text-xs font-mono space-y-0.5">
              {session.files_read.map((file, i) => (
                <div key={i} className="truncate text-base-content/70" title={file}>
                  {file}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files Modified Expandable Section - Issue #94 */}
        {showFilesModified && session.files_modified && session.files_modified.length > 0 && (
          <div className="mt-3 p-3 bg-base-300 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold flex items-center gap-1">
                <span className="iconify ph--pencil-simple size-3 text-secondary" />
                Files Modified ({filesModifiedCount})
              </span>
              <button
                className="btn btn-ghost btn-xs btn-square"
                onClick={() => setShowFilesModified(false)}
              >
                <span className="iconify ph--x size-3" />
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto text-xs font-mono space-y-0.5">
              {session.files_modified.map((file, i) => (
                <div key={i} className="truncate text-base-content/70" title={file}>
                  {file}
                </div>
              ))}
            </div>
          </div>
        )}

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-base-300">
            <SessionTimeline memorySessionId={session.memory_session_id} />
          </div>
        )}
      </div>
    </div>
  );
}

// Timeline item type for unified observation/summary/prompt display
type TimelineItem =
  | { kind: 'observation'; data: Observation; epoch: number }
  | { kind: 'summary'; data: Summary; epoch: number }
  | { kind: 'prompt'; data: UserPrompt; epoch: number };

function SessionTimeline({ memorySessionId }: { memorySessionId: string }) {
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTimelineData() {
      try {
        const [obsData, sumData] = await Promise.all([
          api.getObservations({ sessionId: memorySessionId, limit: 50 }),
          api.getSessionSummaries(memorySessionId),
        ]);

        // Convert to unified timeline items
        const obsItems: TimelineItem[] = (obsData.items || []).map((obs) => ({
          kind: 'observation' as const,
          data: obs,
          epoch: obs.created_at_epoch || new Date(obs.created_at).getTime(),
        }));

        const sumItems: TimelineItem[] = (sumData.items || []).map((sum) => ({
          kind: 'summary' as const,
          data: sum,
          epoch: sum.created_at_epoch,
        }));

        // Merge and sort by epoch (oldest first)
        const merged = [...obsItems, ...sumItems].sort((a, b) => a.epoch - b.epoch);
        setTimelineItems(merged);
      } catch (error) {
        console.error('Failed to fetch session timeline:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchTimelineData();
  }, [memorySessionId]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <span className="loading loading-spinner loading-sm" />
      </div>
    );
  }

  if (timelineItems.length === 0) {
    return <p className="text-sm text-base-content/50 text-center py-4">No observations in this session</p>;
  }

  return (
    <div className="space-y-3">
      {timelineItems.map((item, index) => (
        <div key={`${item.kind}-${item.data.id}`} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-2 h-2 rounded-full ${
              item.kind === 'summary' ? 'bg-accent' : item.kind === 'prompt' ? 'bg-primary' : getTypeColor(item.data.type)
            }`} />
            {index < timelineItems.length - 1 && <div className="w-px flex-1 bg-base-300 mt-1" />}
          </div>
          <div className="flex-1 pb-3">
            {item.kind === 'observation' ? (
              <>
                <div className="flex items-center gap-2">
                  <span className={`badge badge-xs ${getTypeBadge(item.data.type)}`}>{item.data.type}</span>
                  <span className="text-xs text-base-content/50">{formatTime(item.data.created_at)}</span>
                </div>
                <p className="text-sm font-medium mt-1">{item.data.title}</p>
                {item.data.subtitle && <p className="text-xs text-base-content/60 mt-0.5">{item.data.subtitle}</p>}
              </>
            ) : item.kind === 'summary' ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="badge badge-xs badge-accent">Summary</span>
                  <span className="text-xs text-base-content/50">{formatTime(item.data.created_at)}</span>
                </div>
                <div className="mt-1 text-sm space-y-1">
                  {item.data.request && (
                    <p><span className="text-base-content/60">Request:</span> {item.data.request}</p>
                  )}
                  {item.data.completed && (
                    <p><span className="text-base-content/60">Completed:</span> {item.data.completed}</p>
                  )}
                  {item.data.learned && (
                    <p className="text-xs text-base-content/70"><span className="text-base-content/50">Learned:</span> {item.data.learned}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="badge badge-xs badge-primary">Prompt #{item.data.prompt_number}</span>
                  <span className="text-xs text-base-content/50">{formatTime(item.data.created_at)}</span>
                </div>
                <p className="text-sm mt-1">{item.data.prompt_text}</p>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'bugfix':
      return 'bg-error';
    case 'feature':
      return 'bg-success';
    case 'refactor':
      return 'bg-info';
    case 'discovery':
      return 'bg-primary';
    case 'decision':
      return 'bg-warning';
    case 'change':
      return 'bg-secondary';
    default:
      return 'bg-base-content/30';
  }
}

function getTypeBadge(type: string): string {
  switch (type) {
    case 'bugfix':
      return 'badge-error';
    case 'feature':
      return 'badge-success';
    case 'refactor':
      return 'badge-info';
    case 'discovery':
      return 'badge-primary';
    case 'decision':
      return 'badge-warning';
    case 'change':
      return 'badge-secondary';
    default:
      return 'badge-ghost';
  }
}

// Use browser locale for date formatting (Issue #278)
function formatDate(timestamp: string): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(timestamp: string): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SessionDetailModal({
  session,
  onClose,
}: {
  session: Session;
  onClose: () => void;
}) {
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [selectedObs, setSelectedObs] = useState<Observation | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Fetch timeline data
  const fetchTimelineData = useCallback(async () => {
    try {
      const [obsData, sumData, promptData] = await Promise.all([
        api.getObservations({ sessionId: session.memory_session_id, limit: 200 }),
        api.getSessionSummaries(session.memory_session_id),
        api.getSessionPrompts(session.content_session_id),
      ]);

      const obsItems: TimelineItem[] = (obsData.items || []).map((obs) => ({
        kind: 'observation' as const,
        data: obs,
        epoch: obs.created_at_epoch || new Date(obs.created_at).getTime(),
      }));

      const sumItems: TimelineItem[] = (sumData.items || []).map((sum) => ({
        kind: 'summary' as const,
        data: sum,
        epoch: sum.created_at_epoch,
      }));

      const promptItems: TimelineItem[] = (promptData.items || []).map((prompt) => ({
        kind: 'prompt' as const,
        data: prompt,
        epoch: prompt.created_at_epoch,
      }));

      // Merge and sort by epoch (newest first)
      const merged = [...obsItems, ...sumItems, ...promptItems].sort((a, b) => b.epoch - a.epoch);
      setTimelineItems(merged);
    } catch (error) {
      console.error('Failed to fetch timeline:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session.memory_session_id, session.content_session_id]);

  useEffect(() => {
    fetchTimelineData();
  }, [fetchTimelineData]);

  // SSE for real-time updates
  const { lastEvent } = useSSE();
  useEffect(() => {
    if (!lastEvent) return;
    // Refresh on new observation, summary, or prompt for this session
    const eventData = lastEvent.data as { sessionId?: string } | undefined;
    if (
      (lastEvent.type === 'observation:created' ||
       lastEvent.type === 'summary:created' ||
       lastEvent.type === 'prompt:new') &&
      eventData?.sessionId === session.content_session_id
    ) {
      fetchTimelineData();
    }
  }, [lastEvent, session.content_session_id, fetchTimelineData]);

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedObs) {
          setSelectedObs(null);
        } else if (selectedSummary) {
          setSelectedSummary(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, selectedObs, selectedSummary]);

  // Count items by type
  const observationCount = timelineItems.filter(i => i.kind === 'observation').length;
  const summaryCount = timelineItems.filter(i => i.kind === 'summary').length;
  const promptCount = timelineItems.filter(i => i.kind === 'prompt').length;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`badge ${
                  session.status === 'completed' ? 'badge-success' : 'badge-info'
                }`}
              >
                {session.status}
              </span>
              <span className="text-sm text-base-content/50 font-mono">
                {session.content_session_id}
              </span>
            </div>
            <h3 className="font-bold text-lg">{session.project}</h3>
          </div>
          <button className="btn btn-ghost btn-sm btn-square" onClick={onClose}>
            <span className="iconify ph--x size-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          <div className="bg-base-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{observationCount}</p>
            <p className="text-xs text-base-content/60">Observations</p>
          </div>
          <div className="bg-base-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{summaryCount}</p>
            <p className="text-xs text-base-content/60">Summaries</p>
          </div>
          <div className="bg-base-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{promptCount}</p>
            <p className="text-xs text-base-content/60">Prompts</p>
          </div>
          <div className="bg-base-200 rounded-lg p-3 text-center">
            <p className="text-sm font-medium">{formatDate(session.started_at)}</p>
            <p className="text-xs text-base-content/60">Started</p>
          </div>
          <div className="bg-base-200 rounded-lg p-3 text-center">
            <p className="text-sm font-medium">
              {session.completed_at ? formatDate(session.completed_at) : '-'}
            </p>
            <p className="text-xs text-base-content/60">Completed</p>
          </div>
        </div>

        {/* Timeline List */}
        <div className="flex-1 overflow-y-auto" ref={timelineRef}>
          <h4 className="font-semibold mb-3">Timeline (newest first)</h4>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-md" />
            </div>
          ) : timelineItems.length === 0 ? (
            <p className="text-center text-base-content/50 py-8">No activity</p>
          ) : (
            <div className="space-y-2">
              {timelineItems.map((item) => {
                if (item.kind === 'prompt') {
                  return (
                    <div
                      key={`prompt-${item.data.id}`}
                      className="bg-primary/10 border border-primary/30 rounded-lg p-3"
                    >
                      <div className="flex items-start gap-3">
                        <span className="iconify ph--user text-primary size-5 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="badge badge-xs badge-primary">Prompt #{item.data.prompt_number}</span>
                            <span className="text-xs text-base-content/50">{formatTime(item.data.created_at)}</span>
                          </div>
                          <p className="text-sm mt-1 whitespace-pre-wrap">{item.data.prompt_text}</p>
                        </div>
                      </div>
                    </div>
                  );
                }
                if (item.kind === 'observation') {
                  return (
                    <div
                      key={`obs-${item.data.id}`}
                      className="bg-base-200 rounded-lg p-3 cursor-pointer hover:bg-base-300 transition-colors"
                      onClick={() => setSelectedObs(item.data)}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`iconify ${getTypeIcon(item.data.type)} size-5 mt-0.5`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`badge badge-xs ${getTypeBadge(item.data.type)}`}>{item.data.type}</span>
                            <span className="text-xs text-base-content/50">{formatTime(item.data.created_at)}</span>
                            {item.data.prompt_number && (
                              <span className="text-xs text-base-content/50">Prompt #{item.data.prompt_number}</span>
                            )}
                          </div>
                          <p className="font-medium mt-1 truncate">{item.data.title}</p>
                          {item.data.subtitle && (
                            <p className="text-sm text-base-content/60 truncate">{item.data.subtitle}</p>
                          )}
                        </div>
                        <span className="iconify ph--caret-right size-4 text-base-content/30" />
                      </div>
                    </div>
                  );
                }
                // summary
                return (
                  <div
                    key={`sum-${item.data.id}`}
                    className="bg-accent/10 border border-accent/30 rounded-lg p-3 cursor-pointer hover:bg-accent/20 transition-colors"
                    onClick={() => setSelectedSummary(item.data)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="iconify ph--note-pencil text-accent size-5 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="badge badge-xs badge-accent">Summary</span>
                          <span className="text-xs text-base-content/50">{formatTime(item.data.created_at)}</span>
                          {item.data.prompt_number && (
                            <span className="text-xs text-base-content/50">Prompt #{item.data.prompt_number}</span>
                          )}
                        </div>
                        <p className="font-medium mt-1 truncate">{item.data.request || 'Session Summary'}</p>
                        {item.data.completed && (
                          <p className="text-sm text-base-content/60 truncate">{item.data.completed}</p>
                        )}
                      </div>
                      <span className="iconify ph--caret-right size-4 text-base-content/30" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose} />

      {/* Observation Detail Sub-Modal */}
      {selectedObs && (
        <div className="modal modal-open" style={{ zIndex: 60 }}>
          <div className="modal-box max-w-3xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={`iconify ${getTypeIcon(selectedObs.type)} size-6`} />
                <span className={`badge ${getTypeBadge(selectedObs.type)}`}>{selectedObs.type}</span>
              </div>
              <button className="btn btn-ghost btn-sm btn-square" onClick={() => setSelectedObs(null)}>
                <span className="iconify ph--x size-5" />
              </button>
            </div>
            <ObservationDetails observation={selectedObs} />
          </div>
          <div className="modal-backdrop bg-black/30" onClick={() => setSelectedObs(null)} />
        </div>
      )}

      {/* Summary Detail Sub-Modal */}
      {selectedSummary && (
        <div className="modal modal-open" style={{ zIndex: 60 }}>
          <div className="modal-box max-w-3xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="iconify ph--note-pencil text-accent size-6" />
                <span className="badge badge-accent">Summary</span>
              </div>
              <button className="btn btn-ghost btn-sm btn-square" onClick={() => setSelectedSummary(null)}>
                <span className="iconify ph--x size-5" />
              </button>
            </div>
            <SummaryDetails summary={selectedSummary} />
          </div>
          <div className="modal-backdrop bg-black/30" onClick={() => setSelectedSummary(null)} />
        </div>
      )}
    </div>
  );
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'bugfix':
      return 'ph--bug text-error';
    case 'feature':
      return 'ph--star text-secondary';
    case 'refactor':
      return 'ph--arrows-clockwise text-info';
    case 'discovery':
      return 'ph--magnifying-glass text-primary';
    case 'decision':
      return 'ph--scales text-warning';
    case 'change':
      return 'ph--pencil-simple text-secondary';
    case 'docs':
      return 'ph--file-text text-base-content';
    case 'test':
      return 'ph--test-tube text-accent';
    default:
      return 'ph--circle text-base-content/50';
  }
}

function SummaryDetails({ summary }: { summary: Summary }) {
  const date = new Date(summary.created_at).toLocaleString('de-DE');

  return (
    <div className="space-y-4">
      {/* Metadata */}
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="flex items-center gap-1 text-base-content/60">
          <span className="iconify ph--clock size-4" />
          {date}
        </span>
        {summary.prompt_number && (
          <span className="flex items-center gap-1 text-base-content/60">
            <span className="iconify ph--chat-text size-4" />
            Prompt #{summary.prompt_number}
          </span>
        )}
        {summary.discovery_tokens && (
          <span className="flex items-center gap-1 text-base-content/60">
            <span className="iconify ph--coins size-4" />
            {summary.discovery_tokens} tokens
          </span>
        )}
      </div>

      {/* Request */}
      {summary.request && (
        <div className="bg-base-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <span className="iconify ph--question size-4 text-primary" />
            Request
          </h4>
          <p className="text-sm whitespace-pre-wrap">{summary.request}</p>
        </div>
      )}

      {/* Investigated */}
      {summary.investigated && (
        <div className="bg-base-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <span className="iconify ph--magnifying-glass size-4 text-info" />
            Investigated
          </h4>
          <p className="text-sm whitespace-pre-wrap">{summary.investigated}</p>
        </div>
      )}

      {/* Learned */}
      {summary.learned && (
        <div className="bg-base-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <span className="iconify ph--lightbulb size-4 text-warning" />
            Learned
          </h4>
          <p className="text-sm whitespace-pre-wrap">{summary.learned}</p>
        </div>
      )}

      {/* Completed */}
      {summary.completed && (
        <div className="bg-base-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <span className="iconify ph--check-circle size-4 text-success" />
            Completed
          </h4>
          <p className="text-sm whitespace-pre-wrap">{summary.completed}</p>
        </div>
      )}

      {/* Next Steps */}
      {summary.next_steps && (
        <div className="bg-base-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <span className="iconify ph--arrow-right size-4 text-secondary" />
            Next Steps
          </h4>
          <p className="text-sm whitespace-pre-wrap">{summary.next_steps}</p>
        </div>
      )}
    </div>
  );
}

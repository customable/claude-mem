/**
 * Tasks View
 *
 * Read-only view for monitoring task queue status.
 * Displays tasks from the backend task queue with filtering and kanban visualization.
 */

import { useState, useEffect, useCallback } from 'react';
import { api, type Task, type TaskStatus, type TaskType, type TaskCounts } from '../api/client';

type ViewMode = 'list' | 'kanban';

const TASK_STATUSES: TaskStatus[] = ['pending', 'assigned', 'processing', 'completed', 'failed', 'timeout'];
const TASK_TYPES: TaskType[] = ['observation', 'summarize', 'embedding', 'claude-md', 'cleanup'];

// Pagination options (Issue #285)
const PAGE_SIZES = [20, 50, 100] as const;

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'badge-warning',
  assigned: 'badge-info',
  processing: 'badge-primary',
  completed: 'badge-success',
  failed: 'badge-error',
  timeout: 'badge-ghost',
};

const STATUS_ICONS: Record<TaskStatus, string> = {
  pending: 'ph--hourglass',
  assigned: 'ph--user-focus',
  processing: 'ph--spinner',
  completed: 'ph--check-circle',
  failed: 'ph--x-circle',
  timeout: 'ph--clock-countdown',
};

const TYPE_ICONS: Record<TaskType, string> = {
  observation: 'ph--eye',
  summarize: 'ph--article',
  embedding: 'ph--vector-three',
  'claude-md': 'ph--file-md',
  cleanup: 'ph--broom',
};

function formatTimestamp(epoch: number): string {
  const date = new Date(epoch);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

// Copy text to clipboard helper (Issue #285)
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function TaskCard({
  task,
  compact = false,
  onRetry,
}: {
  task: Task;
  compact?: boolean;
  onRetry?: (taskId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<'id' | 'payload' | null>(null);

  // Handle copy with feedback (Issue #285)
  const handleCopy = async (type: 'id' | 'payload') => {
    const text = type === 'id' ? task.id : JSON.stringify(task.payload, null, 2);
    if (await copyToClipboard(text)) {
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  return (
    <div className={`card bg-base-200 ${compact ? 'card-compact' : ''}`}>
      <div className="card-body p-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className={`iconify ${TYPE_ICONS[task.type]} size-4 text-base-content/60`} />
          <span className="text-sm font-medium flex-1 truncate">{task.type}</span>
          <span className={`badge badge-sm ${STATUS_COLORS[task.status]}`}>
            <span className={`iconify ${STATUS_ICONS[task.status]} size-3 mr-1`} />
            {task.status}
          </span>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 text-xs text-base-content/60">
          <span>{formatTimestamp(task.createdAt)}</span>
          {task.assignedWorkerId && (
            <>
              <span>|</span>
              <span className="truncate">Worker: {task.assignedWorkerId.slice(0, 8)}...</span>
            </>
          )}
          {task.retryCount > 0 && (
            <>
              <span>|</span>
              <span>Retry {task.retryCount}/{task.maxRetries}</span>
            </>
          )}
        </div>

        {/* Expand/Collapse */}
        {!compact && (
          <div className="mt-2">
            <div className="flex items-center gap-1">
              <button
                className="btn btn-xs btn-ghost"
                onClick={() => setExpanded(!expanded)}
              >
                <span className={`iconify ${expanded ? 'ph--caret-up' : 'ph--caret-down'} size-4`} />
                {expanded ? 'Less' : 'Details'}
              </button>

              {/* Task Actions (Issue #285) */}
              <button
                className="btn btn-xs btn-ghost"
                onClick={() => handleCopy('id')}
                title="Copy Task ID"
              >
                <span className={`iconify ${copied === 'id' ? 'ph--check' : 'ph--copy'} size-3`} />
              </button>

              {/* Retry button for failed/timeout tasks (Issue #285) */}
              {(task.status === 'failed' || task.status === 'timeout') && onRetry && (
                <button
                  className="btn btn-xs btn-ghost text-warning"
                  onClick={() => onRetry(task.id)}
                  title="Retry Task"
                >
                  <span className="iconify ph--arrow-clockwise size-3" />
                  Retry
                </button>
              )}
            </div>

            {expanded && (
              <div className="mt-2 space-y-2">
                <div className="text-xs flex items-center gap-1">
                  <span className="font-semibold">ID:</span>
                  <code className="text-base-content/70 font-mono">{task.id}</code>
                  <button
                    className="btn btn-ghost btn-xs btn-circle"
                    onClick={() => handleCopy('id')}
                  >
                    <span className={`iconify ${copied === 'id' ? 'ph--check text-success' : 'ph--copy'} size-3`} />
                  </button>
                </div>
                <div className="text-xs">
                  <span className="font-semibold">Capability:</span>
                  <span className="ml-1">{task.requiredCapability}</span>
                </div>
                {task.error && (
                  <div className="text-xs text-error bg-error/10 p-2 rounded">
                    <span className="font-semibold">Error:</span>
                    <span className="ml-1">{task.error}</span>
                  </div>
                )}

                {/* Improved JSON Payload Display (Issue #285) */}
                <div className="text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Payload</span>
                    <button
                      className="btn btn-ghost btn-xs gap-1"
                      onClick={() => handleCopy('payload')}
                    >
                      <span className={`iconify ${copied === 'payload' ? 'ph--check text-success' : 'ph--copy'} size-3`} />
                      {copied === 'payload' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className="mt-1 p-2 bg-base-300 rounded text-xs overflow-x-auto max-h-48 font-mono">
                    <JsonHighlight data={task.payload} />
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Simple JSON syntax highlighting component (Issue #285)
function JsonHighlight({ data }: { data: unknown }) {
  const json = JSON.stringify(data, null, 2);

  // Simple syntax highlighting by token type
  const highlighted = json.split('\n').map((line, i) => {
    // Highlight strings (values in quotes after colon)
    const parts = line.split(/("(?:[^"\\]|\\.)*")/g);
    return (
      <div key={i}>
        {parts.map((part, j) => {
          if (part.startsWith('"') && part.endsWith('"')) {
            // Check if it's a key (followed by :) or value
            const isKey = line.indexOf(part + ':') !== -1 || line.indexOf(part + ' :') !== -1;
            return (
              <span key={j} className={isKey ? 'text-info' : 'text-success'}>
                {part}
              </span>
            );
          }
          // Highlight numbers and booleans
          return (
            <span key={j}>
              {part.split(/\b(true|false|null|\d+(?:\.\d+)?)\b/g).map((token, k) => {
                if (/^(true|false|null)$/.test(token)) {
                  return <span key={k} className="text-warning">{token}</span>;
                }
                if (/^\d+(?:\.\d+)?$/.test(token)) {
                  return <span key={k} className="text-primary">{token}</span>;
                }
                return token;
              })}
            </span>
          );
        })}
      </div>
    );
  });

  return <>{highlighted}</>;
}

function KanbanColumn({ title, status, tasks, color }: {
  title: string;
  status: TaskStatus;
  tasks: Task[];
  color: string;
}) {
  return (
    <div className="flex flex-col min-w-64 max-w-80">
      <div className={`flex items-center gap-2 p-2 ${color} rounded-t-lg`}>
        <span className={`iconify ${STATUS_ICONS[status]} size-5`} />
        <span className="font-medium">{title}</span>
        <span className="badge badge-sm">{tasks.length}</span>
      </div>
      <div className="flex-1 p-2 bg-base-200 rounded-b-lg space-y-2 max-h-[60vh] overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="text-center text-base-content/50 py-4 text-sm">No tasks</div>
        ) : (
          tasks.map(task => (
            <TaskCard key={task.id} task={task} compact />
          ))
        )}
      </div>
    </div>
  );
}

export function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [counts, setCounts] = useState<TaskCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<TaskType | ''>('');
  // Pagination state (Issue #285)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [tasksRes, countsRes] = await Promise.all([
        api.getTasks({
          status: statusFilter || undefined,
          type: typeFilter || undefined,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }),
        api.getTaskCounts(),
      ]);

      setTasks(tasksRes.items);
      setTotalCount(tasksRes.total || tasksRes.items.length);
      setCounts(countsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, page, pageSize]);

  // Reset page when filters change (Issue #285)
  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, pageSize]);

  // Retry task handler (Issue #285)
  const handleRetry = async (taskId: string) => {
    try {
      await api.retryTask(taskId);
      loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry task');
    }
  };

  useEffect(() => {
    loadTasks();
    // Refresh every 5 seconds
    const interval = setInterval(loadTasks, 5000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  // Group tasks by status for kanban view
  const tasksByStatus = TASK_STATUSES.reduce((acc, status) => {
    acc[status] = tasks.filter(t => t.status === status);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Task Queue</h1>
          <p className="text-base-content/60 text-sm">
            Monitor backend task processing (read-only)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn btn-sm btn-ghost"
            onClick={loadTasks}
            disabled={loading}
          >
            <span className={`iconify ph--arrows-clockwise size-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {/* View Toggle */}
          <div className="join">
            <button
              className={`btn btn-sm join-item ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('list')}
            >
              <span className="iconify ph--list size-4" />
            </button>
            <button
              className={`btn btn-sm join-item ${viewMode === 'kanban' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('kanban')}
            >
              <span className="iconify ph--kanban size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      {counts && (
        <div className="stats stats-horizontal shadow bg-base-200 w-full">
          <div className="stat py-2 px-4">
            <div className="stat-title text-xs">Pending</div>
            <div className="stat-value text-lg text-warning">{counts.pending}</div>
          </div>
          <div className="stat py-2 px-4">
            <div className="stat-title text-xs">Processing</div>
            <div className="stat-value text-lg text-primary">{counts.processing + counts.assigned}</div>
          </div>
          <div className="stat py-2 px-4">
            <div className="stat-title text-xs">Completed</div>
            <div className="stat-value text-lg text-success">{counts.completed}</div>
          </div>
          <div className="stat py-2 px-4">
            <div className="stat-title text-xs">Failed</div>
            <div className="stat-value text-lg text-error">{counts.failed + counts.timeout}</div>
          </div>
        </div>
      )}

      {/* Filters (Issue #285: Added pagination controls) */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="select select-sm select-bordered"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskStatus | '')}
        >
          <option value="">All Statuses</option>
          {TASK_STATUSES.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>

        <select
          className="select select-sm select-bordered"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TaskType | '')}
        >
          <option value="">All Types</option>
          {TASK_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        {/* Page Size (Issue #285) */}
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

        <span className="text-sm text-base-content/60">
          Showing {tasks.length} of {totalCount} tasks
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error">
          <span className="iconify ph--warning size-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Content */}
      {loading && tasks.length === 0 ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban View */
        <div className="flex gap-4 overflow-x-auto pb-4">
          <KanbanColumn
            title="Pending"
            status="pending"
            tasks={tasksByStatus.pending}
            color="bg-warning/20"
          />
          <KanbanColumn
            title="Assigned"
            status="assigned"
            tasks={tasksByStatus.assigned}
            color="bg-info/20"
          />
          <KanbanColumn
            title="Processing"
            status="processing"
            tasks={tasksByStatus.processing}
            color="bg-primary/20"
          />
          <KanbanColumn
            title="Completed"
            status="completed"
            tasks={tasksByStatus.completed}
            color="bg-success/20"
          />
          <KanbanColumn
            title="Failed"
            status="failed"
            tasks={tasksByStatus.failed}
            color="bg-error/20"
          />
        </div>
      ) : (
        /* List View */
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-base-content/50">
              <span className="iconify ph--tray size-12 mb-2" />
              <p>No tasks in queue</p>
            </div>
          ) : (
            <>
              {tasks.map(task => (
                <TaskCard key={task.id} task={task} onRetry={handleRetry} />
              ))}

              {/* Pagination Controls (Issue #285) */}
              {totalCount > pageSize && (
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
                    Page {page} of {Math.ceil(totalCount / pageSize)}
                  </span>

                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setPage((p) => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                    disabled={page >= Math.ceil(totalCount / pageSize)}
                    title="Next page"
                  >
                    <span className="iconify ph--caret-right size-4" />
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setPage(Math.ceil(totalCount / pageSize))}
                    disabled={page >= Math.ceil(totalCount / pageSize)}
                    title="Last page"
                  >
                    <span className="iconify ph--caret-double-right size-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

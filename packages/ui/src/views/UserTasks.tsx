/**
 * User Tasks View (Issue #260)
 *
 * Read-only view for monitoring user tasks from CLI tools.
 * Displays tasks created by Claude Code, Cursor, Aider, etc.
 */

import { useState, useEffect, useCallback } from 'react';
import { api, type UserTask, type UserTaskStatus, type UserTaskSource, type UserTaskStats } from '../api/client';

type ViewMode = 'list' | 'kanban';

const TASK_STATUSES: UserTaskStatus[] = [
  'pending',
  'in_progress',
  'blocked',
  'more_info_needed',
  'ready_for_review',
  'completed',
  'cancelled',
];

const TASK_SOURCES: UserTaskSource[] = ['claude-code', 'cursor', 'aider', 'copilot', 'manual', 'api'];

const STATUS_COLORS: Record<UserTaskStatus, string> = {
  pending: 'badge-warning',
  in_progress: 'badge-primary',
  blocked: 'badge-error',
  more_info_needed: 'badge-info',
  ready_for_review: 'badge-accent',
  completed: 'badge-success',
  cancelled: 'badge-ghost',
};

const STATUS_ICONS: Record<UserTaskStatus, string> = {
  pending: 'ph--hourglass',
  in_progress: 'ph--spinner',
  blocked: 'ph--prohibit',
  more_info_needed: 'ph--question',
  ready_for_review: 'ph--eye',
  completed: 'ph--check-circle',
  cancelled: 'ph--x-circle',
};

const SOURCE_ICONS: Record<UserTaskSource, string> = {
  'claude-code': 'ph--terminal',
  cursor: 'ph--cursor-text',
  aider: 'ph--code',
  copilot: 'ph--github-logo',
  manual: 'ph--hand',
  api: 'ph--plugs-connected',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'text-error',
  medium: 'text-warning',
  low: 'text-base-content/60',
};

function formatTimestamp(epoch: number): string {
  const date = new Date(epoch);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function UserTaskCard({
  task,
  compact = false,
  onSelect,
}: {
  task: UserTask;
  compact?: boolean;
  onSelect?: (task: UserTask) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`card bg-base-200 ${compact ? 'card-compact' : ''} cursor-pointer hover:bg-base-300 transition-colors`}
      onClick={() => onSelect?.(task)}
    >
      <div className="card-body p-3">
        {/* Header */}
        <div className="flex items-start gap-2">
          <span className={`iconify ${SOURCE_ICONS[task.source]} size-4 text-base-content/60 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{task.title}</span>
              {task.priority && (
                <span className={`iconify ph--flag size-3 ${PRIORITY_COLORS[task.priority]}`} title={`${task.priority} priority`} />
              )}
            </div>
            {task.activeForm && task.status === 'in_progress' && (
              <div className="text-xs text-primary flex items-center gap-1 mt-0.5">
                <span className="iconify ph--spinner size-3 animate-spin" />
                {task.activeForm}
              </div>
            )}
          </div>
          <span className={`badge badge-sm ${STATUS_COLORS[task.status]}`}>
            <span className={`iconify ${STATUS_ICONS[task.status]} size-3 mr-1`} />
            {task.status.replace('_', ' ')}
          </span>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 text-xs text-base-content/60 flex-wrap">
          <span>{formatTimestamp(task.createdAtEpoch)}</span>
          <span>|</span>
          <span className="truncate max-w-32">{task.project}</span>
          {task.gitBranch && (
            <>
              <span>|</span>
              <span className="flex items-center gap-1">
                <span className="iconify ph--git-branch size-3" />
                {task.gitBranch}
              </span>
            </>
          )}
          {task.owner && (
            <>
              <span>|</span>
              <span className="flex items-center gap-1">
                <span className="iconify ph--user size-3" />
                {task.owner}
              </span>
            </>
          )}
        </div>

        {/* Description & Details */}
        {!compact && (
          <div className="mt-2">
            {task.description && (
              <p className="text-sm text-base-content/80 line-clamp-2">{task.description}</p>
            )}

            <button
              className="btn btn-xs btn-ghost mt-1"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              <span className={`iconify ${expanded ? 'ph--caret-up' : 'ph--caret-down'} size-4`} />
              {expanded ? 'Less' : 'Details'}
            </button>

            {expanded && (
              <div className="mt-2 space-y-2 text-xs" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  <span className="font-semibold">ID:</span>
                  <code className="text-base-content/70 font-mono">#{task.id}</code>
                  {task.externalId && (
                    <code className="text-base-content/50 font-mono ml-2">(ext: {task.externalId})</code>
                  )}
                </div>

                {task.sessionId && (
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">Session:</span>
                    <code className="text-base-content/70 font-mono truncate">{task.sessionId}</code>
                  </div>
                )}

                {task.workingDirectory && (
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">Directory:</span>
                    <code className="text-base-content/70 font-mono truncate">{task.workingDirectory}</code>
                  </div>
                )}

                {task.affectedFiles && task.affectedFiles.length > 0 && (
                  <div>
                    <span className="font-semibold">Files ({task.affectedFiles.length}):</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {task.affectedFiles.slice(0, 5).map((file, i) => (
                        <span key={i} className="badge badge-xs badge-ghost font-mono">{file.split('/').pop()}</span>
                      ))}
                      {task.affectedFiles.length > 5 && (
                        <span className="badge badge-xs">+{task.affectedFiles.length - 5}</span>
                      )}
                    </div>
                  </div>
                )}

                {task.blockedBy && task.blockedBy.length > 0 && (
                  <div className="text-error">
                    <span className="font-semibold">Blocked by:</span>
                    <span className="ml-1">{task.blockedBy.join(', ')}</span>
                  </div>
                )}

                {task.blocks && task.blocks.length > 0 && (
                  <div className="text-warning">
                    <span className="font-semibold">Blocks:</span>
                    <span className="ml-1">{task.blocks.join(', ')}</span>
                  </div>
                )}

                {(task.costTokens !== undefined || task.costUsd !== undefined) && (
                  <div className="flex items-center gap-4">
                    {task.costTokens !== undefined && (
                      <span>
                        <span className="font-semibold">Tokens:</span>
                        <span className="ml-1">{task.costTokens.toLocaleString()}</span>
                      </span>
                    )}
                    {task.costUsd !== undefined && (
                      <span>
                        <span className="font-semibold">Cost:</span>
                        <span className="ml-1">${task.costUsd.toFixed(4)}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({
  title,
  status,
  tasks,
  color,
  onSelect,
}: {
  title: string;
  status: UserTaskStatus;
  tasks: UserTask[];
  color: string;
  onSelect?: (task: UserTask) => void;
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
          tasks.map((task) => (
            <UserTaskCard key={task.id} task={task} compact onSelect={onSelect} />
          ))
        )}
      </div>
    </div>
  );
}

function TaskDetailModal({
  task,
  onClose,
}: {
  task: UserTask;
  onClose: () => void;
}) {
  const [children, setChildren] = useState<UserTask[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);

  useEffect(() => {
    setLoadingChildren(true);
    api.getUserTaskChildren(task.id)
      .then(setChildren)
      .finally(() => setLoadingChildren(false));
  }, [task.id]);

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl">
        {/* Header */}
        <div className="flex items-start gap-3">
          <span className={`iconify ${SOURCE_ICONS[task.source]} size-6 text-base-content/60 mt-1`} />
          <div className="flex-1">
            <h3 className="text-lg font-bold">{task.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`badge ${STATUS_COLORS[task.status]}`}>
                <span className={`iconify ${STATUS_ICONS[task.status]} size-4 mr-1`} />
                {task.status.replace('_', ' ')}
              </span>
              {task.priority && (
                <span className={`badge badge-outline ${PRIORITY_COLORS[task.priority]}`}>
                  {task.priority}
                </span>
              )}
              <span className="text-sm text-base-content/60">
                {formatTimestamp(task.createdAtEpoch)}
              </span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <span className="iconify ph--x size-5" />
          </button>
        </div>

        {/* Active Form */}
        {task.activeForm && task.status === 'in_progress' && (
          <div className="alert alert-info mt-4">
            <span className="iconify ph--spinner size-5 animate-spin" />
            <span>{task.activeForm}</span>
          </div>
        )}

        {/* Description */}
        {task.description && (
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Description</h4>
            <p className="text-base-content/80 whitespace-pre-wrap">{task.description}</p>
          </div>
        )}

        {/* Metadata */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-base-content/60">Project</span>
            <p className="font-mono">{task.project}</p>
          </div>
          <div>
            <span className="text-base-content/60">Source</span>
            <p className="flex items-center gap-1">
              <span className={`iconify ${SOURCE_ICONS[task.source]} size-4`} />
              {task.source}
            </p>
          </div>
          {task.gitBranch && (
            <div>
              <span className="text-base-content/60">Git Branch</span>
              <p className="font-mono flex items-center gap-1">
                <span className="iconify ph--git-branch size-4" />
                {task.gitBranch}
              </p>
            </div>
          )}
          {task.owner && (
            <div>
              <span className="text-base-content/60">Owner</span>
              <p className="flex items-center gap-1">
                <span className="iconify ph--user size-4" />
                {task.owner}
              </p>
            </div>
          )}
          {task.workingDirectory && (
            <div className="col-span-2">
              <span className="text-base-content/60">Working Directory</span>
              <p className="font-mono text-xs truncate">{task.workingDirectory}</p>
            </div>
          )}
        </div>

        {/* Affected Files */}
        {task.affectedFiles && task.affectedFiles.length > 0 && (
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Affected Files ({task.affectedFiles.length})</h4>
            <div className="max-h-32 overflow-y-auto bg-base-300 rounded p-2">
              {task.affectedFiles.map((file, i) => (
                <div key={i} className="font-mono text-xs py-0.5">{file}</div>
              ))}
            </div>
          </div>
        )}

        {/* Dependencies */}
        {(task.blockedBy?.length || task.blocks?.length) ? (
          <div className="mt-4 grid grid-cols-2 gap-4">
            {task.blockedBy && task.blockedBy.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 text-error flex items-center gap-1">
                  <span className="iconify ph--prohibit size-4" />
                  Blocked By
                </h4>
                <div className="space-y-1">
                  {task.blockedBy.map((id, i) => (
                    <div key={i} className="badge badge-outline badge-error">{id}</div>
                  ))}
                </div>
              </div>
            )}
            {task.blocks && task.blocks.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 text-warning flex items-center gap-1">
                  <span className="iconify ph--warning size-4" />
                  Blocks
                </h4>
                <div className="space-y-1">
                  {task.blocks.map((id, i) => (
                    <div key={i} className="badge badge-outline badge-warning">{id}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Child Tasks */}
        {loadingChildren ? (
          <div className="mt-4 flex justify-center">
            <span className="loading loading-spinner" />
          </div>
        ) : children.length > 0 ? (
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Subtasks ({children.length})</h4>
            <div className="space-y-2">
              {children.map((child) => (
                <div key={child.id} className="flex items-center gap-2 p-2 bg-base-300 rounded">
                  <span className={`badge badge-sm ${STATUS_COLORS[child.status]}`}>
                    <span className={`iconify ${STATUS_ICONS[child.status]} size-3`} />
                  </span>
                  <span className="flex-1 truncate">{child.title}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Cost */}
        {(task.costTokens !== undefined || task.costUsd !== undefined) && (
          <div className="mt-4 flex gap-4 text-sm">
            {task.costTokens !== undefined && (
              <div>
                <span className="text-base-content/60">Tokens Used</span>
                <p className="font-semibold">{task.costTokens.toLocaleString()}</p>
              </div>
            )}
            {task.costUsd !== undefined && (
              <div>
                <span className="text-base-content/60">Cost</span>
                <p className="font-semibold">${task.costUsd.toFixed(4)}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="modal-action">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

export function UserTasksView() {
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [stats, setStats] = useState<UserTaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<UserTaskStatus | ''>('');
  const [sourceFilter, setSourceFilter] = useState<UserTaskSource | ''>('');
  const [projectFilter, setProjectFilter] = useState('');
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedTask, setSelectedTask] = useState<UserTask | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [tasksRes, statsRes, projectsRes] = await Promise.all([
        api.getUserTasks({
          status: statusFilter || undefined,
          source: sourceFilter || undefined,
          project: projectFilter || undefined,
          limit: 100,
        }),
        api.getUserTaskStats(projectFilter || undefined),
        api.getProjects(),
      ]);

      setTasks(tasksRes);
      setStats(statsRes);
      setProjects(projectsRes.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sourceFilter, projectFilter]);

  useEffect(() => {
    loadTasks();
    // Refresh every 10 seconds
    const interval = setInterval(loadTasks, 10000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  // Group tasks by status for kanban view
  const tasksByStatus = TASK_STATUSES.reduce(
    (acc, status) => {
      acc[status] = tasks.filter((t) => t.status === status);
      return acc;
    },
    {} as Record<UserTaskStatus, UserTask[]>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">User Tasks</h1>
          <p className="text-base-content/60 text-sm">
            Tasks from Claude Code and other AI coding tools (read-only)
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
      {stats && (
        <div className="stats stats-horizontal shadow bg-base-200 w-full">
          <div className="stat py-2 px-4">
            <div className="stat-title text-xs">Total</div>
            <div className="stat-value text-lg">{stats.total}</div>
          </div>
          <div className="stat py-2 px-4">
            <div className="stat-title text-xs">Pending</div>
            <div className="stat-value text-lg text-warning">{stats.pending}</div>
          </div>
          <div className="stat py-2 px-4">
            <div className="stat-title text-xs">In Progress</div>
            <div className="stat-value text-lg text-primary">{stats.inProgress}</div>
          </div>
          <div className="stat py-2 px-4">
            <div className="stat-title text-xs">Completed</div>
            <div className="stat-value text-lg text-success">{stats.completed}</div>
          </div>
          <div className="stat py-2 px-4">
            <div className="stat-title text-xs">Blocked</div>
            <div className="stat-value text-lg text-error">{stats.blocked}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="select select-sm select-bordered"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as UserTaskStatus | '')}
        >
          <option value="">All Statuses</option>
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replace('_', ' ')}
            </option>
          ))}
        </select>

        <select
          className="select select-sm select-bordered"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as UserTaskSource | '')}
        >
          <option value="">All Sources</option>
          {TASK_SOURCES.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>

        <select
          className="select select-sm select-bordered"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map((project) => (
            <option key={project} value={project}>
              {project}
            </option>
          ))}
        </select>

        <span className="text-sm text-base-content/60">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
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
            onSelect={setSelectedTask}
          />
          <KanbanColumn
            title="In Progress"
            status="in_progress"
            tasks={tasksByStatus.in_progress}
            color="bg-primary/20"
            onSelect={setSelectedTask}
          />
          <KanbanColumn
            title="Blocked"
            status="blocked"
            tasks={tasksByStatus.blocked}
            color="bg-error/20"
            onSelect={setSelectedTask}
          />
          <KanbanColumn
            title="Ready for Review"
            status="ready_for_review"
            tasks={tasksByStatus.ready_for_review}
            color="bg-accent/20"
            onSelect={setSelectedTask}
          />
          <KanbanColumn
            title="Completed"
            status="completed"
            tasks={tasksByStatus.completed}
            color="bg-success/20"
            onSelect={setSelectedTask}
          />
        </div>
      ) : (
        /* List View */
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-base-content/50">
              <span className="iconify ph--clipboard-text size-12 mb-2" />
              <p>No user tasks found</p>
              <p className="text-sm mt-1">
                Tasks will appear here when created by Claude Code or other tools
              </p>
            </div>
          ) : (
            tasks.map((task) => (
              <UserTaskCard key={task.id} task={task} onSelect={setSelectedTask} />
            ))
          )}
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { api, type Session, type Observation, type ProjectSettings } from '../api/client';
import { ObservationDetails } from '../components/ObservationDetails';

interface ProjectStats {
  sessions: number;
  observations: number;
  summaries: number;
  tokens: number;
  firstActivity: number | null;
  lastActivity: number | null;
}

interface FileStats {
  filesRead: Array<{ path: string; count: number }>;
  filesModified: Array<{ path: string; count: number }>;
}

type Tab = 'sessions' | 'observations' | 'files';

export function ProjectsView() {
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [files, setFiles] = useState<FileStats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('sessions');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Project actions state
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectSettings, setProjectSettings] = useState<ProjectSettings | null>(null);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setShowActionsMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch project settings when project changes
  useEffect(() => {
    if (!selectedProject) return;
    api.getProjectSettings(selectedProject).then(setProjectSettings).catch(() => setProjectSettings(null));
  }, [selectedProject]);

  useEffect(() => {
    api.getProjects().then((res) => {
      const projectList = res.projects || [];
      setProjects(projectList);
      if (projectList.length > 0 && !selectedProject) {
        setSelectedProject(projectList[0]);
      }
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedProject) return;

    setIsLoading(true);
    Promise.all([
      api.getProjectStats(selectedProject),
      api.getProjectFiles(selectedProject),
      api.getSessions({ project: selectedProject, limit: 20 }),
      api.getObservations({ project: selectedProject, limit: 50 }),
    ])
      .then(([statsRes, filesRes, sessionsRes, obsRes]) => {
        setStats(statsRes);
        setFiles(filesRes);
        setSessions(sessionsRes.items || []);
        setObservations(obsRes.items || []);
      })
      .finally(() => setIsLoading(false));
  }, [selectedProject]);

  const formatDate = (epoch: number | null) => {
    if (!epoch) return '-';
    return new Date(epoch).toLocaleDateString();
  };

  const formatTimeAgo = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (isLoading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="iconify ph--folder-open size-16 text-base-content/30 mx-auto mb-4" />
        <h2 className="text-xl font-semibold">No Projects Found</h2>
        <p className="text-base-content/60 mt-2">
          Projects appear here once you start using Claude-Mem.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-base-content/60">Project-specific overview</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="select select-bordered w-full sm:w-64"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p} value={p}>
                {projectSettings?.display_name && p === selectedProject
                  ? projectSettings.display_name
                  : p}
              </option>
            ))}
          </select>

          {/* Project Actions Dropdown */}
          <div className="relative" ref={actionsMenuRef}>
            <button
              className="btn btn-ghost btn-square"
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              title="Project Actions"
            >
              <span className="iconify ph--dots-three-vertical size-5" />
            </button>

            {showActionsMenu && (
              <ul className="menu bg-base-200 rounded-box absolute right-0 top-full mt-1 w-48 shadow-lg z-10">
                <li>
                  <button
                    onClick={() => {
                      setNewDisplayName(projectSettings?.display_name || selectedProject);
                      setShowRenameModal(true);
                      setShowActionsMenu(false);
                    }}
                  >
                    <span className="iconify ph--pencil size-4" />
                    Rename
                  </button>
                </li>
                <li>
                  <button
                    onClick={async () => {
                      setIsActionLoading(true);
                      try {
                        await api.updateProjectSettings(selectedProject, {
                          archived: !projectSettings?.archived,
                        });
                        const updated = await api.getProjectSettings(selectedProject);
                        setProjectSettings(updated);
                      } catch {
                        // Ignore errors
                      }
                      setIsActionLoading(false);
                      setShowActionsMenu(false);
                    }}
                    disabled={isActionLoading}
                  >
                    <span className={`iconify ${projectSettings?.archived ? 'ph--archive-tray' : 'ph--archive'} size-4`} />
                    {projectSettings?.archived ? 'Unarchive' : 'Archive'}
                  </button>
                </li>
                <li>
                  <button
                    className="text-error"
                    onClick={() => {
                      setShowDeleteModal(true);
                      setShowActionsMenu(false);
                    }}
                  >
                    <span className="iconify ph--trash size-4" />
                    Delete
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon="ph--clock-counter-clockwise"
            label="Sessions"
            value={stats.sessions}
            color="accent"
          />
          <StatCard
            icon="ph--brain"
            label="Observations"
            value={stats.observations}
            color="primary"
          />
          <StatCard
            icon="ph--file-text"
            label="Summaries"
            value={stats.summaries}
            color="secondary"
          />
          <StatCard
            icon="ph--coins"
            label="Tokens"
            value={stats.tokens}
            color="warning"
          />
        </div>
      )}

      {/* Project Dashboard */}
      {stats && (
        <div className="card bg-base-200">
          <div className="card-body py-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Activity Timeline */}
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="text-base-content/60">First: </span>
                  <span className="font-medium">{formatDate(stats.firstActivity)}</span>
                </div>
                <span className="text-base-content/30">→</span>
                <div className="text-sm">
                  <span className="text-base-content/60">Last: </span>
                  <span className="font-medium">{formatDate(stats.lastActivity)}</span>
                </div>
              </div>

              {/* Activity Status */}
              <div className="flex items-center gap-4">
                {stats.lastActivity && (
                  <div className="flex items-center gap-2">
                    {(() => {
                      const lastActive = Date.now() - (stats.lastActivity || 0);
                      const isRecent = lastActive < 24 * 60 * 60 * 1000; // 24 hours
                      const isActive = lastActive < 7 * 24 * 60 * 60 * 1000; // 7 days
                      return (
                        <>
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${
                              isRecent ? 'bg-success animate-pulse' : isActive ? 'bg-warning' : 'bg-base-content/30'
                            }`}
                          />
                          <span className="text-sm text-base-content/60">
                            {isRecent ? 'Active today' : isActive ? 'Active this week' : 'Inactive'}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Average Tokens */}
                {stats.sessions > 0 && (
                  <div className="text-sm">
                    <span className="text-base-content/60">Avg tokens/session: </span>
                    <span className="font-medium">
                      {Math.round(stats.tokens / stats.sessions).toLocaleString()}
                    </span>
                  </div>
                )}

                {/* Archived Badge */}
                {projectSettings?.archived && (
                  <span className="badge badge-warning badge-sm gap-1">
                    <span className="iconify ph--archive size-3" />
                    Archived
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div role="tablist" className="tabs tabs-box">
        <button
          role="tab"
          className={`tab ${activeTab === 'sessions' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          <span className="iconify ph--clock-counter-clockwise size-4 mr-1.5" />
          Sessions ({sessions.length})
        </button>
        <button
          role="tab"
          className={`tab ${activeTab === 'observations' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('observations')}
        >
          <span className="iconify ph--brain size-4 mr-1.5" />
          Observations ({observations.length})
        </button>
        <button
          role="tab"
          className={`tab ${activeTab === 'files' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          <span className="iconify ph--files size-4 mr-1.5" />
          Files
        </button>
      </div>

      {/* Tab Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <span className="loading loading-spinner loading-md" />
        </div>
      ) : (
        <>
          {activeTab === 'sessions' && (
            <div className="space-y-2">
              {sessions.length === 0 ? (
                <p className="text-center text-base-content/50 py-8">No sessions found</p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className="card bg-base-200 cursor-pointer hover:bg-base-300 transition-colors"
                    onClick={() => setSelectedSession(session)}
                  >
                    <div className="card-body py-3 px-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {session.user_prompt || 'No prompt recorded'}
                          </p>
                          <p className="text-sm text-base-content/60">
                            {formatTimeAgo(session.started_at)} &middot;{' '}
                            {session.observation_count ?? 0} observations &middot;{' '}
                            {session.prompt_count ?? 0} prompts
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`badge badge-sm ${
                              session.status === 'active' ? 'badge-success' : 'badge-ghost'
                            }`}
                          >
                            {session.status}
                          </span>
                          <span className="iconify ph--caret-right size-4 text-base-content/30" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'observations' && (
            <div className="space-y-2">
              {observations.length === 0 ? (
                <p className="text-center text-base-content/50 py-8">No observations found</p>
              ) : (
                observations.map((obs) => (
                  <div key={obs.id} className="card bg-base-200">
                    <div className="card-body py-3 px-4">
                      <div className="flex items-start gap-3">
                        <span className={`iconify ${getTypeIcon(obs.type)} size-5 mt-0.5`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{obs.title}</p>
                          {obs.subtitle && (
                            <p className="text-sm text-base-content/70 truncate">{obs.subtitle}</p>
                          )}
                          <p className="text-sm text-base-content/50">
                            {formatTimeAgo(obs.created_at)} &middot; {obs.type}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'files' && files && (
            <div className="space-y-6">
              {/* File Stats Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-base-200 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">{files.filesRead.length}</p>
                  <p className="text-xs text-base-content/60">Files Read</p>
                </div>
                <div className="bg-base-200 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">{files.filesModified.length}</p>
                  <p className="text-xs text-base-content/60">Files Modified</p>
                </div>
                <div className="bg-base-200 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">
                    {files.filesRead.reduce((sum, f) => sum + f.count, 0)}
                  </p>
                  <p className="text-xs text-base-content/60">Total Reads</p>
                </div>
                <div className="bg-base-200 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">
                    {files.filesModified.reduce((sum, f) => sum + f.count, 0)}
                  </p>
                  <p className="text-xs text-base-content/60">Total Modifications</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card bg-base-200">
                  <div className="card-body">
                    <h3 className="card-title text-base">
                      <span className="iconify ph--eye size-5 text-info" />
                      Most Read Files
                    </h3>
                    <div className="space-y-2 mt-2">
                      {files.filesRead.length === 0 ? (
                        <p className="text-base-content/50 text-sm">No files tracked</p>
                      ) : (
                        (() => {
                          const maxCount = Math.max(...files.filesRead.map((f) => f.count));
                          return files.filesRead.slice(0, 15).map((f, i) => (
                            <FileItem key={i} file={f} maxCount={maxCount} color="info" />
                          ));
                        })()
                      )}
                    </div>
                  </div>
                </div>

                <div className="card bg-base-200">
                  <div className="card-body">
                    <h3 className="card-title text-base">
                      <span className="iconify ph--pencil size-5 text-warning" />
                      Most Modified Files
                    </h3>
                    <div className="space-y-2 mt-2">
                      {files.filesModified.length === 0 ? (
                        <p className="text-base-content/50 text-sm">No files tracked</p>
                      ) : (
                        (() => {
                          const maxCount = Math.max(...files.filesModified.map((f) => f.count));
                          return files.filesModified.slice(0, 15).map((f, i) => (
                            <FileItem key={i} file={f} maxCount={maxCount} color="warning" />
                          ));
                        })()
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Session Detail Modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}

      {/* Rename Project Modal */}
      {showRenameModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Rename Project</h3>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Display Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder={selectedProject}
              />
              <label className="label">
                <span className="label-text-alt text-base-content/60">
                  Original name: {selectedProject}
                </span>
              </label>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setShowRenameModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={isActionLoading || !newDisplayName.trim()}
                onClick={async () => {
                  setIsActionLoading(true);
                  try {
                    await api.updateProjectSettings(selectedProject, {
                      display_name: newDisplayName.trim(),
                    });
                    const updated = await api.getProjectSettings(selectedProject);
                    setProjectSettings(updated);
                    setShowRenameModal(false);
                  } catch {
                    // Ignore errors
                  }
                  setIsActionLoading(false);
                }}
              >
                {isActionLoading ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </div>
          <div className="modal-backdrop bg-black/50" onClick={() => setShowRenameModal(false)} />
        </div>
      )}

      {/* Delete Project Modal */}
      {showDeleteModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4 text-error">Delete Project</h3>
            <p className="mb-4">
              Are you sure you want to delete <strong>{selectedProject}</strong>?
            </p>
            <p className="text-sm text-base-content/60 mb-4">
              This will delete all project settings. Observations, sessions, and other data
              associated with this project will NOT be deleted.
            </p>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
                disabled={isActionLoading}
                onClick={async () => {
                  setIsActionLoading(true);
                  try {
                    await api.deleteProjectSettings(selectedProject);
                    // Refresh project settings
                    setProjectSettings(null);
                    setShowDeleteModal(false);
                  } catch {
                    // Ignore errors
                  }
                  setIsActionLoading(false);
                }}
              >
                {isActionLoading ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
          <div className="modal-backdrop bg-black/50" onClick={() => setShowDeleteModal(false)} />
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="card bg-base-200">
      <div className="card-body p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${color}/10`}>
            <span className={`iconify ${icon} size-5 text-${color}`} />
          </div>
          <div>
            <p className="text-2xl font-bold">{value.toLocaleString()}</p>
            <p className="text-xs text-base-content/60">{label}</p>
          </div>
        </div>
      </div>
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
    case 'docs':
      return 'ph--file-text text-base-content';
    case 'test':
      return 'ph--test-tube text-accent';
    case 'security':
      return 'ph--shield-check text-error';
    case 'performance':
      return 'ph--lightning text-warning';
    case 'deploy':
      return 'ph--rocket-launch text-primary';
    default:
      return 'ph--circle text-base-content/50';
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
    default:
      return 'badge-ghost';
  }
}

function formatDate(timestamp: string): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(timestamp: string): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getFileIcon(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'ph--file-ts text-blue-400';
    case 'js':
    case 'jsx':
      return 'ph--file-js text-yellow-400';
    case 'json':
      return 'ph--file-code text-green-400';
    case 'md':
      return 'ph--file-text text-base-content';
    case 'css':
    case 'scss':
    case 'less':
      return 'ph--file-css text-purple-400';
    case 'html':
      return 'ph--file-html text-orange-400';
    case 'py':
      return 'ph--file-py text-blue-300';
    case 'sql':
      return 'ph--database text-cyan-400';
    case 'yml':
    case 'yaml':
      return 'ph--file-code text-red-300';
    default:
      return 'ph--file text-base-content/60';
  }
}

function FileItem({
  file,
  maxCount,
  color,
}: {
  file: { path: string; count: number };
  maxCount: number;
  color: 'info' | 'warning';
}) {
  const parts = file.path.split('/');
  const filename = parts.pop() || file.path;
  const directory = parts.length > 0 ? parts.join('/') + '/' : '';
  const percentage = (file.count / maxCount) * 100;

  return (
    <div className="group">
      <div className="flex items-center gap-2">
        <span className={`iconify ${getFileIcon(file.path)} size-4 shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-xs font-medium truncate">{filename}</span>
            <span className="badge badge-sm">{file.count}</span>
          </div>
          {directory && (
            <p className="font-mono text-xs text-base-content/40 truncate">{directory}</p>
          )}
        </div>
      </div>
      <div className="mt-1 h-1 bg-base-300 rounded-full overflow-hidden">
        <div
          className={`h-full bg-${color} rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function SessionDetailModal({
  session,
  onClose,
}: {
  session: Session;
  onClose: () => void;
}) {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [selectedObs, setSelectedObs] = useState<Observation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchObservations() {
      try {
        const data = await api.getObservations({ sessionId: session.memory_session_id, limit: 200 });
        setObservations(data.items || []);
      } catch (error) {
        console.error('Failed to fetch observations:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchObservations();
  }, [session.memory_session_id]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedObs) {
          setSelectedObs(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, selectedObs]);

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`badge ${session.status === 'completed' ? 'badge-success' : 'badge-info'}`}>
                {session.status}
              </span>
              <span className="text-sm text-base-content/50 font-mono">
                {session.content_session_id?.slice(0, 8)}
              </span>
            </div>
            <h3 className="font-bold text-lg">{session.project}</h3>
            <p className="text-base-content/70 mt-1">{session.user_prompt || 'No prompt recorded'}</p>
          </div>
          <button className="btn btn-ghost btn-sm btn-square" onClick={onClose}>
            <span className="iconify ph--x size-5" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-base-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{session.observation_count ?? 0}</p>
            <p className="text-xs text-base-content/60">Observations</p>
          </div>
          <div className="bg-base-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{session.prompt_count ?? 0}</p>
            <p className="text-xs text-base-content/60">Prompts</p>
          </div>
          <div className="bg-base-200 rounded-lg p-3 text-center">
            <p className="text-sm font-medium">{formatDate(session.started_at)}</p>
            <p className="text-xs text-base-content/60">Started</p>
          </div>
          <div className="bg-base-200 rounded-lg p-3 text-center">
            <p className="text-sm font-medium">{session.completed_at ? formatDate(session.completed_at) : '-'}</p>
            <p className="text-xs text-base-content/60">Completed</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <h4 className="font-semibold mb-3">Observations</h4>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-md" />
            </div>
          ) : observations.length === 0 ? (
            <p className="text-center text-base-content/50 py-8">No observations</p>
          ) : (
            <div className="space-y-2">
              {observations.map((obs) => (
                <div
                  key={obs.id}
                  className="bg-base-200 rounded-lg p-3 cursor-pointer hover:bg-base-300 transition-colors"
                  onClick={() => setSelectedObs(obs)}
                >
                  <div className="flex items-start gap-3">
                    <span className={`iconify ${getTypeIcon(obs.type)} size-5 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`badge badge-xs ${getTypeBadge(obs.type)}`}>{obs.type}</span>
                        <span className="text-xs text-base-content/50">{formatTime(obs.created_at)}</span>
                        {obs.prompt_number && (
                          <span className="text-xs text-base-content/50">Prompt #{obs.prompt_number}</span>
                        )}
                      </div>
                      <p className="font-medium mt-1 truncate">{obs.title}</p>
                      {obs.subtitle && <p className="text-sm text-base-content/60 truncate">{obs.subtitle}</p>}
                    </div>
                    <span className="iconify ph--caret-right size-4 text-base-content/30" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose} />

      {selectedObs && (
        <div className="modal modal-open" style={{ zIndex: 60 }}>
          <div className="modal-box max-w-3xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={`iconify ${getTypeIcon(selectedObs.type)} size-6`} />
                <span className={`badge ${getTypeBadge(selectedObs.type)}`}>{selectedObs.type}</span>
                <span className="font-semibold">{selectedObs.title}</span>
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
    </div>
  );
}

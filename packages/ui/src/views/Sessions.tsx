import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

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
}

export function SessionsView() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);
  const [projects, setProjects] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>('');

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = { limit: '50' };
      if (projectFilter) {
        params.project = projectFilter;
      }
      const data = await api.getSessions(params);
      setSessions(data.items || []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectFilter]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sessions</h1>
          <p className="text-base-content/60">Browse sessions and explore their timeline</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="select select-bordered select-sm w-48"
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
          <button className="btn btn-ghost btn-sm btn-square" onClick={fetchSessions}>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({
  session,
  isExpanded,
  onToggle,
}: {
  session: Session;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="card bg-base-200">
      <div
        className="card-body p-4 cursor-pointer hover:bg-base-300/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
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
                {session.observation_count} observations
              </span>
              <span>{formatDate(session.started_at)}</span>
            </div>
          </div>
          <span
            className={`iconify ph--caret-down size-5 text-base-content/50 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-base-300">
            <SessionTimeline sessionId={session.id} />
          </div>
        )}
      </div>
    </div>
  );
}

function SessionTimeline({ sessionId }: { sessionId: number }) {
  const [observations, setObservations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchObservations() {
      try {
        const data = await api.getObservations({ session_id: sessionId, limit: 50 });
        setObservations(data.items || []);
      } catch (error) {
        console.error('Failed to fetch session observations:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchObservations();
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <span className="loading loading-spinner loading-sm" />
      </div>
    );
  }

  if (observations.length === 0) {
    return <p className="text-sm text-base-content/50 text-center py-4">No observations in this session</p>;
  }

  return (
    <div className="space-y-3">
      {observations.map((obs, index) => (
        <div key={obs.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-2 h-2 rounded-full ${getTypeColor(obs.type)}`} />
            {index < observations.length - 1 && <div className="w-px flex-1 bg-base-300 mt-1" />}
          </div>
          <div className="flex-1 pb-3">
            <div className="flex items-center gap-2">
              <span className={`badge badge-xs ${getTypeBadge(obs.type)}`}>{obs.type}</span>
              <span className="text-xs text-base-content/50">{formatTime(obs.created_at)}</span>
            </div>
            <p className="text-sm font-medium mt-1">{obs.title}</p>
            {obs.subtitle && <p className="text-xs text-base-content/60 mt-0.5">{obs.subtitle}</p>}
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

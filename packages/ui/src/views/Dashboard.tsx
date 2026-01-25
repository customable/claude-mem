import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useSSE } from '../hooks/useSSE';

interface Stats {
  observations: number;
  summaries: number;
  sessions: number;
  projects: number;
}

interface WorkerStatus {
  status: 'online' | 'offline' | 'degraded';
  connected: number;
  version?: string;
}

export function DashboardView() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);
  const [recentObservations, setRecentObservations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // SSE for real-time updates
  const { lastEvent, workerCount, status: sseStatus } = useSSE();

  // Handle SSE events
  useEffect(() => {
    if (!lastEvent) return;

    switch (lastEvent.type) {
      case 'observation:created':
        // Increment observation count
        setStats((prev) => prev ? { ...prev, observations: prev.observations + 1 } : prev);
        // Add to recent observations if data is provided
        if (lastEvent.data && typeof lastEvent.data === 'object') {
          setRecentObservations((prev) => {
            const newObs = lastEvent.data as any;
            // Add to beginning, keep only 5
            return [newObs, ...prev].slice(0, 5);
          });
        }
        break;

      case 'summary:created':
        setStats((prev) => prev ? { ...prev, summaries: prev.summaries + 1 } : prev);
        break;

      case 'session:started':
        setStats((prev) => prev ? { ...prev, sessions: prev.sessions + 1 } : prev);
        break;

      case 'worker:connected':
      case 'worker:disconnected':
        // Update worker count from SSE state
        setWorkerStatus((prev) => prev ? { ...prev, connected: workerCount } : prev);
        break;
    }
  }, [lastEvent, workerCount]);

  // Update worker status when SSE status changes
  useEffect(() => {
    setWorkerStatus((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: sseStatus === 'connected' ? 'online' : sseStatus === 'error' ? 'offline' : prev.status,
        connected: workerCount,
      };
    });
  }, [sseStatus, workerCount]);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, healthRes, obsRes] = await Promise.all([
        api.getStats(),
        api.getHealth(),
        api.getObservations({ limit: 5 }),
      ]);

      setStats(statsRes);
      setWorkerStatus({
        status: healthRes.coreReady ? 'online' : 'offline',
        connected: healthRes.workers?.connected || 0,
        version: healthRes.version,
      });
      setRecentObservations(obsRes.items || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Reduce polling interval since we have SSE updates (fallback only)
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-base-content/60">Overview of your claude-mem instance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon="ph--brain"
          label="Observations"
          value={stats?.observations ?? 0}
          color="primary"
          href="memories"
        />
        <StatCard
          icon="ph--file-text"
          label="Summaries"
          value={stats?.summaries ?? 0}
          color="secondary"
          href="sessions"
        />
        <StatCard
          icon="ph--clock-counter-clockwise"
          label="Sessions"
          value={stats?.sessions ?? 0}
          color="accent"
          href="sessions"
        />
        <StatCard
          icon="ph--folder-open"
          label="Projects"
          value={stats?.projects ?? 0}
          color="info"
          href="projects"
        />
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Worker Status */}
        <div className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title text-base">
              <span className="iconify ph--cpu size-5" />
              Backend Status
            </h2>
            <div className="flex items-center gap-3 mt-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  workerStatus?.status === 'online'
                    ? 'bg-success animate-pulse'
                    : workerStatus?.status === 'degraded'
                    ? 'bg-warning'
                    : 'bg-error'
                }`}
              />
              <span className="font-medium capitalize">{workerStatus?.status || 'Unknown'}</span>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-base-content/60">Version</span>
                <span className="font-mono">{workerStatus?.version || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/60">Connected Workers</span>
                <span>{workerStatus?.connected || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card bg-base-200">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <h2 className="card-title text-base">
                <span className="iconify ph--clock size-5" />
                Recent Activity
              </h2>
              <a
                href="#live"
                className="btn btn-ghost btn-xs gap-1"
              >
                View all
                <span className="iconify ph--arrow-right size-3" />
              </a>
            </div>
            {recentObservations.length === 0 ? (
              <p className="text-base-content/50 text-sm mt-2">No recent activity</p>
            ) : (
              <div className="mt-2 space-y-2">
                {recentObservations.slice(0, 5).map((obs) => (
                  <div key={obs.id} className="flex items-start gap-2 text-sm">
                    <span className={`iconify size-4 mt-0.5 ${getTypeIcon(obs.type)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{obs.title}</p>
                      <p className="text-xs text-base-content/50">
                        {obs.project} &middot; {formatTimeAgo(obs.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  trend,
  href,
}: {
  icon: string;
  label: string;
  value: number;
  color: string;
  trend?: { value: number; period: string }; // e.g., { value: 12, period: 'vs last week' }
  href?: string; // Navigation target (hash route)
}) {
  const handleClick = () => {
    if (href) {
      window.location.hash = href;
    }
  };

  return (
    <div
      className={`card bg-base-200 ${href ? 'cursor-pointer hover:bg-base-300 transition-colors' : ''}`}
      onClick={handleClick}
      role={href ? 'button' : undefined}
      tabIndex={href ? 0 : undefined}
      onKeyDown={href ? (e) => e.key === 'Enter' && handleClick() : undefined}
    >
      <div className="card-body p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${color}/10`}>
            <span className={`iconify ${icon} size-5 text-${color}`} />
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold">{value.toLocaleString()}</p>
            <p className="text-xs text-base-content/60">{label}</p>
          </div>
          {trend && (
            <div className={`text-right ${trend.value >= 0 ? 'text-success' : 'text-error'}`}>
              <div className="flex items-center gap-0.5 text-sm font-medium">
                <span className={`iconify ${trend.value >= 0 ? 'ph--trend-up' : 'ph--trend-down'} size-4`} />
                <span>{Math.abs(trend.value)}%</span>
              </div>
              <p className="text-xs text-base-content/40">{trend.period}</p>
            </div>
          )}
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
      return 'ph--sparkle text-success';
    case 'refactor':
      return 'ph--arrows-clockwise text-info';
    case 'discovery':
      return 'ph--magnifying-glass text-primary';
    case 'decision':
      return 'ph--scales text-warning';
    default:
      return 'ph--circle text-base-content/50';
  }
}

function formatTimeAgo(timestamp: string): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

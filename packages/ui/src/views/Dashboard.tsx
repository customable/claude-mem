import { useState, useEffect } from 'react';
import { api } from '../api/client';

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

  useEffect(() => {
    async function fetchData() {
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
    }

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

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
        />
        <StatCard
          icon="ph--file-text"
          label="Summaries"
          value={stats?.summaries ?? 0}
          color="secondary"
        />
        <StatCard
          icon="ph--clock-counter-clockwise"
          label="Sessions"
          value={stats?.sessions ?? 0}
          color="accent"
        />
        <StatCard
          icon="ph--folder-open"
          label="Projects"
          value={stats?.projects ?? 0}
          color="info"
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
            <h2 className="card-title text-base">
              <span className="iconify ph--clock size-5" />
              Recent Activity
            </h2>
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

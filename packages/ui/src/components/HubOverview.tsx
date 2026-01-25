/**
 * Hub Overview Component (Issue #263)
 *
 * Displays connected hubs and their status.
 */

import { useState, useEffect } from 'react';
import { api, type Hub, type HubStats, type WorkerRegistration } from '../api/client';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function HubStatusBadge({ status }: { status: Hub['status'] }) {
  const styles: Record<string, string> = {
    healthy: 'badge-success',
    degraded: 'badge-warning',
    unhealthy: 'badge-error',
    offline: 'badge-ghost',
  };
  const icons: Record<string, string> = {
    healthy: 'ph--check-circle',
    degraded: 'ph--warning',
    unhealthy: 'ph--x-circle',
    offline: 'ph--minus-circle',
  };
  return (
    <span className={`badge ${styles[status] || 'badge-ghost'} flex items-center gap-1`}>
      <span className={`iconify ${icons[status]} size-3`} />
      {status}
    </span>
  );
}

function HubTypeBadge({ type }: { type: Hub['type'] }) {
  return (
    <span className={`badge ${type === 'builtin' ? 'badge-primary' : 'badge-secondary'} badge-outline badge-sm`}>
      {type === 'builtin' ? 'Built-in' : 'External'}
    </span>
  );
}

interface HubCardProps {
  hub: Hub;
  expanded: boolean;
  onToggle: () => void;
  workers: WorkerRegistration[];
  loadingWorkers: boolean;
}

function HubCard({ hub, expanded, onToggle, workers, loadingWorkers }: HubCardProps) {
  const usagePercent = hub.connectedWorkers > 0
    ? Math.round((hub.activeWorkers / hub.connectedWorkers) * 100)
    : 0;

  return (
    <div className="card bg-base-200 overflow-hidden">
      <div className="card-body p-4">
        {/* Hub Header */}
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
            hub.type === 'builtin' ? 'bg-primary/20' : 'bg-secondary/20'
          }`}>
            <span className={`iconify ${hub.type === 'builtin' ? 'ph--house' : 'ph--cloud'} size-6 ${
              hub.type === 'builtin' ? 'text-primary' : 'text-secondary'
            }`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{hub.name}</h3>
              <HubTypeBadge type={hub.type} />
              <HubStatusBadge status={hub.status} />
            </div>
            <div className="flex items-center gap-4 text-sm text-base-content/60 mt-1">
              {hub.region && (
                <span className="flex items-center gap-1">
                  <span className="iconify ph--map-pin size-4" />
                  {hub.region}
                </span>
              )}
              {hub.endpoint && (
                <span className="flex items-center gap-1 truncate max-w-[200px]">
                  <span className="iconify ph--link size-4" />
                  {hub.endpoint}
                </span>
              )}
              <span>Priority: {hub.priority}</span>
              {hub.avgLatencyMs !== undefined && (
                <span>{hub.avgLatencyMs}ms avg latency</span>
              )}
            </div>
          </div>

          {/* Worker Stats */}
          <div className="text-right">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{hub.connectedWorkers}</span>
              <span className="text-base-content/60">workers</span>
            </div>
            <div className="text-sm text-base-content/60">
              {hub.activeWorkers} active ({usagePercent}%)
            </div>
          </div>

          {/* Toggle */}
          <button
            onClick={onToggle}
            className="btn btn-ghost btn-sm"
            title="View workers"
          >
            <span className={`iconify ${expanded ? 'ph--caret-up' : 'ph--caret-down'} size-4`} />
          </button>
        </div>

        {/* Capabilities & Labels */}
        {(hub.capabilities?.length || hub.labels) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {hub.capabilities?.map((cap) => (
              <span key={cap} className="badge badge-outline badge-sm">
                {cap}
              </span>
            ))}
            {hub.labels && Object.entries(hub.labels).map(([k, v]) => (
              <span key={k} className="badge badge-ghost badge-sm">
                {k}: {v}
              </span>
            ))}
          </div>
        )}

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-base-content/60 mb-1">
            <span>Worker Utilization</span>
            <span>{hub.activeWorkers} / {hub.connectedWorkers} busy</span>
          </div>
          <progress
            className={`progress w-full ${usagePercent > 80 ? 'progress-warning' : 'progress-primary'}`}
            value={hub.activeWorkers}
            max={hub.connectedWorkers || 1}
          />
        </div>

        {/* Expanded: Workers */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-base-300">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <span className="iconify ph--users size-4" />
              Connected Workers
            </h4>
            {loadingWorkers ? (
              <div className="flex items-center justify-center py-4">
                <span className="loading loading-spinner loading-sm" />
              </div>
            ) : workers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>System ID</th>
                      <th>Hostname</th>
                      <th>Status</th>
                      <th>Capabilities</th>
                      <th>Last Heartbeat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map((worker) => (
                      <tr key={worker.id}>
                        <td className="font-mono text-xs">{worker.systemId}</td>
                        <td>{worker.hostname || '-'}</td>
                        <td>
                          <span className={`badge badge-sm ${worker.status === 'online' ? 'badge-success' : 'badge-ghost'}`}>
                            {worker.status}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-1 flex-wrap">
                            {worker.capabilities?.map((cap) => (
                              <span key={cap} className="badge badge-xs badge-outline">{cap}</span>
                            ))}
                          </div>
                        </td>
                        <td className="text-sm">{formatDate(worker.lastHeartbeat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-base-content/60 text-sm py-2">
                No workers connected to this hub.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function HubOverview() {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [stats, setStats] = useState<HubStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedHub, setExpandedHub] = useState<string | null>(null);
  const [hubWorkers, setHubWorkers] = useState<Record<string, WorkerRegistration[]>>({});
  const [loadingWorkers, setLoadingWorkers] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [hubsData, statsData] = await Promise.all([
        api.getHubs(),
        api.getHubStats(),
      ]);
      setHubs(hubsData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hubs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const toggleHub = async (hubId: string) => {
    if (expandedHub === hubId) {
      setExpandedHub(null);
      return;
    }

    setExpandedHub(hubId);
    if (!hubWorkers[hubId]) {
      setLoadingWorkers(hubId);
      try {
        const workers = await api.getHubWorkers(hubId);
        setHubWorkers((prev) => ({ ...prev, [hubId]: workers }));
      } catch (err) {
        console.error('Failed to load hub workers:', err);
      } finally {
        setLoadingWorkers(null);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="iconify ph--buildings size-6" />
            Hub Federation
          </h2>
          <p className="text-sm text-base-content/60">
            Distributed worker pools for scaling and reliability
          </p>
        </div>
        <button
          onClick={loadData}
          className="btn btn-ghost btn-sm"
          disabled={loading}
        >
          <span className="iconify ph--arrows-clockwise size-4" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat bg-base-200 rounded-lg p-4">
            <div className="stat-title text-xs">Total Hubs</div>
            <div className="stat-value text-2xl">{stats.totalHubs}</div>
          </div>
          <div className="stat bg-base-200 rounded-lg p-4">
            <div className="stat-title text-xs">Healthy</div>
            <div className="stat-value text-2xl text-success">{stats.healthyHubs}</div>
          </div>
          <div className="stat bg-base-200 rounded-lg p-4">
            <div className="stat-title text-xs">Total Workers</div>
            <div className="stat-value text-2xl">{stats.totalWorkers}</div>
          </div>
          <div className="stat bg-base-200 rounded-lg p-4">
            <div className="stat-title text-xs">Active Workers</div>
            <div className="stat-value text-2xl text-primary">{stats.activeWorkers}</div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error">
          <span className="iconify ph--warning-circle size-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="btn btn-ghost btn-sm">
            Dismiss
          </button>
        </div>
      )}

      {/* Hub List */}
      {hubs.length === 0 ? (
        <div className="card bg-base-200">
          <div className="card-body items-center text-center py-12">
            <span className="iconify ph--buildings-light size-16 text-base-content/30" />
            <h3 className="text-lg font-medium mt-4">No hubs registered</h3>
            <p className="text-base-content/60 max-w-md">
              The built-in hub will appear once workers start connecting.
              External hubs can be deployed to scale across regions.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {hubs.map((hub) => (
            <HubCard
              key={hub.id}
              hub={hub}
              expanded={expandedHub === hub.id}
              onToggle={() => toggleHub(hub.id)}
              workers={hubWorkers[hub.id] || []}
              loadingWorkers={loadingWorkers === hub.id}
            />
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="alert alert-info">
        <span className="iconify ph--info size-5" />
        <div>
          <h4 className="font-medium">About Hub Federation</h4>
          <p className="text-sm">
            Hubs enable distributed worker pools. The built-in hub is always available.
            External hubs can be deployed in different regions and connect via WebSocket federation.
          </p>
        </div>
      </div>
    </div>
  );
}

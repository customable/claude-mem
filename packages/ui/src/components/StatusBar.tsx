/**
 * Status Bar
 *
 * Shows system health and worker status.
 */

import { api, type HealthStatus } from '../api/client';
import { useQuery } from '../hooks/useApi';

export function StatusBar() {
  const { data, loading, error } = useQuery<HealthStatus>(() => api.getHealth(), []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-base-content/60">
        <span className="loading loading-spinner loading-xs" />
        <span>Connecting...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-error">
        <span className="iconify ph--warning-circle size-4" />
        <span>Backend unavailable</span>
      </div>
    );
  }

  const statusColor =
    data.status === 'healthy'
      ? 'text-success'
      : data.status === 'degraded'
        ? 'text-warning'
        : 'text-error';

  const badgeColor =
    data.status === 'healthy'
      ? 'badge-success'
      : data.status === 'degraded'
        ? 'badge-warning'
        : 'badge-error';

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className={`flex items-center gap-1.5 ${statusColor}`}>
        <span className="iconify ph--circle-fill size-2" />
        <span>{data.status === 'healthy' ? 'Connected' : data.status}</span>
      </div>
      <div className={`badge badge-sm ${badgeColor} badge-outline`}>
        <span className="iconify ph--cpu size-3 mr-1" />
        {data.workers} worker{data.workers !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

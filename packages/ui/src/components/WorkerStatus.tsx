/**
 * Worker Status
 *
 * Shows connected workers and their capabilities.
 */

import { api, type Worker } from '../api/client';
import { useQuery } from '../hooks/useApi';

export function WorkerStatus() {
  const { data, loading, error, refetch } = useQuery(() => api.getWorkers(), []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-base-content/60">
        <span className="loading loading-spinner loading-md mb-2" />
        <span>Loading workers...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span className="iconify ph--warning-circle size-5" />
        <span>Failed to load workers</span>
      </div>
    );
  }

  const workers = data?.data || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Workers</h2>
          <span className="badge badge-neutral badge-sm">{workers.length} connected</span>
        </div>
        <button onClick={refetch} className="btn btn-ghost btn-sm">
          <span className="iconify ph--arrows-clockwise size-4" />
          Refresh
        </button>
      </div>

      {/* Worker List */}
      {workers.length === 0 ? (
        <div className="card bg-base-100 card-border">
          <div className="card-body items-center justify-center py-12 text-base-content/60">
            <span className="iconify ph--plugs size-12 mb-2" />
            <span className="text-lg font-medium">No workers connected</span>
            <p className="text-sm mt-1">Start a worker to process tasks</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {workers.map((worker) => (
            <WorkerItem key={worker.id} worker={worker} />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkerItem({ worker }: { worker: Worker }) {
  const isIdle = !worker.currentTaskId;
  const lastSeen = new Date(worker.lastHeartbeat).toLocaleTimeString();

  return (
    <div className="card bg-base-100 card-border">
      <div className="card-body p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="iconify ph--cpu size-5 text-primary" />
            <span className="font-mono text-sm">{worker.id.slice(0, 12)}</span>
          </div>
          <div
            className={`badge badge-sm ${isIdle ? 'badge-success' : 'badge-warning'}`}
          >
            <span
              className={`iconify ${isIdle ? 'ph--check' : 'ph--spinner'} size-3 mr-1 ${
                !isIdle ? 'animate-spin' : ''
              }`}
            />
            {isIdle ? 'Idle' : 'Working'}
          </div>
        </div>

        {/* Capabilities */}
        <div className="mb-3">
          <div className="text-xs text-base-content/60 uppercase tracking-wide mb-1.5">
            Capabilities
          </div>
          <div className="flex flex-wrap gap-1.5">
            {worker.capabilities.map((cap) => (
              <span key={cap} className="badge badge-outline badge-sm">
                {cap}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-base-content/50 pt-2 border-t border-base-300">
          <span>Last heartbeat</span>
          <span className="flex items-center gap-1">
            <span className="iconify ph--clock size-3" />
            {lastSeen}
          </span>
        </div>
      </div>
    </div>
  );
}

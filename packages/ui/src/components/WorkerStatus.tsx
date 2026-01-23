/**
 * Worker Status
 *
 * Shows connected workers and their capabilities with real-time SSE updates.
 */

import { useEffect, useState } from 'react';
import { api, type Worker } from '../api/client';
import { useSSE } from '../hooks/useSSE';

export function WorkerStatus() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { workerTasks, lastEvent } = useSSE();

  // Initial fetch
  useEffect(() => {
    api.getWorkers()
      .then((data) => {
        setWorkers(data.data || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Refetch on worker connect/disconnect events
  useEffect(() => {
    if (lastEvent?.type === 'worker:connected' || lastEvent?.type === 'worker:disconnected') {
      api.getWorkers()
        .then((data) => {
          setWorkers(data.data || []);
        })
        .catch(() => {
          // Ignore errors on refetch
        });
    }
  }, [lastEvent]);

  const refetch = () => {
    setLoading(true);
    api.getWorkers()
      .then((data) => {
        setWorkers(data.data || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  if (loading && workers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-base-content/60">
        <span className="loading loading-spinner loading-md mb-2" />
        <span>Loading workers...</span>
      </div>
    );
  }

  if (error && workers.length === 0) {
    return (
      <div className="alert alert-error">
        <span className="iconify ph--warning-circle size-5" />
        <span>Failed to load workers</span>
      </div>
    );
  }

  // Count busy workers
  const busyCount = workers.filter((w) => workerTasks[w.id]).length;
  const idleCount = workers.length - busyCount;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Workers</h2>
          <span className="badge badge-neutral badge-sm">{workers.length} connected</span>
          {busyCount > 0 && (
            <span className="badge badge-warning badge-sm">
              <span className="iconify ph--spinner size-3 mr-1 animate-spin" />
              {busyCount} working
            </span>
          )}
          {idleCount > 0 && workers.length > 0 && (
            <span className="badge badge-success badge-sm badge-outline">
              {idleCount} idle
            </span>
          )}
        </div>
        <button onClick={refetch} className="btn btn-ghost btn-sm" disabled={loading}>
          <span className={`iconify ph--arrows-clockwise size-4 ${loading ? 'animate-spin' : ''}`} />
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
            <WorkerItem
              key={worker.id}
              worker={worker}
              currentTaskId={workerTasks[worker.id] || null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkerItem({
  worker,
  currentTaskId,
}: {
  worker: Worker;
  currentTaskId: string | null;
}) {
  const isIdle = !currentTaskId;
  const lastSeen = new Date(worker.lastHeartbeat).toLocaleTimeString();

  return (
    <div className={`card bg-base-100 card-border transition-all ${!isIdle ? 'ring-2 ring-warning/50' : ''}`}>
      <div className="card-body p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`iconify ph--cpu size-5 ${isIdle ? 'text-primary' : 'text-warning'}`} />
            <span className="font-mono text-sm">{worker.id.slice(0, 20)}</span>
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

        {/* Current Task */}
        {currentTaskId && (
          <div className="mb-3 p-2 bg-warning/10 rounded-lg">
            <div className="text-xs text-warning uppercase tracking-wide mb-1">
              Current Task
            </div>
            <div className="font-mono text-xs text-base-content/80 truncate">
              {currentTaskId}
            </div>
          </div>
        )}

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

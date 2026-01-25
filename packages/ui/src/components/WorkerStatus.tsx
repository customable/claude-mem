/**
 * Worker Status
 *
 * Shows connected workers and their capabilities with real-time SSE updates.
 * Supports spawning and terminating workers from the UI.
 * Separates permanent (external) workers from spawned workers.
 * Enhanced to show abstract capabilities and provider info (Issue #224, #226).
 */

import { useEffect, useState, useMemo } from 'react';
import { api, type Worker, type SpawnStatus } from '../api/client';
import { useSSE } from '../hooks/useSSE';
import { SpawnWorkerModal } from './SpawnWorkerModal';

/**
 * Match task type to capability
 * Task types use dashes, capabilities use colons and different prefixes
 */
function matchTaskTypeToCapability(taskType: string, capability: string): boolean {
  // Direct prefix match for observation:*, summarize:*, embedding:*
  if (capability.startsWith(taskType + ':')) {
    return true;
  }

  // Special mappings for tasks with different naming
  const mappings: Record<string, string> = {
    'qdrant-sync': 'qdrant:sync',
    'context-generate': 'context:generate',
    'claude-md': 'claudemd:generate',
  };

  return mappings[taskType] === capability;
}

/**
 * Parse capability into abstract type and provider (Issue #226)
 */
function parseCapability(cap: string): { type: string; provider?: string } {
  // Legacy format: "observation:mistral" -> { type: "observation", provider: "mistral" }
  const colonIndex = cap.indexOf(':');
  if (colonIndex > 0) {
    return {
      type: cap.substring(0, colonIndex),
      provider: cap.substring(colonIndex + 1),
    };
  }
  // Abstract format: "observation" -> { type: "observation" }
  return { type: cap };
}

/**
 * Get capability color based on type
 */
function getCapabilityColor(type: string): string {
  const colors: Record<string, string> = {
    observation: 'badge-primary',
    summarize: 'badge-secondary',
    embedding: 'badge-accent',
    qdrant: 'badge-info',
    semantic: 'badge-info',
    context: 'badge-success',
    claudemd: 'badge-warning',
  };
  return colors[type] || 'badge-outline';
}

export function WorkerStatus() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spawnStatus, setSpawnStatus] = useState<SpawnStatus | null>(null);
  const [spawning, setSpawning] = useState(false);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [showSpawnModal, setShowSpawnModal] = useState(false);
  const { workerTasks, lastEvent } = useSSE();

  // Initial fetch
  useEffect(() => {
    Promise.all([
      api.getWorkers(),
      api.getSpawnStatus().catch(() => null),
    ])
      .then(([workersData, spawnData]) => {
        setWorkers(workersData.data || []);
        if (spawnData) setSpawnStatus(spawnData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Refetch on worker events
  useEffect(() => {
    if (
      lastEvent?.type === 'worker:connected' ||
      lastEvent?.type === 'worker:disconnected' ||
      lastEvent?.type === 'worker:spawned' ||
      lastEvent?.type === 'worker:exited'
    ) {
      Promise.all([
        api.getWorkers(),
        api.getSpawnStatus().catch(() => null),
      ])
        .then(([workersData, spawnData]) => {
          setWorkers(workersData.data || []);
          if (spawnData) setSpawnStatus(spawnData);
        })
        .catch(() => {
          // Ignore errors on refetch
        });
    }
  }, [lastEvent]);

  const refetch = () => {
    setLoading(true);
    Promise.all([
      api.getWorkers(),
      api.getSpawnStatus().catch(() => null),
    ])
      .then(([workersData, spawnData]) => {
        setWorkers(workersData.data || []);
        if (spawnData) setSpawnStatus(spawnData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  const handleSpawn = async (config?: { provider?: string }) => {
    setSpawning(true);
    setError(null);
    try {
      await api.spawnWorker(config);
      // Workers list will update via SSE
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSpawning(false);
    }
  };

  const handleTerminate = async (spawnedId: string) => {
    setTerminatingId(spawnedId);
    setError(null);
    try {
      const result = await api.terminateWorker(spawnedId);
      if (result.queued) {
        // Show info that termination is queued
        setError(`Termination queued: ${result.reason}`);
      }
      // Refetch to get updated pending termination status
      refetch();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTerminatingId(null);
    }
  };

  // Separate workers into permanent and spawned
  const permanentWorkers = workers.filter((w) => !w.metadata?.spawnedId);
  const spawnedWorkers = workers.filter((w) => !!w.metadata?.spawnedId);

  // Count busy workers
  const busyCount = workers.filter((w) => workerTasks[w.id]?.taskId).length;
  const idleCount = workers.length - busyCount;

  // Aggregate capability distribution (Issue #224, #226)
  // NOTE: useMemo must be called before any early returns (Rules of Hooks)
  const capabilityDistribution = useMemo(() => {
    const dist: Record<string, { count: number; providers: Set<string> }> = {};
    for (const worker of workers) {
      for (const cap of worker.capabilities) {
        const parsed = parseCapability(cap);
        if (!dist[parsed.type]) {
          dist[parsed.type] = { count: 0, providers: new Set() };
        }
        dist[parsed.type].count++;
        if (parsed.provider) {
          dist[parsed.type].providers.add(parsed.provider);
        }
      }
    }
    // Convert Sets to arrays for React compatibility
    const result: Record<string, { count: number; providers: string[] }> = {};
    for (const [type, data] of Object.entries(dist)) {
      result[type] = { count: data.count, providers: [...data.providers] };
    }
    return result;
  }, [workers]);

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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
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
          {spawnStatus && (
            <span className="badge badge-ghost badge-sm">
              {spawnStatus.spawnedCount}/{spawnStatus.maxWorkers} spawned
            </span>
          )}
          {/* Auto-Spawn Status (Issue #256) */}
          {spawnStatus?.autoSpawnEnabled !== undefined && (
            <div
              className={`badge badge-sm ${spawnStatus.autoSpawnEnabled ? 'badge-success' : 'badge-outline opacity-60'}`}
              title={
                spawnStatus.autoSpawnEnabled
                  ? `Auto-spawn: ${spawnStatus.autoSpawnCount ?? 2} worker(s) on startup${
                      spawnStatus.autoSpawnProviders?.length
                        ? ` (${spawnStatus.autoSpawnProviders.join(', ')})`
                        : ''
                    }`
                  : 'Auto-spawn disabled'
              }
            >
              <span className={`iconify ${spawnStatus.autoSpawnEnabled ? 'ph--lightning' : 'ph--lightning-slash'} size-3 mr-1`} />
              Auto-Spawn {spawnStatus.autoSpawnEnabled ? 'On' : 'Off'}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {spawnStatus?.available && spawnStatus.canSpawnMore && (
            <button
              onClick={() => setShowSpawnModal(true)}
              className="btn btn-primary btn-sm"
              disabled={spawning}
            >
              {spawning ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <span className="iconify ph--plus size-4" />
              )}
              Spawn Worker
            </button>
          )}
          {spawnStatus && !spawnStatus.available && (
            <div className="tooltip tooltip-left" data-tip={spawnStatus.reason || 'Spawning unavailable'}>
              <button className="btn btn-ghost btn-sm opacity-50" disabled>
                <span className="iconify ph--warning size-4" />
                Cannot Spawn
              </button>
            </div>
          )}
          {spawnStatus?.available && !spawnStatus.canSpawnMore && (
            <div className="tooltip tooltip-left" data-tip={`Max workers reached (${spawnStatus.maxWorkers})`}>
              <button className="btn btn-ghost btn-sm opacity-50" disabled>
                <span className="iconify ph--prohibit size-4" />
                Limit Reached
              </button>
            </div>
          )}
          <button onClick={refetch} className="btn btn-ghost btn-sm" disabled={loading}>
            <span className={`iconify ph--arrows-clockwise size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Capability Overview (Issue #224, #226) */}
      {workers.length > 0 && Object.keys(capabilityDistribution).length > 0 && (
        <div className="card bg-base-100 card-border">
          <div className="card-body p-3">
            <div className="text-xs text-base-content/60 uppercase tracking-wide mb-2">
              Available Capabilities
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(capabilityDistribution).map(([type, data]) => (
                <div
                  key={type}
                  className={`badge ${getCapabilityColor(type)} gap-1`}
                  title={data.providers.length > 0 ? `Providers: ${data.providers.join(', ')}` : undefined}
                >
                  <span className="font-medium">{type}</span>
                  <span className="badge badge-xs badge-neutral">{data.count}</span>
                  {data.providers.length > 0 && (
                    <span className="opacity-60 text-xs">({data.providers.join(', ')})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error/Info Alert */}
      {error && (
        <div className={`alert ${error.startsWith('Termination queued') ? 'alert-info' : 'alert-error'}`}>
          <span className={`iconify ${error.startsWith('Termination queued') ? 'ph--info' : 'ph--warning-circle'} size-5`} />
          <span>{error}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setError(null)}>
            <span className="iconify ph--x size-4" />
          </button>
        </div>
      )}

      {/* No Workers State */}
      {workers.length === 0 ? (
        <div className="card bg-base-100 card-border">
          <div className="card-body items-center justify-center py-12 text-base-content/60">
            <span className="iconify ph--plugs size-12 mb-2" />
            <span className="text-lg font-medium">No workers connected</span>
            <p className="text-sm mt-1">
              {spawnStatus?.available
                ? 'Click "Spawn Worker" to start a worker'
                : 'Start a worker to process tasks'}
            </p>
            {spawnStatus?.available && spawnStatus.canSpawnMore && (
              <button
                onClick={() => setShowSpawnModal(true)}
                className="btn btn-primary btn-sm mt-4"
                disabled={spawning}
              >
                {spawning ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <span className="iconify ph--plus size-4" />
                )}
                Spawn Worker
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Permanent Workers Section */}
          {permanentWorkers.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-base-content/70 mb-3 flex items-center gap-2">
                <span className="iconify ph--desktop-tower size-4" />
                Permanent Workers
                <span className="badge badge-ghost badge-xs">{permanentWorkers.length}</span>
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {permanentWorkers.map((worker) => {
                  const taskInfo = workerTasks[worker.id];
                  return (
                    <WorkerItem
                      key={worker.id}
                      worker={worker}
                      currentTaskId={taskInfo?.taskId || worker.currentTaskId || null}
                      currentTaskType={taskInfo?.taskType || worker.currentTaskType || null}
                      onTerminate={handleTerminate}
                      isTerminating={false}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Spawned Workers Section */}
          {spawnedWorkers.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-base-content/70 mb-3 flex items-center gap-2">
                <span className="iconify ph--rocket-launch size-4" />
                Spawned Workers
                <span className="badge badge-ghost badge-xs">{spawnedWorkers.length}</span>
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {spawnedWorkers.map((worker) => {
                  const taskInfo = workerTasks[worker.id];
                  return (
                    <WorkerItem
                      key={worker.id}
                      worker={worker}
                      currentTaskId={taskInfo?.taskId || worker.currentTaskId || null}
                      currentTaskType={taskInfo?.taskType || worker.currentTaskType || null}
                      onTerminate={handleTerminate}
                      isTerminating={terminatingId === worker.metadata?.spawnedId}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Spawn Worker Modal (Issue #254) */}
      <SpawnWorkerModal
        isOpen={showSpawnModal}
        onClose={() => setShowSpawnModal(false)}
        onSpawn={handleSpawn}
        spawnStatus={spawnStatus}
        isSpawning={spawning}
      />
    </div>
  );
}

function WorkerItem({
  worker,
  currentTaskId,
  currentTaskType,
  onTerminate,
  isTerminating,
}: {
  worker: Worker;
  currentTaskId: string | null;
  currentTaskType: string | null;
  onTerminate: (id: string) => void;
  isTerminating: boolean;
}) {
  const isIdle = !currentTaskId;
  const lastSeen = new Date(worker.lastHeartbeat).toLocaleTimeString();
  // Check if this is a spawned worker (has spawnedId in metadata)
  const spawnedId = worker.metadata?.spawnedId;
  const isSpawned = !!spawnedId;
  const isPendingTermination = worker.pendingTermination;

  return (
    <div className={`card bg-base-100 card-border transition-all ${
      isPendingTermination
        ? 'ring-2 ring-error/50 opacity-75'
        : !isIdle
          ? 'ring-2 ring-warning/50'
          : ''
    }`}>
      <div className="card-body p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`iconify ph--cpu size-5 ${
              isPendingTermination ? 'text-error' : isIdle ? 'text-primary' : 'text-warning'
            }`} />
            <span className="font-mono text-sm">{worker.id.slice(0, 20)}</span>
          </div>
          <div className="flex items-center gap-2">
            {isPendingTermination ? (
              <div className="badge badge-error badge-sm">
                <span className="iconify ph--clock size-3 mr-1" />
                Stopping...
              </div>
            ) : (
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
            )}
            {isSpawned && spawnedId && !isPendingTermination && (
              <button
                onClick={() => onTerminate(spawnedId)}
                className="btn btn-error btn-xs"
                disabled={isTerminating}
                title={isIdle ? 'Stop this worker' : 'Queue termination after task completes'}
              >
                {isTerminating ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <span className="iconify ph--stop size-3" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Current Task */}
        {currentTaskId && !isPendingTermination && (
          <div className="mb-3 p-2 bg-warning/10 rounded-lg">
            <div className="text-xs text-warning uppercase tracking-wide mb-1">
              Current Task
            </div>
            <div className="font-mono text-xs text-base-content/80 truncate">
              {currentTaskId}
            </div>
          </div>
        )}

        {/* Pending Termination Notice */}
        {isPendingTermination && currentTaskId && (
          <div className="mb-3 p-2 bg-error/10 rounded-lg">
            <div className="text-xs text-error uppercase tracking-wide mb-1">
              Finishing Task Before Shutdown
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
            {worker.capabilities.map((cap) => {
              // Match task type to capability
              // Task types: observation, summarize, embedding, qdrant-sync, context-generate, claude-md
              // Capabilities: observation:*, summarize:*, embedding:*, qdrant:sync, context:generate, claudemd:generate
              const isActive = currentTaskType ? matchTaskTypeToCapability(currentTaskType, cap) : false;
              const parsed = parseCapability(cap);
              const colorClass = getCapabilityColor(parsed.type);
              return (
                <span
                  key={cap}
                  className={`badge badge-sm ${
                    isActive
                      ? 'badge-warning'
                      : colorClass
                  }`}
                  title={isActive ? 'Currently executing' : parsed.provider ? `Provider: ${parsed.provider}` : undefined}
                >
                  {isActive && (
                    <span className="iconify ph--play size-3 mr-0.5" />
                  )}
                  <span className="font-medium">{parsed.type}</span>
                  {parsed.provider && (
                    <span className="opacity-60 ml-0.5">:{parsed.provider}</span>
                  )}
                </span>
              );
            })}
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

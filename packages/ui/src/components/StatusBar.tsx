/**
 * Status Bar
 *
 * Shows system health, worker status, and queue status via SSE.
 * Issue #275: Added queue status indicator
 */

import { useSSE } from '../hooks/useSSE';

export function StatusBar() {
  const { status, workerCount, queueStatus, reconnect } = useSSE();

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const isError = status === 'error' || status === 'disconnected';

  const statusColor = isConnected ? 'text-success' : isConnecting ? 'text-warning' : 'text-error';
  const badgeColor = isConnected ? 'badge-success' : isConnecting ? 'badge-warning' : 'badge-error';
  const statusText = isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected';

  // Queue status indicator (Issue #275)
  const hasQueueActivity = queueStatus.pending > 0 || queueStatus.processing > 0;
  const hasFailedTasks = queueStatus.failed > 0;

  return (
    <div className="flex items-center gap-3 text-sm">
      {/* Queue Status (Issue #275) */}
      {isConnected && (hasQueueActivity || hasFailedTasks) && (
        <div
          className="flex items-center gap-1.5 text-base-content/70"
          title={`Queue: ${queueStatus.pending} pending, ${queueStatus.processing} processing${queueStatus.failed > 0 ? `, ${queueStatus.failed} failed` : ''}`}
        >
          {queueStatus.pending > 0 && (
            <span className="badge badge-sm badge-ghost">
              <span className="iconify ph--queue size-3 mr-1" />
              {queueStatus.pending}
            </span>
          )}
          {queueStatus.processing > 0 && (
            <span className="badge badge-sm badge-info badge-outline">
              <span className="loading loading-spinner loading-xs mr-1" />
              {queueStatus.processing}
            </span>
          )}
          {queueStatus.failed > 0 && (
            <span className="badge badge-sm badge-error badge-outline">
              <span className="iconify ph--warning size-3 mr-1" />
              {queueStatus.failed}
            </span>
          )}
        </div>
      )}

      {/* Connection Status */}
      <button
        className={`flex items-center gap-1.5 ${statusColor} hover:opacity-80 transition-opacity`}
        onClick={reconnect}
        title={isError ? 'Click to reconnect' : 'Connection status'}
      >
        {isConnecting ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          <span className="iconify ph--circle-fill size-2" />
        )}
        <span>{statusText}</span>
      </button>

      {/* Worker Count */}
      <div className={`badge badge-sm ${badgeColor} badge-outline`}>
        <span className="iconify ph--cpu size-3 mr-1" />
        {workerCount} worker{workerCount !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

/**
 * Status Bar
 *
 * Shows system health and worker status via SSE.
 */

import { useSSE } from '../hooks/useSSE';

export function StatusBar() {
  const { status, workerCount, reconnect } = useSSE();

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const isError = status === 'error' || status === 'disconnected';

  const statusColor = isConnected ? 'text-success' : isConnecting ? 'text-warning' : 'text-error';
  const badgeColor = isConnected ? 'badge-success' : isConnecting ? 'badge-warning' : 'badge-error';
  const statusText = isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected';

  return (
    <div className="flex items-center gap-3 text-sm">
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
      <div className={`badge badge-sm ${badgeColor} badge-outline`}>
        <span className="iconify ph--cpu size-3 mr-1" />
        {workerCount} worker{workerCount !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

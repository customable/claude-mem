/**
 * Live View
 *
 * Real-time activity stream using Server-Sent Events.
 */

import { useState, useEffect, useRef } from 'react';

interface LiveEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

// Event metadata for display
const EVENT_CONFIG: Record<string, { icon: string; color: string; label: string; bgColor: string }> = {
  'connected': {
    icon: 'ph--wifi-high',
    color: 'text-info',
    bgColor: 'bg-info/10',
    label: 'Connected'
  },
  'session:started': {
    icon: 'ph--play-circle',
    color: 'text-success',
    bgColor: 'bg-success/10',
    label: 'Session Started'
  },
  'session:ended': {
    icon: 'ph--stop-circle',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    label: 'Session Ended'
  },
  'task:queued': {
    icon: 'ph--queue',
    color: 'text-secondary',
    bgColor: 'bg-secondary/10',
    label: 'Task Queued'
  },
  'task:assigned': {
    icon: 'ph--user-circle-check',
    color: 'text-info',
    bgColor: 'bg-info/10',
    label: 'Task Assigned'
  },
  'task:completed': {
    icon: 'ph--check-circle',
    color: 'text-success',
    bgColor: 'bg-success/10',
    label: 'Task Completed'
  },
  'task:failed': {
    icon: 'ph--x-circle',
    color: 'text-error',
    bgColor: 'bg-error/10',
    label: 'Task Failed'
  },
  'observation:created': {
    icon: 'ph--brain',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    label: 'Observation Created'
  },
  'worker:connected': {
    icon: 'ph--plug',
    color: 'text-success',
    bgColor: 'bg-success/10',
    label: 'Worker Connected'
  },
  'worker:disconnected': {
    icon: 'ph--plug-slash',
    color: 'text-error',
    bgColor: 'bg-error/10',
    label: 'Worker Disconnected'
  },
  'claudemd:ready': {
    icon: 'ph--file-text',
    color: 'text-accent',
    bgColor: 'bg-accent/10',
    label: 'CLAUDE.md Updated'
  },
};

const DEFAULT_CONFIG = {
  icon: 'ph--dot',
  color: 'text-base-content/60',
  bgColor: 'bg-base-200',
  label: 'Event'
};

export function LiveView() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const eventSourceRef = useRef<EventSource | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paused) return;

    const es = new EventSource('/api/stream/events');
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const event: LiveEvent = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          type: data.type || 'unknown',
          data: data.data || data,
          timestamp: data.timestamp || Date.now(),
        };
        setEvents((prev) => [event, ...prev].slice(0, 100));
      } catch (err) {
        console.error('SSE parse error:', err, e.data);
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [paused]);

  // Auto-scroll to top on new events
  useEffect(() => {
    if (listRef.current && !paused) {
      listRef.current.scrollTop = 0;
    }
  }, [events, paused]);

  const getConfig = (type: string) => EVENT_CONFIG[type] || DEFAULT_CONFIG;

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Render event details in a nice format
  const renderEventDetails = (event: LiveEvent) => {
    const { type, data } = event;

    switch (type) {
      case 'connected':
        return (
          <span className="text-xs text-base-content/60">
            Client ID: <code className="bg-base-200 px-1 rounded">{data.clientId as string}</code>
          </span>
        );

      case 'session:started':
        return (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="badge badge-sm badge-ghost">
              <span className="iconify ph--folder size-3 mr-1" />
              {data.project as string}
            </span>
            <span className="text-base-content/50 font-mono">
              {(data.sessionId as string)?.slice(0, 20)}...
            </span>
          </div>
        );

      case 'task:queued':
        return (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="badge badge-sm badge-primary badge-outline">
              {data.taskType as string}
            </span>
            <span className="text-base-content/50 font-mono">
              {(data.taskId as string)?.slice(0, 8)}...
            </span>
          </div>
        );

      case 'task:assigned':
        return (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="badge badge-sm badge-primary badge-outline">
              {data.taskType as string}
            </span>
            <span className="badge badge-sm badge-info badge-outline">
              <span className="iconify ph--robot size-3 mr-1" />
              {(data.workerId as string)?.replace('worker-', 'W')}
            </span>
            <span className="text-base-content/50 font-mono">
              {(data.taskId as string)?.slice(0, 8)}...
            </span>
          </div>
        );

      case 'task:completed':
        return (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-success">✓</span>
            <span className="text-base-content/50 font-mono">
              {(data.taskId as string)?.slice(0, 8)}...
            </span>
          </div>
        );

      case 'task:failed':
        return (
          <div className="flex flex-col gap-1 text-xs">
            <span className="text-base-content/50 font-mono">
              {(data.taskId as string)?.slice(0, 8)}...
            </span>
            {'error' in data && data.error != null && (
              <span className="text-error">{String(data.error)}</span>
            )}
          </div>
        );

      case 'worker:connected':
        return (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="badge badge-sm badge-success badge-outline">
              <span className="iconify ph--robot size-3 mr-1" />
              {data.workerId as string}
            </span>
            {Array.isArray(data.capabilities) && (
              <span className="text-base-content/50">
                {(data.capabilities as string[]).length} capabilities
              </span>
            )}
          </div>
        );

      case 'observation:created':
        return (
          <div className="flex items-center gap-2 text-xs">
            <span className="badge badge-sm badge-primary">
              #{data.observationId as number}
            </span>
          </div>
        );

      case 'claudemd:ready':
        return (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="badge badge-sm badge-ghost">
              <span className="iconify ph--folder size-3 mr-1" />
              {data.project as string}
            </span>
            <span className="text-base-content/50 truncate max-w-xs">
              {data.workingDirectory as string}
            </span>
          </div>
        );

      default:
        return (
          <pre className="text-xs text-base-content/50 whitespace-pre-wrap break-all max-h-20 overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        );
    }
  };

  const filteredEvents = filter === 'all'
    ? events
    : events.filter(e => e.type.startsWith(filter));

  const eventTypes = ['all', 'session', 'task', 'worker', 'observation'];

  // Count events by type for filter badges (Issue #279)
  const eventCounts = eventTypes.reduce((acc, type) => {
    if (type === 'all') {
      acc[type] = events.length;
    } else {
      acc[type] = events.filter(e => e.type.startsWith(type)).length;
    }
    return acc;
  }, {} as Record<string, number>);

  // Export events as JSON (Issue #279)
  const handleExport = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      filter,
      eventCount: filteredEvents.length,
      events: filteredEvents.map(e => ({
        type: e.type,
        timestamp: new Date(e.timestamp).toISOString(),
        data: e.data,
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claude-mem-events-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Clear events with confirmation (Issue #279)
  const handleClear = () => {
    if (events.length === 0) return;
    if (confirm(`Clear all ${events.length} events?`)) {
      setEvents([]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Live Activity</h2>
          <div className={`badge ${connected ? 'badge-success' : 'badge-error'} badge-sm gap-1`}>
            <span className={`iconify ${connected ? 'ph--wifi-high' : 'ph--wifi-slash'} size-3`} />
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter with count badges (Issue #279) */}
          <div className="join">
            {eventTypes.map((t) => (
              <button
                key={t}
                className={`join-item btn btn-xs gap-1 ${
                  filter === t
                    ? 'btn-primary'
                    : eventCounts[t] > 0
                    ? 'btn-outline btn-primary'
                    : 'btn-ghost'
                }`}
                onClick={() => setFilter(t)}
              >
                {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                {eventCounts[t] > 0 && (
                  <span className={`badge badge-xs ${filter === t ? 'badge-ghost' : 'badge-primary'}`}>
                    {eventCounts[t]}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="divider divider-horizontal mx-0" />
          <button
            className={`btn btn-sm ${paused ? 'btn-warning' : 'btn-ghost'}`}
            onClick={() => setPaused(!paused)}
            title={paused ? 'Resume' : 'Pause'}
          >
            <span className={`iconify ${paused ? 'ph--play' : 'ph--pause'} size-4`} />
          </button>
          {/* Export button (Issue #279) */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleExport}
            title="Export events as JSON"
            disabled={events.length === 0}
          >
            <span className="iconify ph--download size-4" />
          </button>
          {/* Clear button with confirmation (Issue #279) */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleClear}
            title="Clear all events"
            disabled={events.length === 0}
          >
            <span className="iconify ph--trash size-4" />
          </button>
        </div>
      </div>

      {/* Event Stream */}
      <div
        ref={listRef}
        className="card bg-base-100 card-border max-h-[70vh] overflow-y-auto"
      >
        {filteredEvents.length === 0 ? (
          <div className="card-body items-center justify-center py-12 text-base-content/60">
            <span className="iconify ph--broadcast size-12 mb-2 animate-pulse" />
            <span>Waiting for events...</span>
            <span className="text-xs">Activity will appear here in real-time</span>
          </div>
        ) : (
          <div className="divide-y divide-base-300/50">
            {filteredEvents.map((event) => {
              const config = getConfig(event.type);
              return (
                <div
                  key={event.id}
                  className={`p-3 hover:bg-base-200/30 transition-all ${config.bgColor} border-l-2 border-l-transparent hover:border-l-current ${config.color}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center shrink-0`}>
                      <span className={`iconify ${config.icon} size-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`font-medium text-sm ${config.color}`}>
                          {config.label}
                        </span>
                        {/* Timestamp with tooltip for exact time (Issue #279) */}
                        <span
                          className="text-xs text-base-content/40 tabular-nums cursor-help"
                          title={new Date(event.timestamp).toLocaleString()}
                        >
                          {formatTime(event.timestamp)}
                        </span>
                      </div>
                      {renderEventDetails(event)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-base-content/50">
        <span>
          {filteredEvents.length} {filter !== 'all' && `${filter} `}events
          {filter !== 'all' && ` (${events.length} total)`}
        </span>
        {paused && (
          <span className="badge badge-warning badge-sm gap-1">
            <span className="iconify ph--pause size-3" />
            Paused
          </span>
        )}
      </div>
    </div>
  );
}

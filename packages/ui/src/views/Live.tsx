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

export function LiveView() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
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
          id: crypto.randomUUID(),
          type: data.type || 'unknown',
          data,
          timestamp: Date.now(),
        };
        setEvents((prev) => [event, ...prev].slice(0, 100)); // Keep last 100
      } catch {
        // Ignore parse errors
      }
    };

    // Listen to specific event types
    const eventTypes = [
      'observation:created',
      'session:started',
      'session:ended',
      'worker:connected',
      'worker:disconnected',
      'task:assigned',
      'task:completed',
    ];

    eventTypes.forEach((type) => {
      es.addEventListener(type, (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          const event: LiveEvent = {
            id: crypto.randomUUID(),
            type,
            data,
            timestamp: Date.now(),
          };
          setEvents((prev) => [event, ...prev].slice(0, 100));
        } catch {
          // Ignore
        }
      });
    });

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

  const getEventIcon = (type: string): string => {
    if (type.includes('observation')) return 'ph--brain';
    if (type.includes('session:started')) return 'ph--play';
    if (type.includes('session:ended')) return 'ph--stop';
    if (type.includes('worker:connected')) return 'ph--plug';
    if (type.includes('worker:disconnected')) return 'ph--plug-slash';
    if (type.includes('task')) return 'ph--lightning';
    return 'ph--dot';
  };

  const getEventColor = (type: string): string => {
    if (type.includes('observation')) return 'text-primary';
    if (type.includes('session:started')) return 'text-success';
    if (type.includes('session:ended')) return 'text-warning';
    if (type.includes('worker:connected')) return 'text-info';
    if (type.includes('worker:disconnected')) return 'text-error';
    if (type.includes('task:completed')) return 'text-success';
    if (type.includes('task')) return 'text-secondary';
    return 'text-base-content/60';
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Live Activity</h2>
          <div className={`badge ${connected ? 'badge-success' : 'badge-error'} badge-sm gap-1`}>
            <span className={`iconify ${connected ? 'ph--wifi-high' : 'ph--wifi-slash'} size-3`} />
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`btn btn-sm ${paused ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setPaused(!paused)}
          >
            <span className={`iconify ${paused ? 'ph--play' : 'ph--pause'} size-4`} />
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setEvents([])}
          >
            <span className="iconify ph--trash size-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Event Stream */}
      <div
        ref={listRef}
        className="card bg-base-100 card-border max-h-[70vh] overflow-y-auto"
      >
        {events.length === 0 ? (
          <div className="card-body items-center justify-center py-12 text-base-content/60">
            <span className="iconify ph--broadcast size-12 mb-2" />
            <span>Waiting for events...</span>
            <span className="text-xs">Activity will appear here in real-time</span>
          </div>
        ) : (
          <div className="divide-y divide-base-300">
            {events.map((event) => (
              <div key={event.id} className="p-3 hover:bg-base-200/50 transition-colors">
                <div className="flex items-start gap-3">
                  <span className={`iconify ${getEventIcon(event.type)} size-5 ${getEventColor(event.type)} mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{event.type}</span>
                      <span className="text-xs text-base-content/50">{formatTime(event.timestamp)}</span>
                    </div>
                    <pre className="text-xs text-base-content/70 mt-1 whitespace-pre-wrap break-all">
                      {JSON.stringify(event.data, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-base-content/50 text-center">
        Showing last {events.length} events (max 100)
      </div>
    </div>
  );
}

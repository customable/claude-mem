/**
 * WebSocket Hook
 *
 * Connects to the backend WebSocket server for real-time bidirectional communication.
 * Supports channel-based subscriptions (e.g., 'session:*', 'task:*').
 *
 * Part of Issue #264: Unified WebSocket System
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * WebSocket message types
 */
export type WSMessageType =
  // Auth
  | 'auth'
  | 'auth:success'
  | 'auth:failed'
  // Subscriptions
  | 'subscribe'
  | 'unsubscribe'
  | 'subscribed'
  // Events
  | 'event'
  // Heartbeat
  | 'ping'
  | 'pong';

/**
 * WebSocket event types (from channels)
 */
export type WSEventType =
  | 'session:started'
  | 'session:ended'
  | 'session:pre-compact'
  | 'task:queued'
  | 'task:assigned'
  | 'task:completed'
  | 'task:failed'
  | 'task:progress'
  | 'worker:connected'
  | 'worker:disconnected'
  | 'worker:spawned'
  | 'worker:exited'
  | 'observation:created'
  | 'observation:queued'
  | 'summary:created'
  | 'claudemd:ready'
  | 'prompt:new'
  | 'subagent:start'
  | 'subagent:stop';

/**
 * WebSocket message structure
 */
export interface WSMessage {
  type: WSMessageType;
  channel?: string;
  channels?: string[];
  data?: unknown;
  timestamp?: number;
  clientId?: string;
  permissions?: string[];
  reason?: string;
}

/**
 * WebSocket event (from 'event' message type)
 */
export interface WSEvent {
  channel: string;
  data: unknown;
  timestamp: number;
}

/**
 * Connection status
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * WebSocket hook options
 */
export interface UseWebSocketOptions {
  /** Channels to subscribe to (e.g., ['session:*', 'task:*']) */
  channels?: string[];
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Maximum reconnect attempts (default: 10) */
  maxReconnectAttempts?: number;
  /** Initial reconnect delay in ms (default: 1000) */
  reconnectDelay?: number;
  /** Reconnect backoff multiplier (default: 1.5) */
  reconnectBackoff?: number;
}

/**
 * WebSocket hook return type
 */
export interface UseWebSocketReturn {
  /** Current connection status */
  status: ConnectionStatus;
  /** Client ID assigned by server */
  clientId: string | null;
  /** Last received event */
  lastEvent: WSEvent | null;
  /** All events since connection (limited to last 100) */
  events: WSEvent[];
  /** Manually reconnect */
  reconnect: () => void;
  /** Subscribe to additional channels */
  subscribe: (channels: string[]) => void;
  /** Unsubscribe from channels */
  unsubscribe: (channels: string[]) => void;
  /** Current subscriptions */
  subscriptions: string[];
}

// Global state for WebSocket connection sharing
let globalSocket: WebSocket | null = null;
let globalStatus: ConnectionStatus = 'disconnected';
let globalClientId: string | null = null;
let globalSubscriptions: Set<string> = new Set();
let globalEvents: WSEvent[] = [];
let globalListeners: Set<(event: WSEvent | null, status: ConnectionStatus) => void> = new Set();
let reconnectAttempts = 0;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

const MAX_EVENTS = 100;
const DEFAULT_OPTIONS: Required<UseWebSocketOptions> = {
  channels: [],
  autoReconnect: true,
  maxReconnectAttempts: 10,
  reconnectDelay: 1000,
  reconnectBackoff: 1.5,
};

function notifyListeners(event: WSEvent | null, status: ConnectionStatus) {
  globalStatus = status;
  for (const listener of globalListeners) {
    listener(event, status);
  }
}

function addEvent(event: WSEvent) {
  globalEvents.push(event);
  if (globalEvents.length > MAX_EVENTS) {
    globalEvents = globalEvents.slice(-MAX_EVENTS);
  }
}

function getWebSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

function connectGlobal(options: Required<UseWebSocketOptions>) {
  if (globalSocket && globalSocket.readyState === WebSocket.OPEN) {
    return;
  }

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  globalStatus = 'connecting';
  notifyListeners(null, 'connecting');

  try {
    const socket = new WebSocket(getWebSocketUrl());
    globalSocket = socket;

    socket.onopen = () => {
      reconnectAttempts = 0;

      // Send auth message
      socket.send(JSON.stringify({ type: 'auth' }));
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WSMessage;

        switch (message.type) {
          case 'auth:success':
            globalClientId = message.clientId || null;
            globalStatus = 'connected';
            notifyListeners(null, 'connected');

            // Subscribe to requested channels
            if (globalSubscriptions.size > 0) {
              socket.send(JSON.stringify({
                type: 'subscribe',
                channels: Array.from(globalSubscriptions),
              }));
            }
            break;

          case 'auth:failed':
            console.error('WebSocket auth failed:', message.reason);
            globalStatus = 'error';
            notifyListeners(null, 'error');
            break;

          case 'subscribed':
            // Confirmation of subscription
            if (message.channels) {
              for (const channel of message.channels) {
                globalSubscriptions.add(channel);
              }
            }
            break;

          case 'event':
            if (message.channel && message.data !== undefined) {
              const wsEvent: WSEvent = {
                channel: message.channel,
                data: message.data,
                timestamp: message.timestamp || Date.now(),
              };
              addEvent(wsEvent);
              notifyListeners(wsEvent, globalStatus);
            }
            break;

          case 'ping':
            socket.send(JSON.stringify({ type: 'pong' }));
            break;
        }
      } catch {
        // Ignore parse errors
      }
    };

    socket.onerror = () => {
      globalStatus = 'error';
      notifyListeners(null, 'error');
    };

    socket.onclose = () => {
      globalSocket = null;
      globalClientId = null;
      globalStatus = 'disconnected';
      notifyListeners(null, 'disconnected');

      // Auto-reconnect with backoff
      if (options.autoReconnect && reconnectAttempts < options.maxReconnectAttempts && globalListeners.size > 0) {
        const delay = options.reconnectDelay * Math.pow(options.reconnectBackoff, reconnectAttempts);
        reconnectAttempts++;

        reconnectTimeout = setTimeout(() => {
          connectGlobal(options);
        }, delay);
      }
    };
  } catch (error) {
    console.error('WebSocket connection error:', error);
    globalStatus = 'error';
    notifyListeners(null, 'error');
  }
}

function subscribeToChannels(channels: string[]) {
  for (const channel of channels) {
    globalSubscriptions.add(channel);
  }

  if (globalSocket && globalSocket.readyState === WebSocket.OPEN) {
    globalSocket.send(JSON.stringify({
      type: 'subscribe',
      channels,
    }));
  }
}

function unsubscribeFromChannels(channels: string[]) {
  for (const channel of channels) {
    globalSubscriptions.delete(channel);
  }

  if (globalSocket && globalSocket.readyState === WebSocket.OPEN) {
    globalSocket.send(JSON.stringify({
      type: 'unsubscribe',
      channels,
    }));
  }
}

/**
 * Hook to connect to WebSocket server with channel subscriptions
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const optionsRef = useRef(mergedOptions);
  optionsRef.current = mergedOptions;

  const [status, setStatus] = useState<ConnectionStatus>(globalStatus);
  const [clientId, setClientId] = useState<string | null>(globalClientId);
  const [lastEvent, setLastEvent] = useState<WSEvent | null>(null);
  const [events, setEvents] = useState<WSEvent[]>([...globalEvents]);
  const [subscriptions, setSubscriptions] = useState<string[]>(Array.from(globalSubscriptions));

  useEffect(() => {
    // Add initial channels to global subscriptions
    for (const channel of mergedOptions.channels) {
      globalSubscriptions.add(channel);
    }

    const listener = (event: WSEvent | null, newStatus: ConnectionStatus) => {
      setStatus(newStatus);
      setClientId(globalClientId);
      setSubscriptions(Array.from(globalSubscriptions));

      if (event) {
        setLastEvent(event);
        setEvents([...globalEvents]);
      }
    };

    globalListeners.add(listener);

    // Connect if not already connected
    if (!globalSocket || globalSocket.readyState !== WebSocket.OPEN) {
      connectGlobal(optionsRef.current);
    } else {
      // Already connected, subscribe to new channels
      const newChannels = mergedOptions.channels.filter(c => !globalSubscriptions.has(c));
      if (newChannels.length > 0) {
        subscribeToChannels(newChannels);
      }

      // Sync state
      setStatus(globalStatus);
      setClientId(globalClientId);
      setEvents([...globalEvents]);
      setSubscriptions(Array.from(globalSubscriptions));
    }

    return () => {
      globalListeners.delete(listener);
      // Don't close connection - keep it for other components
    };
  }, []);

  const reconnect = useCallback(() => {
    reconnectAttempts = 0;
    if (globalSocket) {
      globalSocket.close();
    }
    connectGlobal(optionsRef.current);
  }, []);

  const subscribe = useCallback((channels: string[]) => {
    subscribeToChannels(channels);
    setSubscriptions(Array.from(globalSubscriptions));
  }, []);

  const unsubscribe = useCallback((channels: string[]) => {
    unsubscribeFromChannels(channels);
    setSubscriptions(Array.from(globalSubscriptions));
  }, []);

  return {
    status,
    clientId,
    lastEvent,
    events,
    reconnect,
    subscribe,
    unsubscribe,
    subscriptions,
  };
}

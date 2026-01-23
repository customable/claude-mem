/**
 * SSE Hook
 *
 * Connects to the backend SSE stream for real-time updates.
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * SSE Event types (mirrored from backend)
 */
export type SSEEventType =
  | 'connected'
  | 'processing:status'
  | 'prompt:new'
  | 'session:started'
  | 'session:ended'
  | 'observation:created'
  | 'observation:queued'
  | 'summary:created'
  | 'worker:connected'
  | 'worker:disconnected'
  | 'worker:spawned'
  | 'worker:exited'
  | 'task:queued'
  | 'task:assigned'
  | 'task:completed'
  | 'task:failed';

/**
 * SSE Event payload
 */
export interface SSEEvent {
  type: SSEEventType;
  data?: unknown;
  timestamp?: number;
}

/**
 * Connection status
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Worker task info
 */
export interface WorkerTaskInfo {
  taskId: string;
  taskType: string | null;
}

/**
 * Worker task state
 */
export interface WorkerTaskState {
  [workerId: string]: WorkerTaskInfo | null; // task info or null if idle
}

/**
 * SSE State
 */
export interface SSEState {
  status: ConnectionStatus;
  workerCount: number;
  workerTasks: WorkerTaskState;
  lastEvent: SSEEvent | null;
}

/**
 * SSE Hook return type
 */
export interface UseSSEReturn extends SSEState {
  reconnect: () => void;
}

// Global SSE state to share across components
let globalEventSource: EventSource | null = null;
let globalListeners: Set<(event: SSEEvent) => void> = new Set();
let globalStatus: ConnectionStatus = 'disconnected';
let globalWorkerCount = 0;
let globalWorkerTasks: WorkerTaskState = {};

function notifyListeners(event: SSEEvent) {
  for (const listener of globalListeners) {
    listener(event);
  }
}

function connectGlobal() {
  if (globalEventSource) {
    globalEventSource.close();
  }

  globalStatus = 'connecting';
  const eventSource = new EventSource('/api/stream');
  globalEventSource = eventSource;

  eventSource.onopen = () => {
    globalStatus = 'connected';
    notifyListeners({ type: 'connected' });
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as SSEEvent;

      // Handle specific events
      switch (data.type) {
        case 'connected':
          globalStatus = 'connected';
          break;
        case 'worker:connected':
          globalWorkerCount++;
          if (data.data && typeof data.data === 'object' && 'workerId' in data.data) {
            const workerId = (data.data as { workerId: string }).workerId;
            globalWorkerTasks[workerId] = null; // No task initially
          }
          break;
        case 'worker:disconnected':
          globalWorkerCount = Math.max(0, globalWorkerCount - 1);
          if (data.data && typeof data.data === 'object' && 'workerId' in data.data) {
            const workerId = (data.data as { workerId: string }).workerId;
            delete globalWorkerTasks[workerId];
          }
          break;
        case 'processing:status':
          if (data.data && typeof data.data === 'object' && 'connectedWorkers' in data.data) {
            globalWorkerCount = (data.data as { connectedWorkers: number }).connectedWorkers;
          }
          break;
        case 'task:assigned':
          if (data.data && typeof data.data === 'object') {
            const { workerId, taskId, taskType } = data.data as { workerId: string; taskId: string; taskType?: string };
            if (workerId) {
              globalWorkerTasks[workerId] = { taskId, taskType: taskType || null };
            }
          }
          break;
        case 'task:completed':
        case 'task:failed':
          if (data.data && typeof data.data === 'object' && 'taskId' in data.data) {
            const taskId = (data.data as { taskId: string }).taskId;
            // Find worker with this task and clear it
            for (const [wId, taskInfo] of Object.entries(globalWorkerTasks)) {
              if (taskInfo?.taskId === taskId) {
                globalWorkerTasks[wId] = null;
                break;
              }
            }
          }
          break;
      }

      notifyListeners(data);
    } catch {
      // Ignore parse errors
    }
  };

  eventSource.onerror = () => {
    globalStatus = 'error';
    eventSource.close();
    notifyListeners({ type: 'connected' }); // Notify to update status

    // Reconnect after 3 seconds
    setTimeout(() => {
      if (globalListeners.size > 0) {
        connectGlobal();
      }
    }, 3000);
  };
}

/**
 * Hook to connect to SSE stream
 */
export function useSSE(): UseSSEReturn {
  const [status, setStatus] = useState<ConnectionStatus>(globalStatus);
  const [workerCount, setWorkerCount] = useState(globalWorkerCount);
  const [workerTasks, setWorkerTasks] = useState<WorkerTaskState>({ ...globalWorkerTasks });
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);

  useEffect(() => {
    // Update local state from global
    const listener = (event: SSEEvent) => {
      setStatus(globalStatus);
      setWorkerCount(globalWorkerCount);
      setWorkerTasks({ ...globalWorkerTasks });
      setLastEvent(event);
    };

    globalListeners.add(listener);

    // Connect if not already connected
    if (!globalEventSource || globalEventSource.readyState === EventSource.CLOSED) {
      connectGlobal();

      // Fetch initial worker count and task states
      fetch('/api/workers')
        .then((res) => res.json())
        .then((data) => {
          if (data.data) {
            globalWorkerCount = data.data.length;
            globalWorkerTasks = {};
            for (const worker of data.data) {
              globalWorkerTasks[worker.id] = worker.currentTaskId
                ? { taskId: worker.currentTaskId, taskType: worker.currentTaskType || null }
                : null;
            }
            setWorkerCount(globalWorkerCount);
            setWorkerTasks({ ...globalWorkerTasks });
          }
        })
        .catch(() => {
          // Ignore errors
        });
    } else {
      // Sync with current global state
      setStatus(globalStatus);
      setWorkerCount(globalWorkerCount);
      setWorkerTasks({ ...globalWorkerTasks });
    }

    return () => {
      globalListeners.delete(listener);
      // Don't close the connection - keep it for other components
    };
  }, []);

  const reconnect = useCallback(() => {
    connectGlobal();
  }, []);

  return {
    status,
    workerCount,
    workerTasks,
    lastEvent,
    reconnect,
  };
}

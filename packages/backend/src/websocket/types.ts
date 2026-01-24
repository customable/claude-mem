/**
 * WebSocket Types
 *
 * Internal types for WebSocket connection management.
 */

import type { WebSocket } from 'ws';
import type { WorkerCapability } from '@claude-mem/types';

/**
 * Connected worker information
 */
export interface ConnectedWorker {
  id: string;
  socket: WebSocket;
  capabilities: WorkerCapability[];
  connectedAt: number;
  lastHeartbeat: number;
  currentTaskId: string | null;
  currentTaskType: string | null; // The capability/task type being executed
  pendingTermination?: boolean; // True if queued for termination after task completes
  metadata?: Record<string, unknown>;
  // Latency tracking
  lastPingTime?: number;
  latencyHistory: number[];
}

/**
 * Worker connection stats
 */
export interface WorkerStats {
  totalConnected: number;
  byCapability: Record<WorkerCapability, number>;
  averageLatency: number;
}

/**
 * Task assignment result
 */
export interface TaskAssignment {
  workerId: string;
  taskId: string;
  assignedAt: number;
}

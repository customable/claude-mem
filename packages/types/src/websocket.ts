/**
 * WebSocket Protocol Types
 *
 * Defines the message types exchanged between Backend and Workers
 * over the WebSocket connection.
 */

import type { WorkerCapability, WorkerRegistration } from './capabilities.js';
import type { Task } from './tasks.js';

// ============================================
// Worker -> Backend Messages
// ============================================

/**
 * Authentication message (first message from worker)
 */
export interface AuthMessage {
  type: 'auth';
  token: string;
}

/**
 * Registration message (after successful auth)
 */
export interface RegisterMessage {
  type: 'register';
  capabilities: WorkerCapability[];
  metadata?: Record<string, unknown>;
}

/**
 * Heartbeat from worker
 */
export interface HeartbeatMessage {
  type: 'heartbeat';
  workerId: string;
  currentTasks: string[];  // Task IDs being processed
}

/**
 * Task completion notification
 */
export interface TaskCompleteMessage {
  type: 'task:complete';
  taskId: string;
  workerId: string;
  result: unknown;  // Task-specific result
  processingTimeMs: number;
}

/**
 * Task error notification
 */
export interface TaskErrorMessage {
  type: 'task:error';
  taskId: string;
  workerId: string;
  error: string;
  stack?: string;
  retryable: boolean;
}

/**
 * Task progress update (for long-running tasks)
 */
export interface TaskProgressMessage {
  type: 'task:progress';
  taskId: string;
  workerId: string;
  progress: number;  // 0-100
  message?: string;
}

/**
 * Worker is shutting down gracefully
 */
export interface WorkerShutdownMessage {
  type: 'shutdown';
  workerId: string;
  reason?: string;
}

/**
 * All messages from Worker to Backend
 */
export type WorkerToBackendMessage =
  | AuthMessage
  | RegisterMessage
  | HeartbeatMessage
  | TaskCompleteMessage
  | TaskErrorMessage
  | TaskProgressMessage
  | WorkerShutdownMessage;

// ============================================
// Backend -> Worker Messages
// ============================================

/**
 * Authentication result
 */
export interface AuthResultMessage {
  type: 'auth:result';
  success: boolean;
  workerId?: string;
  error?: string;
}

/**
 * Heartbeat acknowledgment
 */
export interface HeartbeatAckMessage {
  type: 'heartbeat:ack';
  serverTime: number;
}

/**
 * Task assignment
 */
export interface TaskAssignMessage {
  type: 'task:assign';
  task: Task;
  capability: WorkerCapability;  // The capability to use
}

/**
 * Task cancellation
 */
export interface TaskCancelMessage {
  type: 'task:cancel';
  taskId: string;
  reason?: string;
}

/**
 * Server is shutting down
 */
export interface ServerShutdownMessage {
  type: 'server:shutdown';
  reason?: string;
  gracePeriodMs: number;
}

/**
 * Configuration update
 */
export interface ConfigUpdateMessage {
  type: 'config:update';
  config: Record<string, unknown>;
}

/**
 * All messages from Backend to Worker
 */
export type BackendToWorkerMessage =
  | AuthResultMessage
  | HeartbeatAckMessage
  | TaskAssignMessage
  | TaskCancelMessage
  | ServerShutdownMessage
  | ConfigUpdateMessage;

// ============================================
// Connection State
// ============================================

/**
 * WebSocket connection state
 */
export type ConnectionState =
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

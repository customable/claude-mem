/**
 * Task definitions for the Backend-Worker system
 *
 * Tasks are created by the backend and assigned to workers
 * based on their capabilities.
 */

import type { WorkerCapability } from './capabilities.js';
import type { ObservationType } from './database.js';

/**
 * Task status in the queue
 */
export type TaskStatus =
  | 'pending'      // Waiting for worker
  | 'assigned'     // Assigned to worker
  | 'processing'   // Worker is processing
  | 'completed'    // Successfully completed
  | 'failed'       // Failed with error
  | 'timeout';     // Timed out

/**
 * Task types
 */
export type TaskType =
  | 'observation'
  | 'summarize'
  | 'embedding'
  | 'chroma-sync'
  | 'context-generate';

/**
 * Base task interface
 */
export interface BaseTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  requiredCapability: WorkerCapability;
  fallbackCapabilities?: WorkerCapability[];
  priority: number;  // Higher = more urgent
  createdAt: number;
  assignedAt?: number;
  completedAt?: number;
  assignedWorkerId?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

/**
 * Observation task payload
 */
export interface ObservationTaskPayload {
  sessionId: string;
  project: string;
  toolName: string;
  toolInput: string;
  toolOutput: string;
  promptNumber?: number;
}

/**
 * Observation task
 */
export interface ObservationTask extends BaseTask {
  type: 'observation';
  payload: ObservationTaskPayload;
  result?: {
    observationId: number;
    title: string;
    text: string;
    type: ObservationType;
    tokens: number;
  };
}

/**
 * Summarize task payload
 */
export interface SummarizeTaskPayload {
  sessionId: string;
  project: string;
  promptNumber?: number;
}

/**
 * Summarize task
 */
export interface SummarizeTask extends BaseTask {
  type: 'summarize';
  payload: SummarizeTaskPayload;
  result?: {
    summaryId: number;
    request: string;
    investigated: string;
    learned: string;
    completed: string;
    nextSteps: string;
    tokens: number;
  };
}

/**
 * Embedding task payload
 */
export interface EmbeddingTaskPayload {
  texts: string[];
  ids: string[];
  metadata?: Record<string, unknown>[];
}

/**
 * Embedding task
 */
export interface EmbeddingTask extends BaseTask {
  type: 'embedding';
  payload: EmbeddingTaskPayload;
  result?: {
    embeddings: number[][];
    model: string;
    tokens: number;
  };
}

/**
 * Context generation task payload
 */
export interface ContextGenerateTaskPayload {
  project: string;
  limit?: number;
  includeTypes?: string[];
}

/**
 * Context generation task
 */
export interface ContextGenerateTask extends BaseTask {
  type: 'context-generate';
  payload: ContextGenerateTaskPayload;
  result?: {
    context: string;
    observationCount: number;
    tokens: number;
  };
}

/**
 * Union of all task types
 */
export type Task =
  | ObservationTask
  | SummarizeTask
  | EmbeddingTask
  | ContextGenerateTask;

/**
 * Task creation input (without system fields)
 */
export type CreateTaskInput<T extends Task> = Omit<T,
  | 'id'
  | 'status'
  | 'createdAt'
  | 'assignedAt'
  | 'completedAt'
  | 'assignedWorkerId'
  | 'error'
  | 'retryCount'
>;

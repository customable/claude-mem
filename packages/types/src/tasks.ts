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
  | 'qdrant-sync'
  | 'semantic-search'
  | 'context-generate'
  | 'claude-md'
  | 'compression'; // Endless Mode (Issue #109)

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
  /** Unix timestamp (ms) for when the task can be retried (Issue #206) */
  retryAfter?: number;
  /** Hash of type+payload for deduplication (Issue #207) */
  deduplicationKey?: string;
}

/**
 * Extra fields for task status updates (Issue #206)
 */
export interface TaskUpdateExtras {
  /** Task result (type-specific) */
  result?: unknown;
  /** Error message */
  error?: string;
  /** Updated retry count */
  retryCount?: number;
  /** Unix timestamp (ms) for when the task can be retried */
  retryAfter?: number;
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
  gitBranch?: string;
  cwd?: string;
  /** Target directory from file path (for subdirectory CLAUDE.md) */
  targetDirectory?: string;
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
    // Optional extracted fields
    subtitle?: string;
    narrative?: string;
    facts?: string[];
    concepts?: string[];
    filesRead?: string[];
    filesModified?: string[];
  };
}

/**
 * Observation summary for task payloads
 */
export interface ObservationSummary {
  id: number;
  type: string;
  title: string;
  text: string;
}

/**
 * Summarize task payload
 */
export interface SummarizeTaskPayload {
  sessionId: string;
  project: string;
  promptNumber?: number;
  /** Observations from this session to summarize */
  observations?: ObservationSummary[];
  /** User prompt that started the session */
  userPrompt?: string;
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
  // Direct text embedding
  texts?: string[];
  ids?: string[];
  metadata?: Record<string, unknown>[];
  // Or embed observations by ID
  observationIds?: number[];
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
  query?: string;
  limit?: number;
  includeTypes?: string[];
  /** Pre-loaded observations for context generation */
  observations?: Array<{
    title: string;
    text: string;
    type: string;
    createdAt: number;
  }>;
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
 * Qdrant sync task payload
 */
export interface QdrantSyncTaskPayload {
  /** Sync mode: full resync or incremental */
  mode: 'full' | 'incremental';
  /** Project to sync (optional, syncs all if not specified) */
  project?: string;
  /** Observation IDs to sync (for incremental) */
  observationIds?: number[];
  /** Summary IDs to sync (for incremental) */
  summaryIds?: number[];
}

/**
 * Semantic search task payload
 */
export interface SemanticSearchTaskPayload {
  /** Search query */
  query: string;
  /** Project to search in (optional) */
  project?: string;
  /** Maximum results to return */
  limit?: number;
  /** Filter by observation types */
  types?: string[];
  /** Minimum similarity score (0-1) */
  minScore?: number;
}

/**
 * Qdrant sync task
 */
export interface QdrantSyncTask extends BaseTask {
  type: 'qdrant-sync';
  payload: QdrantSyncTaskPayload;
  result?: {
    documentsProcessed: number;
    documentsAdded: number;
    documentsUpdated: number;
    documentsDeleted: number;
    durationMs: number;
  };
}

/**
 * Semantic search task
 */
export interface SemanticSearchTask extends BaseTask {
  type: 'semantic-search';
  payload: SemanticSearchTaskPayload;
  result?: {
    results: Array<{
      id: number;
      type: string;
      title: string;
      text: string;
      score: number;
      project?: string;
      createdAt: number;
    }>;
    query: string;
    totalFound: number;
    durationMs: number;
  };
}

/**
 * CLAUDE.md generation task payload
 */
export interface ClaudeMdTaskPayload {
  project: string;
  memorySessionId: string;
  contentSessionId: string;
  workingDirectory: string;
  /** Target directory for CLAUDE.md generation (subdirectory of workingDirectory) */
  targetDirectory?: string;
}

/**
 * CLAUDE.md generation task
 */
export interface ClaudeMdTask extends BaseTask {
  type: 'claude-md';
  payload: ClaudeMdTaskPayload;
  result?: {
    content: string;
    tokens: number;
  };
}

/**
 * Compression task payload (Endless Mode - Issue #109)
 */
export interface CompressionTaskPayload {
  /** Archived output ID to compress */
  archivedOutputId: number;
  /** Session for context */
  sessionId: string;
  /** Project for context */
  project: string;
  /** Tool name for context */
  toolName: string;
  /** Original token count */
  tokenCount?: number;
}

/**
 * Compression task (Endless Mode - Issue #109)
 *
 * Compresses archived tool outputs to create observations
 * with ~95% token reduction.
 */
export interface CompressionTask extends BaseTask {
  type: 'compression';
  payload: CompressionTaskPayload;
  result?: {
    /** Created observation ID */
    observationId: number;
    /** Original token count */
    originalTokens: number;
    /** Compressed token count */
    compressedTokens: number;
    /** Compression ratio achieved */
    compressionRatio: number;
  };
}

/**
 * Union of all task types
 */
export type Task =
  | ObservationTask
  | SummarizeTask
  | EmbeddingTask
  | QdrantSyncTask
  | SemanticSearchTask
  | ContextGenerateTask
  | ClaudeMdTask
  | CompressionTask;

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

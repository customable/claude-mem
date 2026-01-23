/**
 * REST API Types
 *
 * Request and response types for the Backend REST API.
 * Used by hooks, UI, and MCP server.
 */

import type {
  ObservationRecord,
  SessionSummaryRecord,
  SdkSessionRecord,
  ObservationType,
} from './database.js';
import type { ConnectedWorker } from './capabilities.js';
import type { TaskStatus } from './tasks.js';

// ============================================
// Common Types
// ============================================

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * API error response
 */
export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

// ============================================
// Health & Status
// ============================================

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  uptime: number;
  database: {
    connected: boolean;
    size?: number;
  };
  workers: {
    connected: number;
    capabilities: string[];
  };
  queue: {
    pending: number;
    processing: number;
  };
}

/**
 * Readiness check response
 */
export interface ReadinessResponse {
  ready: boolean;
  checks: {
    database: boolean;
    embeddedWorker?: boolean;
  };
}

// ============================================
// Sessions
// ============================================

/**
 * Session list response
 */
export interface SessionListResponse extends PaginatedResponse<SdkSessionRecord> {}

/**
 * Session detail response
 */
export interface SessionDetailResponse {
  session: SdkSessionRecord;
  observations: ObservationRecord[];
  summaries: SessionSummaryRecord[];
}

// ============================================
// Observations
// ============================================

/**
 * Observation search parameters
 */
export interface ObservationSearchParams extends PaginationParams {
  query?: string;
  project?: string;
  type?: ObservationType | ObservationType[];
  sessionId?: string;
  dateStart?: string;
  dateEnd?: string;
  orderBy?: 'created_at' | 'relevance';
  order?: 'asc' | 'desc';
}

/**
 * Observation list response
 */
export interface ObservationListResponse extends PaginatedResponse<ObservationRecord> {}

// ============================================
// Search (MCP)
// ============================================

/**
 * MCP search request
 */
export interface SearchRequest {
  query: string;
  limit?: number;
  project?: string;
  type?: string;
  dateStart?: string;
  dateEnd?: string;
}

/**
 * MCP search response
 */
export interface SearchResponse {
  results: Array<{
    id: number;
    title: string;
    text: string;
    type: ObservationType;
    project: string;
    created_at: string;
    relevance?: number;
  }>;
  total: number;
}

/**
 * Timeline request
 */
export interface TimelineRequest {
  anchor?: number;  // Observation ID
  query?: string;   // Or find anchor by query
  depthBefore?: number;
  depthAfter?: number;
  project?: string;
}

/**
 * Timeline response
 */
export interface TimelineResponse {
  anchor: ObservationRecord;
  before: ObservationRecord[];
  after: ObservationRecord[];
}

// ============================================
// Hooks API
// ============================================

/**
 * Hook observation request (from Claude Code hooks)
 */
export interface HookObservationRequest {
  sessionId: string;
  project: string;
  toolName: string;
  toolInput: string;
  toolOutput: string;
  promptNumber?: number;
}

/**
 * Hook observation response
 */
export interface HookObservationResponse {
  queued: boolean;
  taskId?: string;
  error?: string;
}

/**
 * Hook summarize request
 */
export interface HookSummarizeRequest {
  sessionId: string;
  project: string;
  promptNumber?: number;
}

/**
 * Hook summarize response
 */
export interface HookSummarizeResponse {
  queued: boolean;
  taskId?: string;
  error?: string;
}

/**
 * Hook context request
 */
export interface HookContextRequest {
  project: string;
  limit?: number;
}

/**
 * Hook context response
 */
export interface HookContextResponse {
  context: string;
  observationCount: number;
  fromCache: boolean;
}

// ============================================
// Workers
// ============================================

/**
 * Workers list response
 */
export interface WorkersListResponse {
  workers: ConnectedWorker[];
  embeddedWorker?: {
    enabled: boolean;
    capabilities: string[];
    status: 'running' | 'stopped';
  };
}

// ============================================
// Task Queue
// ============================================

/**
 * Queue status response
 */
export interface QueueStatusResponse {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  byType: Record<string, {
    pending: number;
    processing: number;
  }>;
}

/**
 * Task status response
 */
export interface TaskStatusResponse {
  taskId: string;
  status: TaskStatus;
  type: string;
  createdAt: number;
  assignedAt?: number;
  completedAt?: number;
  assignedWorkerId?: string;
  error?: string;
  result?: unknown;
}

// ============================================
// Settings
// ============================================

/**
 * Settings response
 */
export interface SettingsResponse {
  settings: Record<string, unknown>;
  defaults: Record<string, unknown>;
}

/**
 * Settings update request
 */
export interface SettingsUpdateRequest {
  settings: Record<string, unknown>;
}

// ============================================
// SSE Events
// ============================================

/**
 * SSE event types
 */
export type SSEEventType =
  | 'connected'
  | 'observation:created'
  | 'observation:updated'
  | 'summary:created'
  | 'session:started'
  | 'session:completed'
  | 'worker:connected'
  | 'worker:disconnected'
  | 'task:queued'
  | 'task:completed'
  | 'task:failed'
  | 'heartbeat';

/**
 * Base SSE event
 */
export interface BaseSSEEvent {
  type: SSEEventType;
  timestamp: number;
}

/**
 * Observation created event
 */
export interface ObservationCreatedEvent extends BaseSSEEvent {
  type: 'observation:created';
  observation: ObservationRecord;
}

/**
 * Session completed event
 */
export interface SessionCompletedEvent extends BaseSSEEvent {
  type: 'session:completed';
  sessionId: string;
  project: string;
}

/**
 * Worker connected event
 */
export interface WorkerConnectedEvent extends BaseSSEEvent {
  type: 'worker:connected';
  workerId: string;
  capabilities: string[];
}

/**
 * All SSE events
 */
export type SSEEvent =
  | ObservationCreatedEvent
  | SessionCompletedEvent
  | WorkerConnectedEvent
  | BaseSSEEvent;

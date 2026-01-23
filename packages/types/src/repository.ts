/**
 * Repository Pattern Types
 *
 * Abstract interfaces for data access, allowing different
 * backend implementations (SQLite, PostgreSQL, etc.)
 */

import type {
  SdkSessionRecord,
  ObservationRecord,
  SessionSummaryRecord,
  UserPromptRecord,
  ObservationType,
  SessionStatus,
} from './database.js';

// ============================================
// Query Types
// ============================================

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Common query options
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  order?: SortDirection;
}

/**
 * Date range filter
 */
export interface DateRangeFilter {
  start?: Date | number;
  end?: Date | number;
}

// ============================================
// Session Repository
// ============================================

/**
 * Session creation input
 */
export interface CreateSessionInput {
  contentSessionId: string;
  memorySessionId?: string;
  project: string;
  userPrompt?: string;
}

/**
 * Session update input
 */
export interface UpdateSessionInput {
  status?: SessionStatus;
  completedAt?: Date | number;
  promptCounter?: number;
  memorySessionId?: string;
}

/**
 * Session query filters
 */
export interface SessionQueryFilters {
  project?: string;
  status?: SessionStatus | SessionStatus[];
  dateRange?: DateRangeFilter;
}

/**
 * Session Repository Interface
 */
export interface ISessionRepository {
  /**
   * Create a new session
   */
  create(input: CreateSessionInput): Promise<SdkSessionRecord>;

  /**
   * Find session by ID
   */
  findById(id: number): Promise<SdkSessionRecord | null>;

  /**
   * Find session by content session ID
   */
  findByContentSessionId(contentSessionId: string): Promise<SdkSessionRecord | null>;

  /**
   * Find session by memory session ID
   */
  findByMemorySessionId(memorySessionId: string): Promise<SdkSessionRecord | null>;

  /**
   * Update a session
   */
  update(id: number, input: UpdateSessionInput): Promise<SdkSessionRecord | null>;

  /**
   * List sessions with optional filters
   */
  list(filters?: SessionQueryFilters, options?: QueryOptions): Promise<SdkSessionRecord[]>;

  /**
   * Count sessions matching filters
   */
  count(filters?: SessionQueryFilters): Promise<number>;

  /**
   * Get active session for project
   */
  getActiveSession(project: string): Promise<SdkSessionRecord | null>;

  /**
   * Delete a session and related data
   */
  delete(id: number): Promise<boolean>;

  /**
   * Get all distinct project names
   */
  getDistinctProjects(): Promise<string[]>;
}

// ============================================
// Observation Repository
// ============================================

/**
 * Observation creation input
 */
export interface CreateObservationInput {
  memorySessionId: string;
  project: string;
  text: string;
  type: ObservationType;
  title?: string;
  concept?: string;
  sourceFiles?: string;
  promptNumber?: number;
  discoveryTokens?: number;
}

/**
 * Observation query filters
 */
export interface ObservationQueryFilters {
  project?: string;
  sessionId?: string;
  type?: ObservationType | ObservationType[];
  dateRange?: DateRangeFilter;
  search?: string;  // Full-text search
}

/**
 * Observation Repository Interface
 */
export interface IObservationRepository {
  /**
   * Create a new observation
   */
  create(input: CreateObservationInput): Promise<ObservationRecord>;

  /**
   * Find observation by ID
   */
  findById(id: number): Promise<ObservationRecord | null>;

  /**
   * Update an observation
   */
  update(id: number, input: Partial<CreateObservationInput>): Promise<ObservationRecord | null>;

  /**
   * List observations with optional filters
   */
  list(filters?: ObservationQueryFilters, options?: QueryOptions): Promise<ObservationRecord[]>;

  /**
   * Count observations matching filters
   */
  count(filters?: ObservationQueryFilters): Promise<number>;

  /**
   * Full-text search observations
   */
  search(query: string, filters?: ObservationQueryFilters, options?: QueryOptions): Promise<ObservationRecord[]>;

  /**
   * Get observations for a session
   */
  getBySessionId(memorySessionId: string, options?: QueryOptions): Promise<ObservationRecord[]>;

  /**
   * Get observations for context injection
   */
  getForContext(project: string, limit: number): Promise<ObservationRecord[]>;

  /**
   * Delete an observation
   */
  delete(id: number): Promise<boolean>;

  /**
   * Delete all observations for a session
   */
  deleteBySessionId(memorySessionId: string): Promise<number>;
}

// ============================================
// Summary Repository
// ============================================

/**
 * Summary creation input
 */
export interface CreateSummaryInput {
  memorySessionId: string;
  project: string;
  request?: string;
  investigated?: string;
  learned?: string;
  completed?: string;
  nextSteps?: string;
  promptNumber?: number;
  discoveryTokens?: number;
}

/**
 * Summary query filters
 */
export interface SummaryQueryFilters {
  project?: string;
  sessionId?: string;
  dateRange?: DateRangeFilter;
}

/**
 * Summary Repository Interface
 */
export interface ISummaryRepository {
  /**
   * Create a new summary
   */
  create(input: CreateSummaryInput): Promise<SessionSummaryRecord>;

  /**
   * Find summary by ID
   */
  findById(id: number): Promise<SessionSummaryRecord | null>;

  /**
   * Update a summary
   */
  update(id: number, input: Partial<CreateSummaryInput>): Promise<SessionSummaryRecord | null>;

  /**
   * List summaries with optional filters
   */
  list(filters?: SummaryQueryFilters, options?: QueryOptions): Promise<SessionSummaryRecord[]>;

  /**
   * Count summaries matching filters
   */
  count(filters?: SummaryQueryFilters): Promise<number>;

  /**
   * Get summaries for a session
   */
  getBySessionId(memorySessionId: string): Promise<SessionSummaryRecord[]>;

  /**
   * Get latest summary for a project
   */
  getLatestForProject(project: string): Promise<SessionSummaryRecord | null>;

  /**
   * Delete a summary
   */
  delete(id: number): Promise<boolean>;
}

// ============================================
// User Prompt Repository
// ============================================

/**
 * User prompt creation input
 */
export interface CreateUserPromptInput {
  contentSessionId: string;
  promptNumber: number;
  promptText: string;
}

/**
 * User Prompt Repository Interface
 */
export interface IUserPromptRepository {
  /**
   * Create a new user prompt
   */
  create(input: CreateUserPromptInput): Promise<UserPromptRecord>;

  /**
   * Get prompts for a session
   */
  getBySessionId(contentSessionId: string): Promise<UserPromptRecord[]>;

  /**
   * Get latest prompt for a session
   */
  getLatestForSession(contentSessionId: string): Promise<UserPromptRecord | null>;

  /**
   * Count prompts for a session
   */
  countForSession(contentSessionId: string): Promise<number>;
}

// ============================================
// Task Queue Repository
// ============================================

import type { Task, TaskStatus, TaskType, CreateTaskInput } from './tasks.js';

/**
 * Task query filters
 */
export interface TaskQueryFilters {
  status?: TaskStatus | TaskStatus[];
  type?: TaskType | TaskType[];
  workerId?: string;
  dateRange?: DateRangeFilter;
}

/**
 * Task Queue Repository Interface
 */
export interface ITaskQueueRepository {
  /**
   * Create a new task
   */
  create<T extends Task>(input: CreateTaskInput<T>): Promise<T>;

  /**
   * Find task by ID
   */
  findById(id: string): Promise<Task | null>;

  /**
   * Update task status
   */
  updateStatus(id: string, status: TaskStatus, extra?: Partial<Task>): Promise<Task | null>;

  /**
   * Assign task to worker
   */
  assign(id: string, workerId: string): Promise<Task | null>;

  /**
   * Get next pending task matching capabilities
   */
  getNextPending(capabilities: string[]): Promise<Task | null>;

  /**
   * List tasks with optional filters
   */
  list(filters?: TaskQueryFilters, options?: QueryOptions): Promise<Task[]>;

  /**
   * Count tasks by status
   */
  countByStatus(): Promise<Record<TaskStatus, number>>;

  /**
   * Get tasks assigned to a worker
   */
  getByWorkerId(workerId: string): Promise<Task[]>;

  /**
   * Clean up old completed/failed tasks
   */
  cleanup(olderThanMs: number): Promise<number>;
}

// ============================================
// Database Connection Interface
// ============================================

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  type: 'sqlite' | 'postgres' | 'mysql';
  // SQLite
  path?: string;
  // PostgreSQL/MySQL
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  // Common
  poolSize?: number;
}

/**
 * Database connection interface
 */
export interface IDatabaseConnection {
  /**
   * Initialize the database (run migrations, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Check if database is connected
   */
  isConnected(): boolean;

  /**
   * Close the connection
   */
  close(): Promise<void>;

  /**
   * Run a transaction
   */
  transaction<T>(fn: () => Promise<T>): Promise<T>;

  /**
   * Get the underlying connection (for advanced use)
   */
  getRawConnection(): unknown;
}

// ============================================
// Unit of Work Pattern
// ============================================

/**
 * Unit of Work - provides access to all repositories
 * with transaction support
 */
export interface IUnitOfWork {
  sessions: ISessionRepository;
  observations: IObservationRepository;
  summaries: ISummaryRepository;
  userPrompts: IUserPromptRepository;
  taskQueue: ITaskQueueRepository;

  /**
   * Start a transaction
   */
  beginTransaction(): Promise<void>;

  /**
   * Commit the current transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback the current transaction
   */
  rollback(): Promise<void>;
}

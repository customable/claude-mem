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
  DocumentRecord,
  ObservationType,
  DocumentType,
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
  workingDirectory?: string;
  // Git worktree support
  repoPath?: string;
  isWorktree?: boolean;
  branch?: string;
}

/**
 * Session update input
 */
export interface UpdateSessionInput {
  status?: SessionStatus;
  completedAt?: Date | number;
  promptCounter?: number;
  memorySessionId?: string;
  // Git worktree support
  repoPath?: string;
  isWorktree?: boolean;
  branch?: string;
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
  subtitle?: string;
  concepts?: string;
  facts?: string;
  narrative?: string;
  filesRead?: string;
  filesModified?: string;
  promptNumber?: number;
  discoveryTokens?: number;
  gitBranch?: string;
  cwd?: string;
  // Git worktree support
  repoPath?: string;
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
  cwdPrefix?: string;  // Filter observations where cwd starts with this path
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
// Document Repository
// ============================================

/**
 * Document creation input
 */
export interface CreateDocumentInput {
  project: string;
  source: string;
  sourceTool: string;
  title?: string;
  content: string;
  contentHash: string;
  type?: DocumentType;
  metadata?: Record<string, unknown>;
  memorySessionId?: string;
  observationId?: number;
}

/**
 * Document query filters
 */
export interface DocumentQueryFilters {
  project?: string;
  source?: string;
  sourceTool?: string;
  type?: DocumentType | DocumentType[];
  dateRange?: DateRangeFilter;
  search?: string;
}

/**
 * Document Repository Interface
 */
export interface IDocumentRepository {
  /**
   * Create a new document
   */
  create(input: CreateDocumentInput): Promise<DocumentRecord>;

  /**
   * Find document by ID
   */
  findById(id: number): Promise<DocumentRecord | null>;

  /**
   * Find document by content hash (for deduplication)
   */
  findByHash(contentHash: string): Promise<DocumentRecord | null>;

  /**
   * Update a document
   */
  update(id: number, input: Partial<CreateDocumentInput>): Promise<DocumentRecord | null>;

  /**
   * Update access count and timestamp (when document is reused)
   */
  recordAccess(id: number): Promise<DocumentRecord | null>;

  /**
   * List documents with optional filters
   */
  list(filters?: DocumentQueryFilters, options?: QueryOptions): Promise<DocumentRecord[]>;

  /**
   * Count documents matching filters
   */
  count(filters?: DocumentQueryFilters): Promise<number>;

  /**
   * Full-text search documents
   */
  search(query: string, filters?: DocumentQueryFilters, options?: QueryOptions): Promise<DocumentRecord[]>;

  /**
   * Get documents for a project
   */
  getByProject(project: string, options?: QueryOptions): Promise<DocumentRecord[]>;

  /**
   * Get documents by source tool (e.g., all Context7 lookups)
   */
  getBySourceTool(sourceTool: string, options?: QueryOptions): Promise<DocumentRecord[]>;

  /**
   * Get frequently accessed documents
   */
  getFrequentlyAccessed(limit: number): Promise<DocumentRecord[]>;

  /**
   * Delete a document
   */
  delete(id: number): Promise<boolean>;

  /**
   * Delete old, rarely accessed documents (cleanup)
   */
  cleanupOld(olderThanDays: number, minAccessCount: number): Promise<number>;
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
   * Get first prompt for a session
   */
  getFirstForSession(contentSessionId: string): Promise<UserPromptRecord | null>;

  /**
   * Get first prompts for multiple sessions (batch)
   */
  getFirstPromptsForSessions(contentSessionIds: string[]): Promise<Map<string, string>>;

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
// CLAUDE.md Repository
// ============================================

/**
 * CLAUDE.md record from database
 */
export interface ClaudeMdRecord {
  id: number;
  project: string;
  content: string;
  content_session_id: string;
  memory_session_id: string | null;
  working_directory: string | null;
  generated_at: number;
  tokens: number;
}

/**
 * Input for creating/updating CLAUDE.md records
 */
export interface UpsertClaudeMdInput {
  project: string;
  content: string;
  contentSessionId: string;
  memorySessionId?: string;
  workingDirectory?: string;
  tokens?: number;
}

/**
 * CLAUDE.md Repository Interface
 */
export interface IClaudeMdRepository {
  /**
   * Insert or update CLAUDE.md content for a project/session
   */
  upsert(input: UpsertClaudeMdInput): Promise<ClaudeMdRecord>;

  /**
   * Get latest CLAUDE.md content for a project
   */
  getByProject(project: string): Promise<ClaudeMdRecord | null>;

  /**
   * Get CLAUDE.md content by project and session
   */
  getByProjectAndSession(project: string, contentSessionId: string): Promise<ClaudeMdRecord | null>;

  /**
   * List all CLAUDE.md records for a project
   */
  listByProject(project: string, limit?: number): Promise<ClaudeMdRecord[]>;

  /**
   * Delete CLAUDE.md record by ID
   */
  delete(id: number): Promise<boolean>;

  /**
   * Delete all CLAUDE.md records for a project
   */
  deleteByProject(project: string): Promise<number>;

  /**
   * Get all distinct projects with CLAUDE.md content
   */
  getDistinctProjects(): Promise<string[]>;
}

// ============================================
// Code Snippet Repository
// ============================================

/**
 * Code snippet record from database
 */
export interface CodeSnippetRecord {
  id: number;
  observation_id: number;
  memory_session_id: string;
  project: string;
  language: string | null;
  code: string;
  file_path: string | null;
  line_start: number | null;
  line_end: number | null;
  context: string | null;
  created_at_epoch: number;
}

/**
 * Input for creating code snippets
 */
export interface CreateCodeSnippetInput {
  observationId: number;
  memorySessionId: string;
  project: string;
  language?: string;
  code: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  context?: string;
}

/**
 * Code snippet query filters
 */
export interface CodeSnippetQueryFilters {
  project?: string;
  language?: string;
  sessionId?: string;
}

/**
 * Code Snippet Repository Interface
 */
export interface ICodeSnippetRepository {
  /**
   * Create a new code snippet
   */
  create(input: CreateCodeSnippetInput): Promise<CodeSnippetRecord>;

  /**
   * Create multiple code snippets
   */
  createMany(inputs: CreateCodeSnippetInput[]): Promise<CodeSnippetRecord[]>;

  /**
   * Find snippet by ID
   */
  findById(id: number): Promise<CodeSnippetRecord | null>;

  /**
   * Find snippets by observation ID
   */
  findByObservationId(observationId: number): Promise<CodeSnippetRecord[]>;

  /**
   * List snippets with optional filters
   */
  list(filters?: CodeSnippetQueryFilters, options?: QueryOptions): Promise<CodeSnippetRecord[]>;

  /**
   * Full-text search code snippets
   */
  search(query: string, filters?: CodeSnippetQueryFilters, options?: QueryOptions): Promise<CodeSnippetRecord[]>;

  /**
   * Delete a snippet
   */
  delete(id: number): Promise<boolean>;

  /**
   * Delete all snippets for an observation
   */
  deleteByObservationId(observationId: number): Promise<number>;

  /**
   * Count snippets matching filters
   */
  count(filters?: CodeSnippetQueryFilters): Promise<number>;

  /**
   * Get distinct languages used in snippets
   */
  getDistinctLanguages(project?: string): Promise<string[]>;
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
  documents: IDocumentRepository;
  userPrompts: IUserPromptRepository;
  taskQueue: ITaskQueueRepository;
  claudemd: IClaudeMdRepository;
  codeSnippets: ICodeSnippetRepository;

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

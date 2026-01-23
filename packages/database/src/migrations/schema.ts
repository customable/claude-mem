/**
 * Database Schema Definitions
 *
 * SQL statements for all tables. Used by migrations.
 */

/**
 * Schema version tracking table
 */
export const SCHEMA_VERSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )
`;

/**
 * Sessions table - tracks Claude Code sessions
 */
export const SESSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS sdk_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_session_id TEXT UNIQUE NOT NULL,
    memory_session_id TEXT,
    project TEXT NOT NULL,
    user_prompt TEXT,
    started_at TEXT NOT NULL,
    started_at_epoch INTEGER NOT NULL,
    completed_at TEXT,
    completed_at_epoch INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    worker_port INTEGER,
    prompt_counter INTEGER DEFAULT 0
  )
`;

export const SESSIONS_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_sessions_project ON sdk_sessions(project);
  CREATE INDEX IF NOT EXISTS idx_sessions_status ON sdk_sessions(status);
  CREATE INDEX IF NOT EXISTS idx_sessions_started ON sdk_sessions(started_at_epoch DESC);
  CREATE INDEX IF NOT EXISTS idx_sessions_memory_id ON sdk_sessions(memory_session_id);
`;

/**
 * Observations table - stores AI-generated observations
 */
export const OBSERVATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_session_id TEXT NOT NULL,
    project TEXT NOT NULL,
    text TEXT,
    type TEXT NOT NULL DEFAULT 'discovery',
    title TEXT,
    concept TEXT,
    source_files TEXT,
    prompt_number INTEGER,
    discovery_tokens INTEGER,
    created_at TEXT NOT NULL,
    created_at_epoch INTEGER NOT NULL
  )
`;

export const OBSERVATIONS_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_observations_session ON observations(memory_session_id);
  CREATE INDEX IF NOT EXISTS idx_observations_project ON observations(project);
  CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type);
  CREATE INDEX IF NOT EXISTS idx_observations_created ON observations(created_at_epoch DESC);
  CREATE INDEX IF NOT EXISTS idx_observations_project_created ON observations(project, created_at_epoch DESC);
`;

/**
 * Full-text search for observations
 */
export const OBSERVATIONS_FTS = `
  CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
    title,
    text,
    concept,
    content='observations',
    content_rowid='id'
  )
`;

export const OBSERVATIONS_FTS_TRIGGERS = `
  CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
    INSERT INTO observations_fts(rowid, title, text, concept)
    VALUES (new.id, new.title, new.text, new.concept);
  END;

  CREATE TRIGGER IF NOT EXISTS observations_ad AFTER DELETE ON observations BEGIN
    INSERT INTO observations_fts(observations_fts, rowid, title, text, concept)
    VALUES ('delete', old.id, old.title, old.text, old.concept);
  END;

  CREATE TRIGGER IF NOT EXISTS observations_au AFTER UPDATE ON observations BEGIN
    INSERT INTO observations_fts(observations_fts, rowid, title, text, concept)
    VALUES ('delete', old.id, old.title, old.text, old.concept);
    INSERT INTO observations_fts(rowid, title, text, concept)
    VALUES (new.id, new.title, new.text, new.concept);
  END;
`;

/**
 * Summaries table - session summaries
 */
export const SUMMARIES_TABLE = `
  CREATE TABLE IF NOT EXISTS session_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_session_id TEXT NOT NULL,
    project TEXT NOT NULL,
    request TEXT,
    investigated TEXT,
    learned TEXT,
    completed TEXT,
    next_steps TEXT,
    prompt_number INTEGER,
    discovery_tokens INTEGER,
    created_at TEXT NOT NULL,
    created_at_epoch INTEGER NOT NULL
  )
`;

export const SUMMARIES_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_summaries_session ON session_summaries(memory_session_id);
  CREATE INDEX IF NOT EXISTS idx_summaries_project ON session_summaries(project);
  CREATE INDEX IF NOT EXISTS idx_summaries_created ON session_summaries(created_at_epoch DESC);
`;

/**
 * User prompts table - tracks user messages
 */
export const USER_PROMPTS_TABLE = `
  CREATE TABLE IF NOT EXISTS user_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_session_id TEXT NOT NULL,
    prompt_number INTEGER NOT NULL,
    prompt_text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    created_at_epoch INTEGER NOT NULL,
    UNIQUE(content_session_id, prompt_number)
  )
`;

export const USER_PROMPTS_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_prompts_session ON user_prompts(content_session_id);
  CREATE INDEX IF NOT EXISTS idx_prompts_created ON user_prompts(created_at_epoch DESC);
`;

/**
 * Task queue table - for Backend/Worker task distribution
 */
export const TASK_QUEUE_TABLE = `
  CREATE TABLE IF NOT EXISTS task_queue (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    required_capability TEXT NOT NULL,
    fallback_capabilities TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    payload TEXT NOT NULL,
    result TEXT,
    error TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    assigned_worker_id TEXT,
    created_at INTEGER NOT NULL,
    assigned_at INTEGER,
    completed_at INTEGER
  )
`;

export const TASK_QUEUE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON task_queue(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_type ON task_queue(type);
  CREATE INDEX IF NOT EXISTS idx_tasks_capability ON task_queue(required_capability);
  CREATE INDEX IF NOT EXISTS idx_tasks_worker ON task_queue(assigned_worker_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_priority ON task_queue(priority DESC, created_at ASC);
`;

/**
 * Pending messages table - queue for async processing (legacy support)
 */
export const PENDING_MESSAGES_TABLE = `
  CREATE TABLE IF NOT EXISTS pending_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    project TEXT NOT NULL,
    prompt_number INTEGER,
    tool_name TEXT NOT NULL,
    tool_input TEXT NOT NULL,
    tool_output TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    created_at_epoch INTEGER NOT NULL,
    processed_at TEXT,
    processed_at_epoch INTEGER
  )
`;

export const PENDING_MESSAGES_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_messages(status);
  CREATE INDEX IF NOT EXISTS idx_pending_session ON pending_messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_pending_created ON pending_messages(created_at_epoch ASC);
`;

/**
 * MikroORM Migration: Initial Schema
 *
 * Creates all core tables. FTS5 virtual tables are created separately
 * as MikroORM doesn't support them natively.
 */

import { Migration } from '@mikro-orm/migrations';

export class Migration20240101000001_InitialSchema extends Migration {
  async up(): Promise<void> {
    // Sessions table
    this.addSql(`
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
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_sessions_project ON sdk_sessions(project)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_sessions_status ON sdk_sessions(status)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_sessions_started ON sdk_sessions(started_at_epoch DESC)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_sessions_memory_id ON sdk_sessions(memory_session_id)`);

    // Observations table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT NOT NULL,
        project TEXT NOT NULL,
        text TEXT,
        type TEXT NOT NULL DEFAULT 'discovery',
        title TEXT,
        subtitle TEXT,
        narrative TEXT,
        concept TEXT,
        concepts TEXT,
        facts TEXT,
        source_files TEXT,
        files_read TEXT,
        files_modified TEXT,
        git_branch TEXT,
        prompt_number INTEGER,
        discovery_tokens INTEGER,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL
      )
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_observations_session ON observations(memory_session_id)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_observations_project ON observations(project)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_observations_created ON observations(created_at_epoch DESC)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_observations_project_created ON observations(project, created_at_epoch DESC)`);

    // Summaries table
    this.addSql(`
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
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_summaries_session ON session_summaries(memory_session_id)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_summaries_project ON session_summaries(project)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_summaries_created ON session_summaries(created_at_epoch DESC)`);

    // User prompts table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS user_prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_session_id TEXT NOT NULL,
        prompt_number INTEGER NOT NULL,
        prompt_text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        UNIQUE(content_session_id, prompt_number)
      )
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_prompts_session ON user_prompts(content_session_id)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_prompts_created ON user_prompts(created_at_epoch DESC)`);

    // Task queue table
    this.addSql(`
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
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON task_queue(status)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_tasks_type ON task_queue(type)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_tasks_capability ON task_queue(required_capability)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_tasks_worker ON task_queue(assigned_worker_id)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_tasks_priority ON task_queue(priority DESC, created_at ASC)`);

    // Pending messages table (legacy)
    this.addSql(`
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
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_messages(status)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_pending_session ON pending_messages(session_id)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_pending_created ON pending_messages(created_at_epoch ASC)`);

    // Project CLAUDE.md table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS project_claudemd (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL,
        content TEXT NOT NULL,
        content_session_id TEXT NOT NULL,
        memory_session_id TEXT,
        working_directory TEXT,
        generated_at INTEGER NOT NULL,
        tokens INTEGER DEFAULT 0,
        UNIQUE(project, content_session_id)
      )
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_claudemd_project ON project_claudemd(project)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_claudemd_generated ON project_claudemd(generated_at DESC)`);

    // Documents table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL,
        source TEXT NOT NULL,
        source_tool TEXT NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'library-docs',
        metadata TEXT,
        memory_session_id TEXT,
        observation_id INTEGER,
        access_count INTEGER NOT NULL DEFAULT 1,
        last_accessed_epoch INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        UNIQUE(content_hash)
      )
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_documents_source_tool ON documents(source_tool)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(content_hash)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at_epoch DESC)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_documents_accessed ON documents(last_accessed_epoch DESC)`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS documents`);
    this.addSql(`DROP TABLE IF EXISTS project_claudemd`);
    this.addSql(`DROP TABLE IF EXISTS pending_messages`);
    this.addSql(`DROP TABLE IF EXISTS task_queue`);
    this.addSql(`DROP TABLE IF EXISTS user_prompts`);
    this.addSql(`DROP TABLE IF EXISTS session_summaries`);
    this.addSql(`DROP TABLE IF EXISTS observations`);
    this.addSql(`DROP TABLE IF EXISTS sdk_sessions`);
  }
}

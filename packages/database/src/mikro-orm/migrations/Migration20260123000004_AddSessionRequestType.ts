/**
 * MikroORM Migration: Add session-request type + cwd field to observations
 *
 * Recreates observations table with:
 * 1. Updated CHECK constraint to include 'session-request' type
 * 2. New 'cwd' field for tracking working directory per observation
 */

import { Migration } from '@mikro-orm/migrations';

export class Migration20260123000004_AddSessionRequestType extends Migration {
  override async up(): Promise<void> {
    // SQLite doesn't support modifying CHECK constraints directly
    // We need to recreate the table with the new constraint

    // 1. Create new table with updated constraint and cwd field
    this.addSql(`
      CREATE TABLE observations_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT NOT NULL,
        project TEXT NOT NULL,
        text TEXT,
        type TEXT NOT NULL CHECK(type IN ('decision', 'bugfix', 'feature', 'refactor', 'discovery', 'change', 'session-request')),
        title TEXT,
        subtitle TEXT,
        facts TEXT,
        narrative TEXT,
        concepts TEXT,
        files_read TEXT,
        files_modified TEXT,
        prompt_number INTEGER,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        discovery_tokens INTEGER DEFAULT 0,
        git_branch TEXT,
        cwd TEXT,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE
      )
    `);

    // 2. Copy data from old table (explicit columns since we added cwd)
    this.addSql(`
      INSERT INTO observations_new (
        id, memory_session_id, project, text, type, title, subtitle,
        facts, narrative, concepts, files_read, files_modified,
        prompt_number, created_at, created_at_epoch, discovery_tokens, git_branch, cwd
      )
      SELECT
        id, memory_session_id, project, text, type, title, subtitle,
        facts, narrative, concepts, files_read, files_modified,
        prompt_number, created_at, created_at_epoch, discovery_tokens, git_branch, NULL
      FROM observations
    `);

    // 3. Drop old table
    this.addSql(`DROP TABLE observations`);

    // 4. Rename new table
    this.addSql(`ALTER TABLE observations_new RENAME TO observations`);

    // 5. Recreate FTS table (it references observations)
    this.addSql(`DROP TABLE IF EXISTS observations_fts`);
    this.addSql(`
      CREATE VIRTUAL TABLE observations_fts USING fts5(
        title,
        text,
        narrative,
        content='observations',
        content_rowid='id'
      )
    `);

    // 6. Repopulate FTS index
    this.addSql(`
      INSERT INTO observations_fts(rowid, title, text, narrative)
      SELECT id, title, text, narrative FROM observations
    `);
  }

  override async down(): Promise<void> {
    // Reverting would lose session-request observations
    // This is intentionally a no-op for safety
  }
}

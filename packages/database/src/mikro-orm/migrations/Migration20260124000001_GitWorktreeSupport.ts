/**
 * MikroORM Migration: Git Worktree Support
 *
 * Adds columns to support git worktree detection:
 * - repo_path: The canonical path to the main repository
 * - is_worktree: Whether the session is in a git worktree
 * - branch: The current git branch
 *
 * Also creates a repositories table for tracking unique repositories.
 */

import { Migration } from '@mikro-orm/migrations';

export class Migration20260124000001_GitWorktreeSupport extends Migration {
  override async up(): Promise<void> {
    // Add git-related columns to sdk_sessions
    this.addSql(`ALTER TABLE sdk_sessions ADD COLUMN repo_path TEXT`);
    this.addSql(`ALTER TABLE sdk_sessions ADD COLUMN is_worktree INTEGER DEFAULT 0`);
    this.addSql(`ALTER TABLE sdk_sessions ADD COLUMN branch TEXT`);

    // Add git-related columns to observations
    this.addSql(`ALTER TABLE observations ADD COLUMN repo_path TEXT`);
    this.addSql(`ALTER TABLE observations ADD COLUMN branch TEXT`);

    // Create repositories table for tracking unique repos
    this.addSql(`
      CREATE TABLE IF NOT EXISTS repositories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_path TEXT UNIQUE NOT NULL,
        remote_url TEXT,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        last_seen_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Create index for efficient lookups
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_repositories_name ON repositories(name)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_sessions_repo_path ON sdk_sessions(repo_path)`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_observations_repo_path ON observations(repo_path)`);
  }

  override async down(): Promise<void> {
    // SQLite doesn't support DROP COLUMN easily
    // Drop the new table only
    this.addSql(`DROP TABLE IF EXISTS repositories`);
    this.addSql(`DROP INDEX IF EXISTS idx_repositories_name`);
    this.addSql(`DROP INDEX IF EXISTS idx_sessions_repo_path`);
    this.addSql(`DROP INDEX IF EXISTS idx_observations_repo_path`);
  }
}

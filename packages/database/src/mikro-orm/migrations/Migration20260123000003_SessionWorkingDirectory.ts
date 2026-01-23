/**
 * MikroORM Migration: Add working_directory to sdk_sessions
 *
 * Stores the working directory (cwd) for each session,
 * needed for CLAUDE.md generation.
 */

import { Migration } from '@mikro-orm/migrations';

export class Migration20260123000003_SessionWorkingDirectory extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE sdk_sessions ADD COLUMN working_directory TEXT`);
  }

  override async down(): Promise<void> {
    // SQLite doesn't support DROP COLUMN easily
    // This is a no-op for safety
  }
}

/**
 * Migration: Add is_urgent field to user_prompts
 *
 * Adds field to track CAPSLOCK/urgent prompts (Issue #233)
 */

import { Migration } from '@mikro-orm/migrations';

export class Migration20260124000011_AddUrgentPromptField extends Migration {
  async up(): Promise<void> {
    // Add is_urgent field to user_prompts
    this.addSql(`
      ALTER TABLE user_prompts ADD COLUMN is_urgent INTEGER DEFAULT 0;
    `);

    // Add index for filtering urgent prompts
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_user_prompts_is_urgent ON user_prompts(is_urgent);
    `);
  }

  async down(): Promise<void> {
    // SQLite doesn't support DROP COLUMN easily
  }
}

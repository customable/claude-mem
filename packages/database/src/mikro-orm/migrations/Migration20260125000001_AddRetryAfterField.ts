/**
 * Migration: Add retry_after field to task_queue (Issue #206)
 *
 * Adds exponential backoff support by storing the timestamp when
 * a failed task can be retried.
 */

import { Migration } from '@mikro-orm/migrations';

export class Migration20260125000001_AddRetryAfterField extends Migration {
  async up(): Promise<void> {
    // Add retry_after column for exponential backoff
    this.addSql(`
      ALTER TABLE task_queue ADD COLUMN retry_after INTEGER NULL;
    `);

    // Create index for efficient query filtering
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_task_queue_retry_after ON task_queue(retry_after);
    `);
  }

  async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS idx_task_queue_retry_after;`);
    this.addSql(`ALTER TABLE task_queue DROP COLUMN retry_after;`);
  }
}

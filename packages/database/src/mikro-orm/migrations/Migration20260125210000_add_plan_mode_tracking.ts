import { Migration } from '@mikro-orm/migrations';

/**
 * Migration: Add plan mode tracking to sessions (Issue #317)
 *
 * Adds fields to track when sessions enter/exit plan mode:
 * - is_in_plan_mode: Whether session is currently in plan mode
 * - plan_mode_entered_at: Timestamp when plan mode was entered (epoch ms)
 * - plan_mode_count: Number of times plan mode was entered in this session
 */
export class Migration20260125210000_add_plan_mode_tracking extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table \`sessions\` add column \`is_in_plan_mode\` integer not null default 0;`);
    this.addSql(`alter table \`sessions\` add column \`plan_mode_entered_at\` integer null;`);
    this.addSql(`alter table \`sessions\` add column \`plan_mode_count\` integer not null default 0;`);
  }

  override async down(): Promise<void> {
    // SQLite doesn't support dropping columns, so we need to recreate the table
    // For development, we just leave the columns in place
    // In production, a proper migration would recreate the table without these columns
  }

}

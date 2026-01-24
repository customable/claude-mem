/**
 * Migration: Add importance scoring fields
 *
 * Adds pinned and importance_boost fields to observations
 * for manual importance control.
 */

import { Migration } from '@mikro-orm/migrations';

export class Migration20260124000007_AddImportanceScoring extends Migration {
  async up(): Promise<void> {
    // Add pinned field with index
    this.addSql(`
      ALTER TABLE observations ADD COLUMN pinned INTEGER DEFAULT 0;
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_observations_pinned ON observations(pinned);
    `);

    // Add importance_boost field
    this.addSql(`
      ALTER TABLE observations ADD COLUMN importance_boost INTEGER DEFAULT 0;
    `);
  }

  async down(): Promise<void> {
    // SQLite doesn't support DROP COLUMN easily, so we skip for down migration
    // In production, would need to recreate the table
  }
}

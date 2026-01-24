/**
 * Migration: Add Decision Tracking Columns
 *
 * Adds columns to observations table for conflict detection:
 * - decision_category: categorizes decisions (architecture, technology, etc.)
 * - superseded_by: ID of observation that supersedes this one
 * - supersedes: ID of observation this one supersedes
 * - superseded_at: timestamp when marked as superseded
 */

import { Migration } from '@mikro-orm/migrations';

export class Migration20260124000005_AddDecisionTracking extends Migration {
  override async up(): Promise<void> {
    // Add decision tracking columns
    this.addSql(`
      ALTER TABLE observations ADD COLUMN decision_category TEXT;
    `);

    this.addSql(`
      ALTER TABLE observations ADD COLUMN superseded_by INTEGER;
    `);

    this.addSql(`
      ALTER TABLE observations ADD COLUMN supersedes INTEGER;
    `);

    this.addSql(`
      ALTER TABLE observations ADD COLUMN superseded_at TEXT;
    `);

    // Add index for decision queries
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_observations_decision_category
      ON observations(decision_category, project)
      WHERE decision_category IS NOT NULL;
    `);

    // Add index for supersession queries
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_observations_superseded
      ON observations(superseded_by)
      WHERE superseded_by IS NOT NULL;
    `);
  }

  override async down(): Promise<void> {
    // SQLite doesn't support DROP COLUMN, so we need to recreate the table
    // For simplicity, we just drop the indexes
    this.addSql('DROP INDEX IF EXISTS idx_observations_decision_category');
    this.addSql('DROP INDEX IF EXISTS idx_observations_superseded');
  }
}

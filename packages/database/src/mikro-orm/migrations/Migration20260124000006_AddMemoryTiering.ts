/**
 * Migration: Add Memory Tiering Columns
 *
 * Adds columns to observations table for Sleep Agent memory tiering:
 * - memory_tier: tier level (core, working, archive, ephemeral)
 * - tier_changed_at: when tier last changed
 * - access_count: how many times observation was accessed
 * - last_accessed_at: timestamp of last access
 * - last_accessed_at_epoch: epoch timestamp for queries
 * - consolidation_score: computed importance score (0-1)
 */

import { Migration } from '@mikro-orm/migrations';

export class Migration20260124000006_AddMemoryTiering extends Migration {
  override async up(): Promise<void> {
    // Add memory tier column with default
    this.addSql(`
      ALTER TABLE observations ADD COLUMN memory_tier TEXT DEFAULT 'working';
    `);

    // Add tier change tracking
    this.addSql(`
      ALTER TABLE observations ADD COLUMN tier_changed_at TEXT;
    `);

    // Add access tracking
    this.addSql(`
      ALTER TABLE observations ADD COLUMN access_count INTEGER DEFAULT 0;
    `);

    this.addSql(`
      ALTER TABLE observations ADD COLUMN last_accessed_at TEXT;
    `);

    this.addSql(`
      ALTER TABLE observations ADD COLUMN last_accessed_at_epoch INTEGER;
    `);

    // Add consolidation score
    this.addSql(`
      ALTER TABLE observations ADD COLUMN consolidation_score REAL;
    `);

    // Add index for tier queries
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_observations_memory_tier
      ON observations(memory_tier, project);
    `);

    // Add index for access queries
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_observations_last_accessed
      ON observations(last_accessed_at_epoch, access_count);
    `);
  }

  override async down(): Promise<void> {
    // SQLite doesn't support DROP COLUMN, just drop indexes
    this.addSql('DROP INDEX IF EXISTS idx_observations_memory_tier');
    this.addSql('DROP INDEX IF EXISTS idx_observations_last_accessed');
  }
}

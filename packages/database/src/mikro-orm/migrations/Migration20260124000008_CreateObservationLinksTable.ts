/**
 * Migration: Create observation_links table
 *
 * Enables linking observations together with typed relationships.
 */

import { Migration } from '@mikro-orm/migrations';

export class Migration20260124000008_CreateObservationLinksTable extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS observation_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL,
        target_id INTEGER NOT NULL,
        link_type TEXT NOT NULL DEFAULT 'related',
        description TEXT,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY (source_id) REFERENCES observations(id) ON DELETE CASCADE,
        FOREIGN KEY (target_id) REFERENCES observations(id) ON DELETE CASCADE
      );
    `);

    // Index for fast lookups
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_observation_links_source ON observation_links(source_id);
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_observation_links_target ON observation_links(target_id);
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_observation_links_type ON observation_links(link_type);
    `);

    // Unique constraint to prevent duplicate links
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_observation_links_unique
      ON observation_links(source_id, target_id, link_type);
    `);
  }

  async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS observation_links;');
  }
}

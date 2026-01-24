/**
 * Migration: Create project_settings table
 *
 * Enables project-scoped storage for settings and metadata.
 */

import { Migration } from '@mikro-orm/migrations';

export class Migration20260124000010_CreateProjectSettingsTable extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS project_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL UNIQUE,
        display_name TEXT,
        description TEXT,
        settings TEXT DEFAULT '{}',
        metadata TEXT DEFAULT '{}',
        observation_count INTEGER DEFAULT 0,
        session_count INTEGER DEFAULT 0,
        last_activity_epoch INTEGER,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        updated_at TEXT,
        updated_at_epoch INTEGER
      );
    `);

    // Index for fast lookups
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_project_settings_project ON project_settings(project);
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_project_settings_last_activity ON project_settings(last_activity_epoch);
    `);
  }

  async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS project_settings;');
  }
}

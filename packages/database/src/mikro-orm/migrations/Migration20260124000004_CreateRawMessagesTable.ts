/**
 * Migration: Create Raw Messages Table
 *
 * Adds table for Lazy Mode - storing raw messages without AI processing.
 */

import { Migration } from '@mikro-orm/migrations';

export class Migration20260124000004_CreateRawMessagesTable extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS raw_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        project TEXT NOT NULL,
        prompt_number INTEGER,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_calls TEXT,
        tool_name TEXT,
        tool_input TEXT,
        tool_output TEXT,
        processed INTEGER DEFAULT 0,
        processed_at TEXT,
        processed_at_epoch INTEGER,
        observation_id INTEGER,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL
      )
    `);

    this.addSql('CREATE INDEX IF NOT EXISTS idx_raw_messages_session ON raw_messages(session_id)');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_raw_messages_project ON raw_messages(project)');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_raw_messages_processed ON raw_messages(processed)');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_raw_messages_created ON raw_messages(created_at_epoch)');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_raw_messages_unprocessed ON raw_messages(processed, created_at_epoch) WHERE processed = 0');
  }

  override async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS raw_messages');
  }
}

/**
 * MikroORM Migration: FTS5 Full-Text Search Indexes
 *
 * SQLite-specific FTS5 virtual tables and triggers.
 * These will only work with SQLite databases.
 */

import { Migration } from '@mikro-orm/migrations';

export class Migration20240101000002_FTS5Indexes extends Migration {
  async up(): Promise<void> {
    // Check if we're using SQLite (FTS5 is SQLite-specific)
    const driverName = this.driver?.constructor?.name || '';
    if (!driverName.includes('Sqlite') && !driverName.includes('BetterSqlite')) {
      console.log('Skipping FTS5 migration - not on SQLite');
      return;
    }

    // Observations FTS5
    this.addSql(`
      CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
        title,
        text,
        concept,
        content='observations',
        content_rowid='id'
      )
    `);

    this.addSql(`
      CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
        INSERT INTO observations_fts(rowid, title, text, concept)
        VALUES (new.id, new.title, new.text, new.concept);
      END
    `);

    this.addSql(`
      CREATE TRIGGER IF NOT EXISTS observations_ad AFTER DELETE ON observations BEGIN
        INSERT INTO observations_fts(observations_fts, rowid, title, text, concept)
        VALUES ('delete', old.id, old.title, old.text, old.concept);
      END
    `);

    this.addSql(`
      CREATE TRIGGER IF NOT EXISTS observations_au AFTER UPDATE ON observations BEGIN
        INSERT INTO observations_fts(observations_fts, rowid, title, text, concept)
        VALUES ('delete', old.id, old.title, old.text, old.concept);
        INSERT INTO observations_fts(rowid, title, text, concept)
        VALUES (new.id, new.title, new.text, new.concept);
      END
    `);

    // Populate FTS with existing data
    this.addSql(`
      INSERT OR IGNORE INTO observations_fts(rowid, title, text, concept)
      SELECT id, title, text, concept FROM observations
    `);

    // Documents FTS5
    this.addSql(`
      CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
        title,
        content,
        source,
        content='documents',
        content_rowid='id'
      )
    `);

    this.addSql(`
      CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
        INSERT INTO documents_fts(rowid, title, content, source)
        VALUES (new.id, new.title, new.content, new.source);
      END
    `);

    this.addSql(`
      CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
        INSERT INTO documents_fts(documents_fts, rowid, title, content, source)
        VALUES ('delete', old.id, old.title, old.content, old.source);
      END
    `);

    this.addSql(`
      CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
        INSERT INTO documents_fts(documents_fts, rowid, title, content, source)
        VALUES ('delete', old.id, old.title, old.content, old.source);
        INSERT INTO documents_fts(rowid, title, content, source)
        VALUES (new.id, new.title, new.content, new.source);
      END
    `);

    // Populate FTS with existing data
    this.addSql(`
      INSERT OR IGNORE INTO documents_fts(rowid, title, content, source)
      SELECT id, title, content, source FROM documents
    `);
  }

  async down(): Promise<void> {
    // Drop triggers first
    this.addSql(`DROP TRIGGER IF EXISTS documents_au`);
    this.addSql(`DROP TRIGGER IF EXISTS documents_ad`);
    this.addSql(`DROP TRIGGER IF EXISTS documents_ai`);
    this.addSql(`DROP TABLE IF EXISTS documents_fts`);

    this.addSql(`DROP TRIGGER IF EXISTS observations_au`);
    this.addSql(`DROP TRIGGER IF EXISTS observations_ad`);
    this.addSql(`DROP TRIGGER IF EXISTS observations_ai`);
    this.addSql(`DROP TABLE IF EXISTS observations_fts`);
  }
}

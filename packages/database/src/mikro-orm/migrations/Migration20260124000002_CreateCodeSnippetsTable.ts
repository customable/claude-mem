/**
 * MikroORM Migration: Create code_snippets table
 *
 * Stores extracted code snippets from observations
 * for better code search and indexing.
 */

import { Migration } from '@mikro-orm/migrations';

export class Migration20260124000002_CreateCodeSnippetsTable extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE code_snippets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        observation_id INTEGER NOT NULL,
        memory_session_id TEXT NOT NULL,
        project TEXT NOT NULL,
        language TEXT,
        code TEXT NOT NULL,
        file_path TEXT,
        line_start INTEGER,
        line_end INTEGER,
        context TEXT,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY (observation_id) REFERENCES observations(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    this.addSql(`CREATE INDEX idx_code_snippets_observation ON code_snippets(observation_id)`);
    this.addSql(`CREATE INDEX idx_code_snippets_session ON code_snippets(memory_session_id)`);
    this.addSql(`CREATE INDEX idx_code_snippets_project ON code_snippets(project)`);
    this.addSql(`CREATE INDEX idx_code_snippets_language ON code_snippets(language)`);
    this.addSql(`CREATE INDEX idx_code_snippets_file_path ON code_snippets(file_path)`);

    // FTS5 virtual table for code search
    this.addSql(`
      CREATE VIRTUAL TABLE code_snippets_fts USING fts5(
        code,
        context,
        content='code_snippets',
        content_rowid='id'
      )
    `);

    // Triggers to keep FTS in sync
    this.addSql(`
      CREATE TRIGGER code_snippets_ai AFTER INSERT ON code_snippets BEGIN
        INSERT INTO code_snippets_fts(rowid, code, context)
        VALUES (new.id, new.code, new.context);
      END
    `);

    this.addSql(`
      CREATE TRIGGER code_snippets_ad AFTER DELETE ON code_snippets BEGIN
        INSERT INTO code_snippets_fts(code_snippets_fts, rowid, code, context)
        VALUES ('delete', old.id, old.code, old.context);
      END
    `);

    this.addSql(`
      CREATE TRIGGER code_snippets_au AFTER UPDATE ON code_snippets BEGIN
        INSERT INTO code_snippets_fts(code_snippets_fts, rowid, code, context)
        VALUES ('delete', old.id, old.code, old.context);
        INSERT INTO code_snippets_fts(rowid, code, context)
        VALUES (new.id, new.code, new.context);
      END
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TRIGGER IF EXISTS code_snippets_au`);
    this.addSql(`DROP TRIGGER IF EXISTS code_snippets_ad`);
    this.addSql(`DROP TRIGGER IF EXISTS code_snippets_ai`);
    this.addSql(`DROP TABLE IF EXISTS code_snippets_fts`);
    this.addSql(`DROP TABLE IF EXISTS code_snippets`);
  }
}

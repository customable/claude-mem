import { Migration } from '@mikro-orm/migrations';

export class Migration20260125100500_fts5_and_repositories extends Migration {

  override async up(): Promise<void> {
    // FTS5 virtual table for observations full-text search
    this.addSql(`
      CREATE VIRTUAL TABLE observations_fts USING fts5(
        title,
        text,
        narrative,
        concepts,
        facts,
        content='observations',
        content_rowid='id'
      );
    `);

    // Populate FTS5 index from existing data
    this.addSql(`
      INSERT INTO observations_fts(rowid, title, text, narrative, concepts, facts)
      SELECT id, title, text, narrative, concepts, facts FROM observations;
    `);

    // Triggers to keep FTS5 in sync
    this.addSql(`
      CREATE TRIGGER observations_ai AFTER INSERT ON observations BEGIN
        INSERT INTO observations_fts(rowid, title, text, narrative, concepts, facts)
        VALUES (NEW.id, NEW.title, NEW.text, NEW.narrative, NEW.concepts, NEW.facts);
      END;
    `);

    this.addSql(`
      CREATE TRIGGER observations_ad AFTER DELETE ON observations BEGIN
        INSERT INTO observations_fts(observations_fts, rowid, title, text, narrative, concepts, facts)
        VALUES ('delete', OLD.id, OLD.title, OLD.text, OLD.narrative, OLD.concepts, OLD.facts);
      END;
    `);

    this.addSql(`
      CREATE TRIGGER observations_au AFTER UPDATE ON observations BEGIN
        INSERT INTO observations_fts(observations_fts, rowid, title, text, narrative, concepts, facts)
        VALUES ('delete', OLD.id, OLD.title, OLD.text, OLD.narrative, OLD.concepts, OLD.facts);
        INSERT INTO observations_fts(rowid, title, text, narrative, concepts, facts)
        VALUES (NEW.id, NEW.title, NEW.text, NEW.narrative, NEW.concepts, NEW.facts);
      END;
    `);

    // FTS5 virtual table for documents full-text search
    this.addSql(`
      CREATE VIRTUAL TABLE documents_fts USING fts5(
        title,
        content,
        content='documents',
        content_rowid='id'
      );
    `);

    // Populate FTS5 index from existing data
    this.addSql(`
      INSERT INTO documents_fts(rowid, title, content)
      SELECT id, title, content FROM documents;
    `);

    // Triggers for documents
    this.addSql(`
      CREATE TRIGGER documents_ai AFTER INSERT ON documents BEGIN
        INSERT INTO documents_fts(rowid, title, content)
        VALUES (NEW.id, NEW.title, NEW.content);
      END;
    `);

    this.addSql(`
      CREATE TRIGGER documents_ad AFTER DELETE ON documents BEGIN
        INSERT INTO documents_fts(documents_fts, rowid, title, content)
        VALUES ('delete', OLD.id, OLD.title, OLD.content);
      END;
    `);

    this.addSql(`
      CREATE TRIGGER documents_au AFTER UPDATE ON documents BEGIN
        INSERT INTO documents_fts(documents_fts, rowid, title, content)
        VALUES ('delete', OLD.id, OLD.title, OLD.content);
        INSERT INTO documents_fts(rowid, title, content)
        VALUES (NEW.id, NEW.title, NEW.content);
      END;
    `);

    // Repositories table
    this.addSql(`
      CREATE TABLE repositories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_path TEXT NOT NULL UNIQUE,
        remote_url TEXT,
        name TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        last_seen_epoch INTEGER NOT NULL
      );
    `);
    this.addSql(`CREATE INDEX repositories_repo_path_index ON repositories (repo_path);`);
    this.addSql(`CREATE INDEX repositories_name_index ON repositories (name);`);
    this.addSql(`CREATE INDEX repositories_last_seen_epoch_index ON repositories (last_seen_epoch);`);
  }

  override async down(): Promise<void> {
    // Drop triggers
    this.addSql(`DROP TRIGGER IF EXISTS observations_ai;`);
    this.addSql(`DROP TRIGGER IF EXISTS observations_ad;`);
    this.addSql(`DROP TRIGGER IF EXISTS observations_au;`);
    this.addSql(`DROP TRIGGER IF EXISTS documents_ai;`);
    this.addSql(`DROP TRIGGER IF EXISTS documents_ad;`);
    this.addSql(`DROP TRIGGER IF EXISTS documents_au;`);

    // Drop FTS5 tables
    this.addSql(`DROP TABLE IF EXISTS observations_fts;`);
    this.addSql(`DROP TABLE IF EXISTS documents_fts;`);

    // Drop repositories table
    this.addSql(`DROP TABLE IF EXISTS repositories;`);
  }
}

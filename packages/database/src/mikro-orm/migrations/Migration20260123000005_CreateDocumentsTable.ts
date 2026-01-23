/**
 * MikroORM Migration: Create documents table
 *
 * Stores cached MCP documentation (Context7, WebFetch, etc.)
 * for semantic search and reuse across sessions.
 */

import { Migration } from '@mikro-orm/migrations';

export class Migration20260123000005_CreateDocumentsTable extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL,
        source TEXT NOT NULL,
        source_tool TEXT NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL DEFAULT 'library-docs' CHECK(type IN ('library-docs', 'web-content', 'api-reference', 'code-example', 'tutorial', 'custom')),
        metadata TEXT,
        memory_session_id TEXT,
        observation_id INTEGER,
        access_count INTEGER NOT NULL DEFAULT 1,
        last_accessed_epoch INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL
      )
    `);

    // Create indexes
    this.addSql(`CREATE INDEX idx_documents_project ON documents(project)`);
    this.addSql(`CREATE INDEX idx_documents_source ON documents(source)`);
    this.addSql(`CREATE INDEX idx_documents_source_tool ON documents(source_tool)`);
    this.addSql(`CREATE INDEX idx_documents_content_hash ON documents(content_hash)`);
    this.addSql(`CREATE INDEX idx_documents_type ON documents(type)`);
    this.addSql(`CREATE INDEX idx_documents_last_accessed ON documents(last_accessed_epoch)`);
    this.addSql(`CREATE INDEX idx_documents_created_at ON documents(created_at_epoch)`);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS documents`);
  }
}

/**
 * SQLite Document Repository Implementation
 *
 * Stores documentation lookups from MCP tools (Context7, etc.)
 * for caching and semantic search.
 */

import type { Database, SQLQueryBindings } from 'bun:sqlite';
import type {
  IDocumentRepository,
  CreateDocumentInput,
  DocumentQueryFilters,
  QueryOptions,
  DocumentRecord,
} from '@claude-mem/types';

type BindingValue = SQLQueryBindings;

/**
 * SQLite implementation of IDocumentRepository
 */
export class SQLiteDocumentRepository implements IDocumentRepository {
  constructor(private db: Database) {}

  async create(input: CreateDocumentInput): Promise<DocumentRecord> {
    const now = new Date();
    const epoch = now.getTime();

    const result = this.db
      .query<{ id: number }, BindingValue[]>(`
        INSERT INTO documents (
          project, source, source_tool, title, content, content_hash, type,
          metadata, memory_session_id, observation_id, access_count,
          last_accessed_epoch, created_at, created_at_epoch
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `)
      .get(
        input.project,
        input.source,
        input.sourceTool,
        input.title || null,
        input.content,
        input.contentHash,
        input.type || 'library-docs',
        input.metadata ? JSON.stringify(input.metadata) : null,
        input.memorySessionId || null,
        input.observationId || null,
        1, // initial access_count
        epoch,
        now.toISOString(),
        epoch
      );

    return (await this.findById(result!.id))!;
  }

  async findById(id: number): Promise<DocumentRecord | null> {
    return this.db
      .query<DocumentRecord, [number]>('SELECT * FROM documents WHERE id = ?')
      .get(id) || null;
  }

  async findByHash(contentHash: string): Promise<DocumentRecord | null> {
    return this.db
      .query<DocumentRecord, [string]>('SELECT * FROM documents WHERE content_hash = ?')
      .get(contentHash) || null;
  }

  async update(id: number, input: Partial<CreateDocumentInput>): Promise<DocumentRecord | null> {
    const updates: string[] = [];
    const values: BindingValue[] = [];

    if (input.title !== undefined) {
      updates.push('title = ?');
      values.push(input.title || null);
    }
    if (input.content !== undefined) {
      updates.push('content = ?');
      values.push(input.content);
    }
    if (input.type !== undefined) {
      updates.push('type = ?');
      values.push(input.type);
    }
    if (input.metadata !== undefined) {
      updates.push('metadata = ?');
      values.push(input.metadata ? JSON.stringify(input.metadata) : null);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    this.db.query(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return this.findById(id);
  }

  async recordAccess(id: number): Promise<DocumentRecord | null> {
    const now = Date.now();
    this.db.query(`
      UPDATE documents
      SET access_count = access_count + 1, last_accessed_epoch = ?
      WHERE id = ?
    `).run(now, id);

    return this.findById(id);
  }

  async list(filters?: DocumentQueryFilters, options?: QueryOptions): Promise<DocumentRecord[]> {
    let sql = 'SELECT * FROM documents WHERE 1=1';
    const params: BindingValue[] = [];

    if (filters?.project) {
      sql += ' AND project = ?';
      params.push(filters.project);
    }
    if (filters?.source) {
      sql += ' AND source = ?';
      params.push(filters.source);
    }
    if (filters?.sourceTool) {
      sql += ' AND source_tool = ?';
      params.push(filters.sourceTool);
    }
    if (filters?.type) {
      if (Array.isArray(filters.type)) {
        sql += ` AND type IN (${filters.type.map(() => '?').join(', ')})`;
        params.push(...filters.type);
      } else {
        sql += ' AND type = ?';
        params.push(filters.type);
      }
    }
    if (filters?.dateRange?.start) {
      const epoch = typeof filters.dateRange.start === 'number'
        ? filters.dateRange.start
        : filters.dateRange.start.getTime();
      sql += ' AND created_at_epoch >= ?';
      params.push(epoch);
    }
    if (filters?.dateRange?.end) {
      const epoch = typeof filters.dateRange.end === 'number'
        ? filters.dateRange.end
        : filters.dateRange.end.getTime();
      sql += ' AND created_at_epoch <= ?';
      params.push(epoch);
    }

    sql += ` ORDER BY ${options?.orderBy || 'created_at_epoch'} ${options?.order || 'DESC'}`;

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    if (options?.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    return this.db.query<DocumentRecord, BindingValue[]>(sql).all(...params);
  }

  async count(filters?: DocumentQueryFilters): Promise<number> {
    let sql = 'SELECT COUNT(*) as count FROM documents WHERE 1=1';
    const params: BindingValue[] = [];

    if (filters?.project) {
      sql += ' AND project = ?';
      params.push(filters.project);
    }
    if (filters?.source) {
      sql += ' AND source = ?';
      params.push(filters.source);
    }
    if (filters?.sourceTool) {
      sql += ' AND source_tool = ?';
      params.push(filters.sourceTool);
    }
    if (filters?.type) {
      if (Array.isArray(filters.type)) {
        sql += ` AND type IN (${filters.type.map(() => '?').join(', ')})`;
        params.push(...filters.type);
      } else {
        sql += ' AND type = ?';
        params.push(filters.type);
      }
    }

    const result = this.db.query<{ count: number }, BindingValue[]>(sql).get(...params);
    return result?.count || 0;
  }

  /**
   * Sanitize a query string for FTS5 MATCH
   */
  private sanitizeFts5Query(query: string): string {
    const specialChars = /[-+*:()^"]/;
    const words = query.split(/\s+/).filter(Boolean);

    return words.map(word => {
      if (specialChars.test(word)) {
        const escaped = word.replace(/"/g, '""');
        return `"${escaped}"`;
      }
      return word;
    }).join(' ');
  }

  async search(
    query: string,
    filters?: DocumentQueryFilters,
    options?: QueryOptions
  ): Promise<DocumentRecord[]> {
    const sanitizedQuery = this.sanitizeFts5Query(query);

    let sql = `
      SELECT d.* FROM documents d
      JOIN documents_fts fts ON d.id = fts.rowid
      WHERE documents_fts MATCH ?
    `;
    const params: BindingValue[] = [sanitizedQuery];

    if (filters?.project) {
      sql += ' AND d.project = ?';
      params.push(filters.project);
    }
    if (filters?.sourceTool) {
      sql += ' AND d.source_tool = ?';
      params.push(filters.sourceTool);
    }
    if (filters?.type) {
      if (Array.isArray(filters.type)) {
        sql += ` AND d.type IN (${filters.type.map(() => '?').join(', ')})`;
        params.push(...filters.type);
      } else {
        sql += ' AND d.type = ?';
        params.push(filters.type);
      }
    }

    sql += ` ORDER BY ${options?.orderBy === 'relevance' ? 'rank' : 'd.created_at_epoch'} ${options?.order || 'DESC'}`;

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    if (options?.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    return this.db.query<DocumentRecord, BindingValue[]>(sql).all(...params);
  }

  async getByProject(project: string, options?: QueryOptions): Promise<DocumentRecord[]> {
    return this.list({ project }, options);
  }

  async getBySourceTool(sourceTool: string, options?: QueryOptions): Promise<DocumentRecord[]> {
    return this.list({ sourceTool }, options);
  }

  async getFrequentlyAccessed(limit: number): Promise<DocumentRecord[]> {
    return this.db
      .query<DocumentRecord, [number]>(`
        SELECT * FROM documents
        ORDER BY access_count DESC, last_accessed_epoch DESC
        LIMIT ?
      `)
      .all(limit);
  }

  async delete(id: number): Promise<boolean> {
    const result = this.db.query('DELETE FROM documents WHERE id = ?').run(id);
    return result.changes > 0;
  }

  async cleanupOld(olderThanDays: number, minAccessCount: number): Promise<number> {
    const cutoffEpoch = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const result = this.db.query(`
      DELETE FROM documents
      WHERE last_accessed_epoch < ? AND access_count < ?
    `).run(cutoffEpoch, minAccessCount);
    return result.changes;
  }
}

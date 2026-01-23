/**
 * SQLite Observation Repository Implementation
 */

import type { Database, SQLQueryBindings } from 'bun:sqlite';
import type {
  IObservationRepository,
  CreateObservationInput,
  ObservationQueryFilters,
  QueryOptions,
  ObservationRecord,
} from '@claude-mem/types';

type BindingValue = SQLQueryBindings;

/**
 * SQLite implementation of IObservationRepository
 */
export class SQLiteObservationRepository implements IObservationRepository {
  constructor(private db: Database) {}

  async create(input: CreateObservationInput): Promise<ObservationRecord> {
    const now = new Date();
    const epoch = now.getTime();

    const result = this.db
      .query<{ id: number }, BindingValue[]>(`
        INSERT INTO observations (
          memory_session_id, project, text, type, title, concepts,
          files_read, files_modified, prompt_number, discovery_tokens,
          subtitle, facts, narrative, git_branch,
          created_at, created_at_epoch
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `)
      .get(
        input.memorySessionId,
        input.project,
        input.text,
        input.type,
        input.title || null,
        input.concepts || null,
        input.filesRead || null,
        input.filesModified || null,
        input.promptNumber || null,
        input.discoveryTokens || null,
        input.subtitle || null,
        input.facts || null,
        input.narrative || null,
        input.gitBranch || null,
        now.toISOString(),
        epoch
      );

    return (await this.findById(result!.id))!;
  }

  async findById(id: number): Promise<ObservationRecord | null> {
    return this.db
      .query<ObservationRecord, [number]>('SELECT * FROM observations WHERE id = ?')
      .get(id) || null;
  }

  async update(id: number, input: Partial<CreateObservationInput>): Promise<ObservationRecord | null> {
    const updates: string[] = [];
    const values: BindingValue[] = [];

    if (input.text !== undefined) {
      updates.push('text = ?');
      values.push(input.text);
    }
    if (input.type !== undefined) {
      updates.push('type = ?');
      values.push(input.type);
    }
    if (input.title !== undefined) {
      updates.push('title = ?');
      values.push(input.title);
    }
    if (input.subtitle !== undefined) {
      updates.push('subtitle = ?');
      values.push(input.subtitle);
    }
    if (input.concepts !== undefined) {
      updates.push('concepts = ?');
      values.push(input.concepts);
    }
    if (input.facts !== undefined) {
      updates.push('facts = ?');
      values.push(input.facts);
    }
    if (input.narrative !== undefined) {
      updates.push('narrative = ?');
      values.push(input.narrative);
    }
    if (input.filesRead !== undefined) {
      updates.push('files_read = ?');
      values.push(input.filesRead);
    }
    if (input.filesModified !== undefined) {
      updates.push('files_modified = ?');
      values.push(input.filesModified);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    this.db.query(`UPDATE observations SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return this.findById(id);
  }

  async list(filters?: ObservationQueryFilters, options?: QueryOptions): Promise<ObservationRecord[]> {
    let sql = 'SELECT * FROM observations WHERE 1=1';
    const params: BindingValue[] = [];

    if (filters?.project) {
      sql += ' AND project = ?';
      params.push(filters.project);
    }
    if (filters?.sessionId) {
      sql += ' AND memory_session_id = ?';
      params.push(filters.sessionId);
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

    return this.db.query<ObservationRecord, BindingValue[]>(sql).all(...params);
  }

  async count(filters?: ObservationQueryFilters): Promise<number> {
    let sql = 'SELECT COUNT(*) as count FROM observations WHERE 1=1';
    const params: BindingValue[] = [];

    if (filters?.project) {
      sql += ' AND project = ?';
      params.push(filters.project);
    }
    if (filters?.sessionId) {
      sql += ' AND memory_session_id = ?';
      params.push(filters.sessionId);
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

  async search(
    query: string,
    filters?: ObservationQueryFilters,
    options?: QueryOptions
  ): Promise<ObservationRecord[]> {
    // Use FTS5 for full-text search
    let sql = `
      SELECT o.* FROM observations o
      JOIN observations_fts fts ON o.id = fts.rowid
      WHERE observations_fts MATCH ?
    `;
    const params: BindingValue[] = [query];

    if (filters?.project) {
      sql += ' AND o.project = ?';
      params.push(filters.project);
    }
    if (filters?.type) {
      if (Array.isArray(filters.type)) {
        sql += ` AND o.type IN (${filters.type.map(() => '?').join(', ')})`;
        params.push(...filters.type);
      } else {
        sql += ' AND o.type = ?';
        params.push(filters.type);
      }
    }

    sql += ` ORDER BY ${options?.orderBy === 'relevance' ? 'rank' : 'o.created_at_epoch'} ${options?.order || 'DESC'}`;

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    if (options?.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    return this.db.query<ObservationRecord, BindingValue[]>(sql).all(...params);
  }

  async getBySessionId(memorySessionId: string, options?: QueryOptions): Promise<ObservationRecord[]> {
    return this.list({ sessionId: memorySessionId }, options);
  }

  async getForContext(project: string, limit: number): Promise<ObservationRecord[]> {
    return this.db
      .query<ObservationRecord, [string, number]>(`
        SELECT * FROM observations
        WHERE project = ?
        ORDER BY created_at_epoch DESC
        LIMIT ?
      `)
      .all(project, limit);
  }

  async delete(id: number): Promise<boolean> {
    const result = this.db.query('DELETE FROM observations WHERE id = ?').run(id);
    return result.changes > 0;
  }

  async deleteBySessionId(memorySessionId: string): Promise<number> {
    const result = this.db
      .query('DELETE FROM observations WHERE memory_session_id = ?')
      .run(memorySessionId);
    return result.changes;
  }
}

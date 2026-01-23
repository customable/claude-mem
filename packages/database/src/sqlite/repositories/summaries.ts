/**
 * SQLite Summary Repository Implementation
 */

import type { Database, SQLQueryBindings } from 'bun:sqlite';
import type {
  ISummaryRepository,
  CreateSummaryInput,
  SummaryQueryFilters,
  QueryOptions,
  SessionSummaryRecord,
} from '@claude-mem/types';

type BindingValue = SQLQueryBindings;

/**
 * SQLite implementation of ISummaryRepository
 */
export class SQLiteSummaryRepository implements ISummaryRepository {
  constructor(private db: Database) {}

  async create(input: CreateSummaryInput): Promise<SessionSummaryRecord> {
    const now = new Date();
    const epoch = now.getTime();

    const result = this.db
      .query<{ id: number }, BindingValue[]>(`
        INSERT INTO summaries (
          memory_session_id, project, request, investigated, learned,
          completed, next_steps, prompt_number, discovery_tokens,
          created_at, created_at_epoch
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `)
      .get(
        input.memorySessionId,
        input.project,
        input.request || null,
        input.investigated || null,
        input.learned || null,
        input.completed || null,
        input.nextSteps || null,
        input.promptNumber || null,
        input.discoveryTokens || null,
        now.toISOString(),
        epoch
      );

    return (await this.findById(result!.id))!;
  }

  async findById(id: number): Promise<SessionSummaryRecord | null> {
    return this.db
      .query<SessionSummaryRecord, [number]>('SELECT * FROM summaries WHERE id = ?')
      .get(id) || null;
  }

  async update(id: number, input: Partial<CreateSummaryInput>): Promise<SessionSummaryRecord | null> {
    const updates: string[] = [];
    const values: BindingValue[] = [];

    const fields: Array<[keyof CreateSummaryInput, string]> = [
      ['request', 'request'],
      ['investigated', 'investigated'],
      ['learned', 'learned'],
      ['completed', 'completed'],
      ['nextSteps', 'next_steps'],
    ];

    for (const [key, column] of fields) {
      if (input[key] !== undefined) {
        updates.push(`${column} = ?`);
        values.push(input[key]);
      }
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    this.db.query(`UPDATE summaries SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return this.findById(id);
  }

  async list(filters?: SummaryQueryFilters, options?: QueryOptions): Promise<SessionSummaryRecord[]> {
    let sql = 'SELECT * FROM summaries WHERE 1=1';
    const params: BindingValue[] = [];

    if (filters?.project) {
      sql += ' AND project = ?';
      params.push(filters.project);
    }
    if (filters?.sessionId) {
      sql += ' AND memory_session_id = ?';
      params.push(filters.sessionId);
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

    return this.db.query<SessionSummaryRecord, BindingValue[]>(sql).all(...params);
  }

  async getBySessionId(memorySessionId: string): Promise<SessionSummaryRecord[]> {
    return this.db
      .query<SessionSummaryRecord, [string]>(`
        SELECT * FROM summaries
        WHERE memory_session_id = ?
        ORDER BY created_at_epoch DESC
      `)
      .all(memorySessionId);
  }

  async getLatestForProject(project: string): Promise<SessionSummaryRecord | null> {
    return this.db
      .query<SessionSummaryRecord, [string]>(`
        SELECT * FROM summaries
        WHERE project = ?
        ORDER BY created_at_epoch DESC
        LIMIT 1
      `)
      .get(project) || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = this.db.query('DELETE FROM summaries WHERE id = ?').run(id);
    return result.changes > 0;
  }
}

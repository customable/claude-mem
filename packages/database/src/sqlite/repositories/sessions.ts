/**
 * SQLite Session Repository Implementation
 */

import type { Database, SQLQueryBindings } from 'bun:sqlite';
import type {
  ISessionRepository,
  CreateSessionInput,
  UpdateSessionInput,
  SessionQueryFilters,
  QueryOptions,
  SdkSessionRecord,
} from '@claude-mem/types';

type BindingValue = SQLQueryBindings;

/**
 * SQLite implementation of ISessionRepository
 */
export class SQLiteSessionRepository implements ISessionRepository {
  constructor(private db: Database) {}

  async create(input: CreateSessionInput): Promise<SdkSessionRecord> {
    const now = new Date();
    const epoch = now.getTime();

    const result = this.db
      .query<{ id: number }, [string, string | null, string, string | null, string, number]>(`
        INSERT INTO sdk_sessions (content_session_id, memory_session_id, project, user_prompt, started_at, started_at_epoch)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id
      `)
      .get(
        input.contentSessionId,
        input.memorySessionId || null,
        input.project,
        input.userPrompt || null,
        now.toISOString(),
        epoch
      );

    return (await this.findById(result!.id))!;
  }

  async findById(id: number): Promise<SdkSessionRecord | null> {
    return this.db
      .query<SdkSessionRecord, [number]>('SELECT * FROM sdk_sessions WHERE id = ?')
      .get(id) || null;
  }

  async findByContentSessionId(contentSessionId: string): Promise<SdkSessionRecord | null> {
    return this.db
      .query<SdkSessionRecord, [string]>('SELECT * FROM sdk_sessions WHERE content_session_id = ?')
      .get(contentSessionId) || null;
  }

  async findByMemorySessionId(memorySessionId: string): Promise<SdkSessionRecord | null> {
    return this.db
      .query<SdkSessionRecord, [string]>('SELECT * FROM sdk_sessions WHERE memory_session_id = ?')
      .get(memorySessionId) || null;
  }

  async update(id: number, input: UpdateSessionInput): Promise<SdkSessionRecord | null> {
    const updates: string[] = [];
    const values: BindingValue[] = [];

    if (input.status !== undefined) {
      updates.push('status = ?');
      values.push(input.status);
    }
    if (input.completedAt !== undefined) {
      const date = typeof input.completedAt === 'number' ? new Date(input.completedAt) : input.completedAt;
      updates.push('completed_at = ?', 'completed_at_epoch = ?');
      values.push(date.toISOString(), date.getTime());
    }
    if (input.promptCounter !== undefined) {
      updates.push('prompt_counter = ?');
      values.push(input.promptCounter);
    }
    if (input.memorySessionId !== undefined) {
      updates.push('memory_session_id = ?');
      values.push(input.memorySessionId);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    this.db.query(`UPDATE sdk_sessions SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return this.findById(id);
  }

  async list(filters?: SessionQueryFilters, options?: QueryOptions): Promise<SdkSessionRecord[]> {
    let sql = 'SELECT * FROM sdk_sessions WHERE 1=1';
    const params: BindingValue[] = [];

    if (filters?.project) {
      sql += ' AND project = ?';
      params.push(filters.project);
    }
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        sql += ` AND status IN (${filters.status.map(() => '?').join(', ')})`;
        params.push(...filters.status);
      } else {
        sql += ' AND status = ?';
        params.push(filters.status);
      }
    }
    if (filters?.dateRange?.start) {
      const epoch = typeof filters.dateRange.start === 'number'
        ? filters.dateRange.start
        : filters.dateRange.start.getTime();
      sql += ' AND started_at_epoch >= ?';
      params.push(epoch);
    }
    if (filters?.dateRange?.end) {
      const epoch = typeof filters.dateRange.end === 'number'
        ? filters.dateRange.end
        : filters.dateRange.end.getTime();
      sql += ' AND started_at_epoch <= ?';
      params.push(epoch);
    }

    sql += ` ORDER BY ${options?.orderBy || 'started_at_epoch'} ${options?.order || 'DESC'}`;

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    if (options?.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    return this.db.query<SdkSessionRecord, BindingValue[]>(sql).all(...params);
  }

  async count(filters?: SessionQueryFilters): Promise<number> {
    let sql = 'SELECT COUNT(*) as count FROM sdk_sessions WHERE 1=1';
    const params: BindingValue[] = [];

    if (filters?.project) {
      sql += ' AND project = ?';
      params.push(filters.project);
    }
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        sql += ` AND status IN (${filters.status.map(() => '?').join(', ')})`;
        params.push(...filters.status);
      } else {
        sql += ' AND status = ?';
        params.push(filters.status);
      }
    }

    const result = this.db.query<{ count: number }, BindingValue[]>(sql).get(...params);
    return result?.count || 0;
  }

  async getActiveSession(project: string): Promise<SdkSessionRecord | null> {
    return this.db
      .query<SdkSessionRecord, [string]>(`
        SELECT * FROM sdk_sessions
        WHERE project = ? AND status = 'active'
        ORDER BY started_at_epoch DESC
        LIMIT 1
      `)
      .get(project) || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = this.db.query('DELETE FROM sdk_sessions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  async getDistinctProjects(): Promise<string[]> {
    const results = this.db
      .query<{ project: string }, []>('SELECT DISTINCT project FROM sdk_sessions ORDER BY project')
      .all();
    return results.map(r => r.project);
  }
}

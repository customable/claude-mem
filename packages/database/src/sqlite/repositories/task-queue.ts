/**
 * SQLite Task Queue Repository Implementation
 */

import type { Database, SQLQueryBindings } from 'bun:sqlite';
import type {
  ITaskQueueRepository,
  TaskQueryFilters,
  QueryOptions,
  Task,
  TaskStatus,
  CreateTaskInput,
} from '@claude-mem/types';

type BindingValue = SQLQueryBindings;
import { randomUUID } from 'crypto';

/**
 * Task row from database (JSON fields need parsing)
 */
interface TaskRow {
  id: string;
  type: string;
  status: string;
  required_capability: string;
  fallback_capabilities: string | null;
  priority: number;
  payload: string;
  result: string | null;
  error: string | null;
  retry_count: number;
  max_retries: number;
  assigned_worker_id: string | null;
  created_at: number;
  assigned_at: number | null;
  completed_at: number | null;
}

/**
 * Convert database row to Task object
 */
function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    type: row.type as Task['type'],
    status: row.status as TaskStatus,
    requiredCapability: row.required_capability,
    fallbackCapabilities: row.fallback_capabilities
      ? JSON.parse(row.fallback_capabilities)
      : undefined,
    priority: row.priority,
    payload: JSON.parse(row.payload),
    result: row.result ? JSON.parse(row.result) : undefined,
    error: row.error || undefined,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    assignedWorkerId: row.assigned_worker_id || undefined,
    createdAt: row.created_at,
    assignedAt: row.assigned_at || undefined,
    completedAt: row.completed_at || undefined,
  } as Task;
}

/**
 * SQLite implementation of ITaskQueueRepository
 */
export class SQLiteTaskQueueRepository implements ITaskQueueRepository {
  constructor(private db: Database) {}

  async create<T extends Task>(input: CreateTaskInput<T>): Promise<T> {
    const id = randomUUID();
    const now = Date.now();

    this.db
      .query(`
        INSERT INTO task_queue (
          id, type, status, required_capability, fallback_capabilities,
          priority, payload, retry_count, max_retries, created_at
        )
        VALUES (?, ?, 'pending', ?, ?, ?, ?, 0, ?, ?)
      `)
      .run(
        id,
        input.type,
        input.requiredCapability,
        input.fallbackCapabilities ? JSON.stringify(input.fallbackCapabilities) : null,
        input.priority,
        JSON.stringify(input.payload),
        input.maxRetries,
        now
      );

    return (await this.findById(id)) as T;
  }

  async findById(id: string): Promise<Task | null> {
    const row = this.db
      .query<TaskRow, [string]>('SELECT * FROM task_queue WHERE id = ?')
      .get(id);
    return row ? rowToTask(row) : null;
  }

  async updateStatus(id: string, status: TaskStatus, extra?: Partial<Task>): Promise<Task | null> {
    const updates = ['status = ?'];
    const values: BindingValue[] = [status];

    if (status === 'completed' || status === 'failed') {
      updates.push('completed_at = ?');
      values.push(Date.now());
    }

    if (extra?.result !== undefined) {
      updates.push('result = ?');
      values.push(JSON.stringify(extra.result));
    }
    if (extra?.error !== undefined) {
      updates.push('error = ?');
      values.push(extra.error);
    }
    if (extra?.retryCount !== undefined) {
      updates.push('retry_count = ?');
      values.push(extra.retryCount);
    }

    values.push(id);
    this.db.query(`UPDATE task_queue SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return this.findById(id);
  }

  async assign(id: string, workerId: string): Promise<Task | null> {
    this.db
      .query(`
        UPDATE task_queue
        SET status = 'assigned', assigned_worker_id = ?, assigned_at = ?
        WHERE id = ? AND status = 'pending'
      `)
      .run(workerId, Date.now(), id);

    return this.findById(id);
  }

  async getNextPending(capabilities: string[]): Promise<Task | null> {
    // Find task where required_capability OR any fallback matches
    const placeholders = capabilities.map(() => '?').join(', ');

    const row = this.db
      .query<TaskRow, string[]>(`
        SELECT * FROM task_queue
        WHERE status = 'pending'
          AND (
            required_capability IN (${placeholders})
            OR EXISTS (
              SELECT 1 FROM json_each(fallback_capabilities)
              WHERE value IN (${placeholders})
            )
          )
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
      `)
      .get(...capabilities, ...capabilities);

    return row ? rowToTask(row) : null;
  }

  async list(filters?: TaskQueryFilters, options?: QueryOptions): Promise<Task[]> {
    let sql = 'SELECT * FROM task_queue WHERE 1=1';
    const params: BindingValue[] = [];

    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        sql += ` AND status IN (${filters.status.map(() => '?').join(', ')})`;
        params.push(...filters.status);
      } else {
        sql += ' AND status = ?';
        params.push(filters.status);
      }
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
    if (filters?.workerId) {
      sql += ' AND assigned_worker_id = ?';
      params.push(filters.workerId);
    }

    sql += ` ORDER BY ${options?.orderBy || 'created_at'} ${options?.order || 'DESC'}`;

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    if (options?.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const rows = this.db.query<TaskRow, BindingValue[]>(sql).all(...params);
    return rows.map(rowToTask);
  }

  async countByStatus(): Promise<Record<TaskStatus, number>> {
    const result: Record<TaskStatus, number> = {
      pending: 0,
      assigned: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      timeout: 0,
    };

    const rows = this.db
      .query<{ status: string; count: number }, []>(
        'SELECT status, COUNT(*) as count FROM task_queue GROUP BY status'
      )
      .all();

    for (const row of rows) {
      result[row.status as TaskStatus] = row.count;
    }

    return result;
  }

  async getByWorkerId(workerId: string): Promise<Task[]> {
    const rows = this.db
      .query<TaskRow, [string]>(`
        SELECT * FROM task_queue
        WHERE assigned_worker_id = ?
        ORDER BY created_at DESC
      `)
      .all(workerId);

    return rows.map(rowToTask);
  }

  async cleanup(olderThanMs: number): Promise<number> {
    const cutoff = Date.now() - olderThanMs;
    const result = this.db
      .query(`
        DELETE FROM task_queue
        WHERE status IN ('completed', 'failed')
          AND completed_at < ?
      `)
      .run(cutoff);

    return result.changes;
  }
}

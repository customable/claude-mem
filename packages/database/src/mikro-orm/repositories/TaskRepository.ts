/**
 * MikroORM Task Queue Repository
 *
 * Note: Some queries use raw SQL for SQLite-specific json_each() function.
 * For PostgreSQL/MySQL, these would need to use their JSON operators.
 */

import type { SqlEntityManager } from '@mikro-orm/knex';
import { randomUUID } from 'crypto';
import type {
  ITaskQueueRepository,
  TaskQueryFilters,
  QueryOptions,
  Task,
  TaskStatus,
  CreateTaskInput,
  TaskUpdateExtras,
} from '@claude-mem/types';
import { Task as TaskEntity } from '../../entities/Task.js';

/**
 * Convert Task entity to Task interface
 */
function toTask(entity: TaskEntity): Task {
  return {
    id: entity.id,
    type: entity.type,
    status: entity.status,
    requiredCapability: entity.required_capability,
    fallbackCapabilities: entity.fallback_capabilities
      ? JSON.parse(entity.fallback_capabilities)
      : undefined,
    priority: entity.priority,
    payload: JSON.parse(entity.payload),
    result: entity.result ? JSON.parse(entity.result) : undefined,
    error: entity.error || undefined,
    retryCount: entity.retry_count,
    maxRetries: entity.max_retries,
    assignedWorkerId: entity.assigned_worker_id || undefined,
    createdAt: entity.created_at,
    assignedAt: entity.assigned_at || undefined,
    completedAt: entity.completed_at || undefined,
    retryAfter: entity.retry_after || undefined,
  } as Task;
}

export class MikroOrmTaskRepository implements ITaskQueueRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async create<T extends Task>(input: CreateTaskInput<T>): Promise<T> {
    const id = randomUUID();
    const now = Date.now();

    const entity = this.em.create(TaskEntity, {
      id,
      type: input.type,
      status: 'pending',
      required_capability: input.requiredCapability,
      fallback_capabilities: input.fallbackCapabilities
        ? JSON.stringify(input.fallbackCapabilities)
        : undefined,
      priority: input.priority,
      payload: JSON.stringify(input.payload),
      retry_count: 0,
      max_retries: input.maxRetries,
      created_at: now,
    });

    this.em.persist(entity);
    await this.em.flush();
    return toTask(entity) as T;
  }

  async findById(id: string): Promise<Task | null> {
    const entity = await this.em.findOne(TaskEntity, { id });
    return entity ? toTask(entity) : null;
  }

  async updateStatus(id: string, status: TaskStatus, extra?: TaskUpdateExtras): Promise<Task | null> {
    const entity = await this.em.findOne(TaskEntity, { id });
    if (!entity) return null;

    entity.status = status;

    if (status === 'completed' || status === 'failed') {
      entity.completed_at = Date.now();
    }

    if (extra?.result !== undefined) {
      entity.result = JSON.stringify(extra.result);
    }
    if (extra?.error !== undefined) {
      entity.error = extra.error;
    }
    if (extra?.retryCount !== undefined) {
      entity.retry_count = extra.retryCount;
    }
    // Support for exponential backoff (Issue #206)
    if (extra?.retryAfter !== undefined) {
      entity.retry_after = extra.retryAfter;
    }

    await this.em.flush();
    return toTask(entity);
  }

  async assign(id: string, workerId: string): Promise<Task | null> {
    const entity = await this.em.findOne(TaskEntity, { id, status: 'pending' });
    if (!entity) return null;

    entity.status = 'assigned';
    entity.assigned_worker_id = workerId;
    entity.assigned_at = Date.now();

    await this.em.flush();
    return toTask(entity);
  }

  async getNextPending(capabilities: string[]): Promise<Task | null> {
    // This uses SQLite's json_each for capability matching
    // For other databases, this query would need modification
    const knex = this.em.getKnex();

    const placeholders = capabilities.map(() => '?').join(', ');
    const now = Date.now();

    const row = await knex('tasks')
      .where('status', 'pending')
      // Only get tasks that are ready to be retried (Issue #206)
      .where(function(this: ReturnType<typeof knex>) {
        this.whereNull('retry_after')
          .orWhere('retry_after', '<=', now);
      })
      .where(function(this: ReturnType<typeof knex>) {
        this.whereIn('required_capability', capabilities)
          .orWhereRaw(`EXISTS (
            SELECT 1 FROM json_each(fallback_capabilities)
            WHERE value IN (${placeholders})
          )`, capabilities);
      })
      .orderBy('priority', 'desc')
      .orderBy('created_at', 'asc')
      .first();

    if (!row) return null;

    // Convert row to entity
    const entity = await this.em.findOne(TaskEntity, { id: row.id });
    return entity ? toTask(entity) : null;
  }

  async list(filters?: TaskQueryFilters, options?: QueryOptions): Promise<Task[]> {
    const qb = this.em.createQueryBuilder(TaskEntity, 't');

    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        qb.andWhere({ status: { $in: filters.status } });
      } else {
        qb.andWhere({ status: filters.status });
      }
    }
    if (filters?.type) {
      if (Array.isArray(filters.type)) {
        qb.andWhere({ type: { $in: filters.type } });
      } else {
        qb.andWhere({ type: filters.type });
      }
    }
    if (filters?.workerId) {
      qb.andWhere({ assigned_worker_id: filters.workerId });
    }

    qb.orderBy({ [options?.orderBy || 'created_at']: options?.order || 'DESC' });

    if (options?.limit) qb.limit(options.limit);
    if (options?.offset) qb.offset(options.offset);

    const entities = await qb.getResult();
    return entities.map(toTask);
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

    const knex = this.em.getKnex();
    const rows = await knex('tasks')
      .select('status')
      .count('* as count')
      .groupBy('status');

    for (const row of rows) {
      result[row.status as TaskStatus] = Number(row.count);
    }

    return result;
  }

  async getByWorkerId(workerId: string): Promise<Task[]> {
    const entities = await this.em.find(
      TaskEntity,
      { assigned_worker_id: workerId },
      { orderBy: { created_at: 'DESC' } }
    );
    return entities.map(toTask);
  }

  async cleanup(olderThanMs: number): Promise<number> {
    const cutoff = Date.now() - olderThanMs;
    const result = await this.em.nativeDelete(TaskEntity, {
      status: { $in: ['completed', 'failed'] },
      completed_at: { $lt: cutoff },
    });
    return result;
  }

  /**
   * Batch update task status (Issue #204)
   * Efficiently updates multiple tasks at once
   */
  async batchUpdateStatus(ids: string[], status: TaskStatus): Promise<number> {
    if (ids.length === 0) return 0;

    const now = Date.now();
    const completedAt = (status === 'completed' || status === 'failed') ? now : undefined;

    // SQLite has a limit on IN clause (~999 items), chunk to be safe
    const chunkSize = 500;
    let totalUpdated = 0;

    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const result = await this.em.nativeUpdate(
        TaskEntity,
        { id: { $in: chunk } },
        {
          status,
          ...(completedAt ? { completed_at: completedAt } : {}),
        }
      );
      totalUpdated += result;
    }

    return totalUpdated;
  }
}

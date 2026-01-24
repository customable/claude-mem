/**
 * MikroORM Session Repository
 */

import type { EntityManager, SqlEntityManager } from '@mikro-orm/knex';
import type {
  ISessionRepository,
  CreateSessionInput,
  UpdateSessionInput,
  SessionQueryFilters,
  QueryOptions,
  SdkSessionRecord,
} from '@claude-mem/types';
import { Session } from '../../entities/Session.js';

/**
 * Convert Session entity to SdkSessionRecord
 */
function toRecord(entity: Session): SdkSessionRecord {
  return {
    id: entity.id,
    content_session_id: entity.content_session_id,
    memory_session_id: entity.memory_session_id ?? null,
    project: entity.project,
    user_prompt: entity.user_prompt ?? null,
    working_directory: entity.working_directory ?? null,
    started_at: entity.started_at,
    started_at_epoch: entity.started_at_epoch,
    completed_at: entity.completed_at ?? null,
    completed_at_epoch: entity.completed_at_epoch ?? null,
    status: entity.status,
    worker_port: entity.worker_port,
    prompt_counter: entity.prompt_counter,
    // Git worktree support
    repo_path: entity.repo_path ?? null,
    is_worktree: entity.is_worktree ?? false,
    branch: entity.branch ?? null,
  };
}

export class MikroOrmSessionRepository implements ISessionRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async create(input: CreateSessionInput): Promise<SdkSessionRecord> {
    const now = new Date();
    const entity = this.em.create(Session, {
      content_session_id: input.contentSessionId,
      memory_session_id: input.memorySessionId,
      project: input.project,
      user_prompt: input.userPrompt,
      working_directory: input.workingDirectory,
      started_at: now.toISOString(),
      started_at_epoch: now.getTime(),
      status: 'active',
      prompt_counter: 0,
      // Git worktree support
      repo_path: input.repoPath,
      is_worktree: input.isWorktree,
      branch: input.branch,
    });

    this.em.persist(entity);
    await this.em.flush();
    return toRecord(entity);
  }

  async findById(id: number): Promise<SdkSessionRecord | null> {
    const entity = await this.em.findOne(Session, { id });
    return entity ? toRecord(entity) : null;
  }

  async findByContentSessionId(contentSessionId: string): Promise<SdkSessionRecord | null> {
    const entity = await this.em.findOne(Session, { content_session_id: contentSessionId });
    return entity ? toRecord(entity) : null;
  }

  async findByMemorySessionId(memorySessionId: string): Promise<SdkSessionRecord | null> {
    const entity = await this.em.findOne(Session, { memory_session_id: memorySessionId });
    return entity ? toRecord(entity) : null;
  }

  async update(id: number, input: UpdateSessionInput): Promise<SdkSessionRecord | null> {
    const entity = await this.em.findOne(Session, { id });
    if (!entity) return null;

    if (input.status !== undefined) entity.status = input.status;
    if (input.completedAt !== undefined) {
      const date = typeof input.completedAt === 'number'
        ? new Date(input.completedAt)
        : input.completedAt;
      entity.completed_at = date.toISOString();
      entity.completed_at_epoch = date.getTime();
    }
    if (input.promptCounter !== undefined) entity.prompt_counter = input.promptCounter;
    if (input.memorySessionId !== undefined) entity.memory_session_id = input.memorySessionId;
    // Git worktree support
    if (input.repoPath !== undefined) entity.repo_path = input.repoPath;
    if (input.isWorktree !== undefined) entity.is_worktree = input.isWorktree;
    if (input.branch !== undefined) entity.branch = input.branch;

    await this.em.flush();
    return toRecord(entity);
  }

  async list(filters?: SessionQueryFilters, options?: QueryOptions): Promise<SdkSessionRecord[]> {
    const qb = this.em.createQueryBuilder(Session, 's');

    if (filters?.project) {
      qb.andWhere({ project: filters.project });
    }
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        qb.andWhere({ status: { $in: filters.status } });
      } else {
        qb.andWhere({ status: filters.status });
      }
    }
    if (filters?.dateRange?.start) {
      const epoch = typeof filters.dateRange.start === 'number'
        ? filters.dateRange.start
        : filters.dateRange.start.getTime();
      qb.andWhere({ started_at_epoch: { $gte: epoch } });
    }
    if (filters?.dateRange?.end) {
      const epoch = typeof filters.dateRange.end === 'number'
        ? filters.dateRange.end
        : filters.dateRange.end.getTime();
      qb.andWhere({ started_at_epoch: { $lte: epoch } });
    }

    qb.orderBy({ [options?.orderBy || 'started_at_epoch']: options?.order || 'DESC' });

    if (options?.limit) qb.limit(options.limit);
    if (options?.offset) qb.offset(options.offset);

    const entities = await qb.getResult();
    return entities.map(toRecord);
  }

  async count(filters?: SessionQueryFilters): Promise<number> {
    const qb = this.em.createQueryBuilder(Session, 's');

    if (filters?.project) {
      qb.andWhere({ project: filters.project });
    }
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        qb.andWhere({ status: { $in: filters.status } });
      } else {
        qb.andWhere({ status: filters.status });
      }
    }

    return qb.count();
  }

  async getActiveSession(project: string): Promise<SdkSessionRecord | null> {
    const entity = await this.em.findOne(
      Session,
      { project, status: 'active' },
      { orderBy: { started_at_epoch: 'DESC' } }
    );
    return entity ? toRecord(entity) : null;
  }

  async delete(id: number): Promise<boolean> {
    const entity = await this.em.findOne(Session, { id });
    if (!entity) return false;
    this.em.remove(entity);
    await this.em.flush();
    return true;
  }

  async getDistinctProjects(): Promise<string[]> {
    const result = await this.em.createQueryBuilder(Session, 's')
      .select('project', true)
      .distinct()
      .execute<{ project: string }[]>();
    return result.map((r: { project: string }) => r.project);
  }

  async getTimelineStats(params: {
    startEpoch: number;
    period: 'day' | 'week' | 'month';
    project?: string;
  }): Promise<Array<{ date: string; sessions: number }>> {
    const { startEpoch, period, project } = params;
    const knex = this.em.getKnex();

    // SQLite date formatting based on period
    let dateFormat: string;
    if (period === 'month') {
      dateFormat = "strftime('%Y-%m', datetime(started_at_epoch / 1000, 'unixepoch'))";
    } else if (period === 'week') {
      dateFormat = "date(datetime(started_at_epoch / 1000, 'unixepoch'), 'weekday 0', '-7 days')";
    } else {
      dateFormat = "date(datetime(started_at_epoch / 1000, 'unixepoch'))";
    }

    let query = knex('sdk_sessions')
      .where('started_at_epoch', '>=', startEpoch)
      .select(
        knex.raw(`${dateFormat} as date`),
        knex.raw('COUNT(*) as sessions')
      )
      .groupByRaw(dateFormat)
      .orderBy('date', 'asc');

    if (project) {
      query = query.andWhere('project', project);
    }

    const rows = await query;
    return rows.map((r: { date: string; sessions: string | number }) => ({
      date: r.date,
      sessions: Number(r.sessions),
    }));
  }
}

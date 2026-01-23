/**
 * MikroORM Summary Repository
 */

import type { SqlEntityManager } from '@mikro-orm/knex';
import type {
  ISummaryRepository,
  CreateSummaryInput,
  SummaryQueryFilters,
  QueryOptions,
  SessionSummaryRecord,
} from '@claude-mem/types';
import { Summary } from '../../entities/Summary.js';

/**
 * Convert Summary entity to SessionSummaryRecord
 */
function toRecord(entity: Summary): SessionSummaryRecord {
  return {
    id: entity.id,
    memory_session_id: entity.memory_session_id,
    project: entity.project,
    request: entity.request ?? null,
    investigated: entity.investigated ?? null,
    learned: entity.learned ?? null,
    completed: entity.completed ?? null,
    next_steps: entity.next_steps ?? null,
    created_at: entity.created_at,
    created_at_epoch: entity.created_at_epoch,
    prompt_number: entity.prompt_number,
    discovery_tokens: entity.discovery_tokens,
  };
}

export class MikroOrmSummaryRepository implements ISummaryRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async create(input: CreateSummaryInput): Promise<SessionSummaryRecord> {
    const now = new Date();
    const entity = this.em.create(Summary, {
      memory_session_id: input.memorySessionId,
      project: input.project,
      request: input.request,
      investigated: input.investigated,
      learned: input.learned,
      completed: input.completed,
      next_steps: input.nextSteps,
      prompt_number: input.promptNumber,
      discovery_tokens: input.discoveryTokens,
      created_at: now.toISOString(),
      created_at_epoch: now.getTime(),
    });

    await this.em.persistAndFlush(entity);
    return toRecord(entity);
  }

  async findById(id: number): Promise<SessionSummaryRecord | null> {
    const entity = await this.em.findOne(Summary, { id });
    return entity ? toRecord(entity) : null;
  }

  async update(id: number, input: Partial<CreateSummaryInput>): Promise<SessionSummaryRecord | null> {
    const entity = await this.em.findOne(Summary, { id });
    if (!entity) return null;

    if (input.request !== undefined) entity.request = input.request;
    if (input.investigated !== undefined) entity.investigated = input.investigated;
    if (input.learned !== undefined) entity.learned = input.learned;
    if (input.completed !== undefined) entity.completed = input.completed;
    if (input.nextSteps !== undefined) entity.next_steps = input.nextSteps;

    await this.em.flush();
    return toRecord(entity);
  }

  async list(filters?: SummaryQueryFilters, options?: QueryOptions): Promise<SessionSummaryRecord[]> {
    const qb = this.em.createQueryBuilder(Summary, 's');

    if (filters?.project) {
      qb.andWhere({ project: filters.project });
    }
    if (filters?.sessionId) {
      qb.andWhere({ memory_session_id: filters.sessionId });
    }
    if (filters?.dateRange?.start) {
      const epoch = typeof filters.dateRange.start === 'number'
        ? filters.dateRange.start
        : filters.dateRange.start.getTime();
      qb.andWhere({ created_at_epoch: { $gte: epoch } });
    }
    if (filters?.dateRange?.end) {
      const epoch = typeof filters.dateRange.end === 'number'
        ? filters.dateRange.end
        : filters.dateRange.end.getTime();
      qb.andWhere({ created_at_epoch: { $lte: epoch } });
    }

    qb.orderBy({ [options?.orderBy || 'created_at_epoch']: options?.order || 'DESC' });

    if (options?.limit) qb.limit(options.limit);
    if (options?.offset) qb.offset(options.offset);

    const entities = await qb.getResult();
    return entities.map(toRecord);
  }

  async count(filters?: SummaryQueryFilters): Promise<number> {
    const qb = this.em.createQueryBuilder(Summary, 's');

    if (filters?.project) {
      qb.andWhere({ project: filters.project });
    }
    if (filters?.sessionId) {
      qb.andWhere({ memory_session_id: filters.sessionId });
    }

    return qb.count();
  }

  async getBySessionId(memorySessionId: string): Promise<SessionSummaryRecord[]> {
    const entities = await this.em.find(
      Summary,
      { memory_session_id: memorySessionId },
      { orderBy: { created_at_epoch: 'ASC' } }
    );
    return entities.map(toRecord);
  }

  async getLatestForProject(project: string): Promise<SessionSummaryRecord | null> {
    const entity = await this.em.findOne(
      Summary,
      { project },
      { orderBy: { created_at_epoch: 'DESC' } }
    );
    return entity ? toRecord(entity) : null;
  }

  async delete(id: number): Promise<boolean> {
    const entity = await this.em.findOne(Summary, { id });
    if (!entity) return false;
    await this.em.removeAndFlush(entity);
    return true;
  }
}

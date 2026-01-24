/**
 * RawMessage Repository
 *
 * Repository for raw messages in Lazy Mode.
 */

import type { SqlEntityManager } from '@mikro-orm/knex';
import type {
  IRawMessageRepository,
  RawMessageRecord,
  CreateRawMessageInput,
  RawMessageQueryFilters,
  QueryOptions,
} from '@claude-mem/types';
import { RawMessage } from '../../entities/RawMessage.js';

export class MikroOrmRawMessageRepository implements IRawMessageRepository {
  constructor(private em: SqlEntityManager) {}

  async create(input: CreateRawMessageInput): Promise<RawMessageRecord> {
    const now = new Date();
    const entity = this.em.create(RawMessage, {
      session_id: input.sessionId,
      project: input.project,
      prompt_number: input.promptNumber,
      role: input.role,
      content: input.content,
      tool_calls: input.toolCalls,
      tool_name: input.toolName,
      tool_input: input.toolInput,
      tool_output: input.toolOutput,
      processed: false,
      created_at: now.toISOString(),
      created_at_epoch: now.getTime(),
    });

    this.em.persist(entity);
    await this.em.flush();
    return this.toRecord(entity);
  }

  async createMany(inputs: CreateRawMessageInput[]): Promise<RawMessageRecord[]> {
    const now = new Date();
    const entities = inputs.map(input =>
      this.em.create(RawMessage, {
        session_id: input.sessionId,
        project: input.project,
        prompt_number: input.promptNumber,
        role: input.role,
        content: input.content,
        tool_calls: input.toolCalls,
        tool_name: input.toolName,
        tool_input: input.toolInput,
        tool_output: input.toolOutput,
        processed: false,
        created_at: now.toISOString(),
        created_at_epoch: now.getTime(),
      })
    );

    entities.forEach(e => this.em.persist(e));
    await this.em.flush();
    return entities.map(e => this.toRecord(e));
  }

  async findById(id: number): Promise<RawMessageRecord | null> {
    const entity = await this.em.findOne(RawMessage, { id });
    return entity ? this.toRecord(entity) : null;
  }

  async list(filters?: RawMessageQueryFilters, options?: QueryOptions): Promise<RawMessageRecord[]> {
    const qb = this.em.createQueryBuilder(RawMessage, 'rm');

    if (filters?.sessionId) {
      qb.andWhere({ session_id: filters.sessionId });
    }
    if (filters?.project) {
      qb.andWhere({ project: filters.project });
    }
    if (filters?.processed !== undefined) {
      qb.andWhere({ processed: filters.processed });
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
    return entities.map(e => this.toRecord(e));
  }

  async getUnprocessed(limit?: number): Promise<RawMessageRecord[]> {
    const entities = await this.em.find(
      RawMessage,
      { processed: false },
      {
        orderBy: { created_at_epoch: 'ASC' },
        limit: limit ?? 100,
      }
    );
    return entities.map(e => this.toRecord(e));
  }

  async countUnprocessed(): Promise<number> {
    return this.em.count(RawMessage, { processed: false });
  }

  async markProcessed(ids: number[], observationId?: number): Promise<void> {
    const now = new Date();
    await this.em.nativeUpdate(
      RawMessage,
      { id: { $in: ids } },
      {
        processed: true,
        processed_at: now.toISOString(),
        processed_at_epoch: now.getTime(),
        observation_id: observationId,
      }
    );
  }

  async search(
    query: string,
    filters?: RawMessageQueryFilters,
    options?: QueryOptions
  ): Promise<RawMessageRecord[]> {
    const knex = this.em.getKnex();

    let sql = knex('raw_messages')
      .whereRaw('content LIKE ?', [`%${query}%`]);

    if (filters?.sessionId) {
      sql = sql.andWhere('session_id', filters.sessionId);
    }
    if (filters?.project) {
      sql = sql.andWhere('project', filters.project);
    }
    if (filters?.processed !== undefined) {
      sql = sql.andWhere('processed', filters.processed ? 1 : 0);
    }

    sql = sql.orderBy(options?.orderBy || 'created_at_epoch', options?.order || 'desc');

    if (options?.limit) sql = sql.limit(options.limit);
    if (options?.offset) sql = sql.offset(options.offset);

    const rows = await sql;
    return rows.map((r: Record<string, unknown>) => this.rowToRecord(r));
  }

  async delete(id: number): Promise<boolean> {
    const entity = await this.em.findOne(RawMessage, { id });
    if (!entity) return false;
    this.em.remove(entity);
    await this.em.flush();
    return true;
  }

  async cleanupProcessed(olderThanDays: number): Promise<number> {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    return this.em.nativeDelete(RawMessage, {
      processed: true,
      created_at_epoch: { $lt: cutoff },
    });
  }

  async getStatus(): Promise<{
    unprocessedCount: number;
    oldestUnprocessed: number | null;
    lastProcessed: number | null;
  }> {
    const knex = this.em.getKnex();

    const [countResult] = await knex('raw_messages')
      .where('processed', 0)
      .count('* as count');

    const [oldestResult] = await knex('raw_messages')
      .where('processed', 0)
      .orderBy('created_at_epoch', 'asc')
      .limit(1)
      .select('created_at_epoch');

    const [lastResult] = await knex('raw_messages')
      .where('processed', 1)
      .orderBy('processed_at_epoch', 'desc')
      .limit(1)
      .select('processed_at_epoch');

    return {
      unprocessedCount: Number(countResult?.count ?? 0),
      oldestUnprocessed: oldestResult?.created_at_epoch ?? null,
      lastProcessed: lastResult?.processed_at_epoch ?? null,
    };
  }

  private toRecord(entity: RawMessage): RawMessageRecord {
    return {
      id: entity.id,
      session_id: entity.session_id,
      project: entity.project,
      prompt_number: entity.prompt_number ?? null,
      role: entity.role as 'user' | 'assistant' | 'tool',
      content: entity.content,
      tool_calls: entity.tool_calls ?? null,
      tool_name: entity.tool_name ?? null,
      tool_input: entity.tool_input ?? null,
      tool_output: entity.tool_output ?? null,
      processed: entity.processed,
      processed_at: entity.processed_at ?? null,
      processed_at_epoch: entity.processed_at_epoch ?? null,
      observation_id: entity.observation_id ?? null,
      created_at: entity.created_at,
      created_at_epoch: entity.created_at_epoch,
    };
  }

  private rowToRecord(row: Record<string, unknown>): RawMessageRecord {
    return {
      id: row.id as number,
      session_id: row.session_id as string,
      project: row.project as string,
      prompt_number: (row.prompt_number as number | null) ?? null,
      role: row.role as 'user' | 'assistant' | 'tool',
      content: row.content as string,
      tool_calls: (row.tool_calls as string | null) ?? null,
      tool_name: (row.tool_name as string | null) ?? null,
      tool_input: (row.tool_input as string | null) ?? null,
      tool_output: (row.tool_output as string | null) ?? null,
      processed: Boolean(row.processed),
      processed_at: (row.processed_at as string | null) ?? null,
      processed_at_epoch: (row.processed_at_epoch as number | null) ?? null,
      observation_id: (row.observation_id as number | null) ?? null,
      created_at: row.created_at as string,
      created_at_epoch: row.created_at_epoch as number,
    };
  }
}

/**
 * MikroORM Observation Repository
 *
 * Note: FTS5 queries remain as raw SQL since MikroORM doesn't support FTS5.
 */

import type { SqlEntityManager } from '@mikro-orm/knex';
import type {
  IObservationRepository,
  CreateObservationInput,
  ObservationQueryFilters,
  QueryOptions,
  ObservationRecord,
} from '@claude-mem/types';
import { Observation } from '../../entities/Observation.js';

/**
 * Convert Observation entity to ObservationRecord
 */
function toRecord(entity: Observation): ObservationRecord {
  return {
    id: entity.id,
    memory_session_id: entity.memory_session_id,
    project: entity.project,
    text: entity.text ?? null,
    type: entity.type,
    created_at: entity.created_at,
    created_at_epoch: entity.created_at_epoch,
    title: entity.title,
    subtitle: entity.subtitle,
    narrative: entity.narrative,
    concept: entity.concept,
    concepts: entity.concepts,
    facts: entity.facts,
    source_files: entity.source_files,
    files_read: entity.files_read,
    files_modified: entity.files_modified,
    git_branch: entity.git_branch,
    cwd: entity.cwd,
    prompt_number: entity.prompt_number,
    discovery_tokens: entity.discovery_tokens,
  };
}

export class MikroOrmObservationRepository implements IObservationRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async create(input: CreateObservationInput): Promise<ObservationRecord> {
    const now = new Date();
    const entity = this.em.create(Observation, {
      memory_session_id: input.memorySessionId,
      project: input.project,
      text: input.text,
      type: input.type,
      title: input.title,
      subtitle: input.subtitle,
      concepts: input.concepts,
      facts: input.facts,
      narrative: input.narrative,
      files_read: input.filesRead,
      files_modified: input.filesModified,
      prompt_number: input.promptNumber,
      discovery_tokens: input.discoveryTokens,
      git_branch: input.gitBranch,
      cwd: input.cwd,
      created_at: now.toISOString(),
      created_at_epoch: now.getTime(),
    });

    this.em.persist(entity);
    await this.em.flush();
    return toRecord(entity);
  }

  async findById(id: number): Promise<ObservationRecord | null> {
    const entity = await this.em.findOne(Observation, { id });
    return entity ? toRecord(entity) : null;
  }

  async update(id: number, input: Partial<CreateObservationInput>): Promise<ObservationRecord | null> {
    const entity = await this.em.findOne(Observation, { id });
    if (!entity) return null;

    if (input.text !== undefined) entity.text = input.text;
    if (input.type !== undefined) entity.type = input.type;
    if (input.title !== undefined) entity.title = input.title;
    if (input.subtitle !== undefined) entity.subtitle = input.subtitle;
    if (input.concepts !== undefined) entity.concepts = input.concepts;
    if (input.facts !== undefined) entity.facts = input.facts;
    if (input.narrative !== undefined) entity.narrative = input.narrative;
    if (input.filesRead !== undefined) entity.files_read = input.filesRead;
    if (input.filesModified !== undefined) entity.files_modified = input.filesModified;

    await this.em.flush();
    return toRecord(entity);
  }

  async list(filters?: ObservationQueryFilters, options?: QueryOptions): Promise<ObservationRecord[]> {
    const qb = this.em.createQueryBuilder(Observation, 'o');

    if (filters?.project) {
      qb.andWhere({ project: filters.project });
    }
    if (filters?.sessionId) {
      qb.andWhere({ memory_session_id: filters.sessionId });
    }
    if (filters?.type) {
      if (Array.isArray(filters.type)) {
        qb.andWhere({ type: { $in: filters.type } });
      } else {
        qb.andWhere({ type: filters.type });
      }
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
    if (filters?.cwdPrefix) {
      qb.andWhere({ cwd: { $like: `${filters.cwdPrefix}%` } });
    }

    qb.orderBy({ [options?.orderBy || 'created_at_epoch']: options?.order || 'DESC' });

    if (options?.limit) qb.limit(options.limit);
    if (options?.offset) qb.offset(options.offset);

    const entities = await qb.getResult();
    return entities.map(toRecord);
  }

  async count(filters?: ObservationQueryFilters): Promise<number> {
    const qb = this.em.createQueryBuilder(Observation, 'o');

    if (filters?.project) {
      qb.andWhere({ project: filters.project });
    }
    if (filters?.sessionId) {
      qb.andWhere({ memory_session_id: filters.sessionId });
    }
    if (filters?.type) {
      if (Array.isArray(filters.type)) {
        qb.andWhere({ type: { $in: filters.type } });
      } else {
        qb.andWhere({ type: filters.type });
      }
    }

    return qb.count();
  }

  /**
   * Sanitize query for FTS5
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
    filters?: ObservationQueryFilters,
    options?: QueryOptions
  ): Promise<ObservationRecord[]> {
    // FTS5 requires raw SQL - MikroORM doesn't support virtual tables
    const sanitizedQuery = this.sanitizeFts5Query(query);
    const knex = this.em.getKnex();

    let sql = knex('observations as o')
      .join(knex.raw('observations_fts fts ON o.id = fts.rowid'))
      .whereRaw('observations_fts MATCH ?', [sanitizedQuery])
      .select('o.*');

    if (filters?.project) {
      sql = sql.andWhere('o.project', filters.project);
    }
    if (filters?.type) {
      if (Array.isArray(filters.type)) {
        sql = sql.whereIn('o.type', filters.type);
      } else {
        sql = sql.andWhere('o.type', filters.type);
      }
    }

    if (options?.orderBy === 'relevance') {
      sql = sql.orderByRaw('rank');
    } else {
      sql = sql.orderBy(options?.orderBy || 'o.created_at_epoch', options?.order || 'desc');
    }

    if (options?.limit) sql = sql.limit(options.limit);
    if (options?.offset) sql = sql.offset(options.offset);

    const rows = await sql;
    return rows as ObservationRecord[];
  }

  async getBySessionId(memorySessionId: string, options?: QueryOptions): Promise<ObservationRecord[]> {
    return this.list({ sessionId: memorySessionId }, options);
  }

  async getForContext(project: string, limit: number): Promise<ObservationRecord[]> {
    const entities = await this.em.find(
      Observation,
      { project },
      { orderBy: { created_at_epoch: 'DESC' }, limit }
    );
    return entities.map(toRecord);
  }

  async delete(id: number): Promise<boolean> {
    const entity = await this.em.findOne(Observation, { id });
    if (!entity) return false;
    this.em.remove(entity);
    await this.em.flush();
    return true;
  }

  async deleteBySessionId(memorySessionId: string): Promise<number> {
    const result = await this.em.nativeDelete(Observation, { memory_session_id: memorySessionId });
    return result;
  }
}

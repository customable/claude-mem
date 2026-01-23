/**
 * MikroORM Document Repository
 *
 * Note: FTS5 queries remain as raw SQL since MikroORM doesn't support FTS5.
 */

import type { SqlEntityManager } from '@mikro-orm/knex';
import type {
  IDocumentRepository,
  CreateDocumentInput,
  DocumentQueryFilters,
  QueryOptions,
  DocumentRecord,
} from '@claude-mem/types';
import { Document } from '../../entities/Document.js';

/**
 * Convert Document entity to DocumentRecord
 */
function toRecord(entity: Document): DocumentRecord {
  return {
    id: entity.id,
    project: entity.project,
    source: entity.source,
    source_tool: entity.source_tool,
    title: entity.title ?? null,
    content: entity.content,
    content_hash: entity.content_hash,
    type: entity.type,
    metadata: entity.metadata ?? null,
    memory_session_id: entity.memory_session_id ?? null,
    observation_id: entity.observation_id ?? null,
    access_count: entity.access_count,
    last_accessed_epoch: entity.last_accessed_epoch,
    created_at: entity.created_at,
    created_at_epoch: entity.created_at_epoch,
  };
}

export class MikroOrmDocumentRepository implements IDocumentRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async create(input: CreateDocumentInput): Promise<DocumentRecord> {
    const now = new Date();
    const entity = this.em.create(Document, {
      project: input.project,
      source: input.source,
      source_tool: input.sourceTool,
      title: input.title,
      content: input.content,
      content_hash: input.contentHash,
      type: input.type || 'library-docs',
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
      memory_session_id: input.memorySessionId,
      observation_id: input.observationId,
      access_count: 1,
      last_accessed_epoch: now.getTime(),
      created_at: now.toISOString(),
      created_at_epoch: now.getTime(),
    });

    await this.em.persistAndFlush(entity);
    return toRecord(entity);
  }

  async findById(id: number): Promise<DocumentRecord | null> {
    const entity = await this.em.findOne(Document, { id });
    return entity ? toRecord(entity) : null;
  }

  async findByHash(contentHash: string): Promise<DocumentRecord | null> {
    const entity = await this.em.findOne(Document, { content_hash: contentHash });
    return entity ? toRecord(entity) : null;
  }

  async update(id: number, input: Partial<CreateDocumentInput>): Promise<DocumentRecord | null> {
    const entity = await this.em.findOne(Document, { id });
    if (!entity) return null;

    if (input.title !== undefined) entity.title = input.title;
    if (input.content !== undefined) entity.content = input.content;
    if (input.type !== undefined) entity.type = input.type;
    if (input.metadata !== undefined) {
      entity.metadata = input.metadata ? JSON.stringify(input.metadata) : undefined;
    }

    await this.em.flush();
    return toRecord(entity);
  }

  async recordAccess(id: number): Promise<DocumentRecord | null> {
    const entity = await this.em.findOne(Document, { id });
    if (!entity) return null;

    entity.access_count += 1;
    entity.last_accessed_epoch = Date.now();

    await this.em.flush();
    return toRecord(entity);
  }

  async list(filters?: DocumentQueryFilters, options?: QueryOptions): Promise<DocumentRecord[]> {
    const qb = this.em.createQueryBuilder(Document, 'd');

    if (filters?.project) {
      qb.andWhere({ project: filters.project });
    }
    if (filters?.source) {
      qb.andWhere({ source: filters.source });
    }
    if (filters?.sourceTool) {
      qb.andWhere({ source_tool: filters.sourceTool });
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

    qb.orderBy({ [options?.orderBy || 'created_at_epoch']: options?.order || 'DESC' });

    if (options?.limit) qb.limit(options.limit);
    if (options?.offset) qb.offset(options.offset);

    const entities = await qb.getResult();
    return entities.map(toRecord);
  }

  async count(filters?: DocumentQueryFilters): Promise<number> {
    const qb = this.em.createQueryBuilder(Document, 'd');

    if (filters?.project) {
      qb.andWhere({ project: filters.project });
    }
    if (filters?.source) {
      qb.andWhere({ source: filters.source });
    }
    if (filters?.sourceTool) {
      qb.andWhere({ source_tool: filters.sourceTool });
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
    filters?: DocumentQueryFilters,
    options?: QueryOptions
  ): Promise<DocumentRecord[]> {
    // FTS5 requires raw SQL
    const sanitizedQuery = this.sanitizeFts5Query(query);
    const knex = this.em.getKnex();

    let sql = knex('documents as d')
      .join(knex.raw('documents_fts fts ON d.id = fts.rowid'))
      .whereRaw('documents_fts MATCH ?', [sanitizedQuery])
      .select('d.*');

    if (filters?.project) {
      sql = sql.andWhere('d.project', filters.project);
    }
    if (filters?.sourceTool) {
      sql = sql.andWhere('d.source_tool', filters.sourceTool);
    }
    if (filters?.type) {
      if (Array.isArray(filters.type)) {
        sql = sql.whereIn('d.type', filters.type);
      } else {
        sql = sql.andWhere('d.type', filters.type);
      }
    }

    if (options?.orderBy === 'relevance') {
      sql = sql.orderByRaw('rank');
    } else {
      sql = sql.orderBy(options?.orderBy || 'd.created_at_epoch', options?.order || 'desc');
    }

    if (options?.limit) sql = sql.limit(options.limit);
    if (options?.offset) sql = sql.offset(options.offset);

    const rows = await sql;
    return rows as DocumentRecord[];
  }

  async getByProject(project: string, options?: QueryOptions): Promise<DocumentRecord[]> {
    return this.list({ project }, options);
  }

  async getBySourceTool(sourceTool: string, options?: QueryOptions): Promise<DocumentRecord[]> {
    return this.list({ sourceTool }, options);
  }

  async getFrequentlyAccessed(limit: number): Promise<DocumentRecord[]> {
    const entities = await this.em.find(
      Document,
      {},
      { orderBy: { access_count: 'DESC', last_accessed_epoch: 'DESC' }, limit }
    );
    return entities.map(toRecord);
  }

  async delete(id: number): Promise<boolean> {
    const entity = await this.em.findOne(Document, { id });
    if (!entity) return false;
    await this.em.removeAndFlush(entity);
    return true;
  }

  async cleanupOld(olderThanDays: number, minAccessCount: number): Promise<number> {
    const cutoffEpoch = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const result = await this.em.nativeDelete(Document, {
      last_accessed_epoch: { $lt: cutoffEpoch },
      access_count: { $lt: minAccessCount },
    });
    return result;
  }
}

/**
 * MikroORM CodeSnippet Repository
 *
 * Manages code snippets extracted from observations.
 * Note: FTS5 queries remain as raw SQL since MikroORM doesn't support FTS5.
 */

import type { SqlEntityManager } from '@mikro-orm/knex';
import type {
  ICodeSnippetRepository,
  CreateCodeSnippetInput,
  CodeSnippetQueryFilters,
  QueryOptions,
  CodeSnippetRecord,
} from '@claude-mem/types';
import { CodeSnippet } from '../../entities/CodeSnippet.js';

/**
 * Convert CodeSnippet entity to CodeSnippetRecord
 */
function toRecord(entity: CodeSnippet): CodeSnippetRecord {
  return {
    id: entity.id,
    observation_id: entity.observation_id,
    memory_session_id: entity.memory_session_id,
    project: entity.project,
    language: entity.language ?? null,
    code: entity.code,
    file_path: entity.file_path ?? null,
    line_start: entity.line_start ?? null,
    line_end: entity.line_end ?? null,
    context: entity.context ?? null,
    created_at_epoch: entity.created_at_epoch,
  };
}

export class MikroOrmCodeSnippetRepository implements ICodeSnippetRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async create(input: CreateCodeSnippetInput): Promise<CodeSnippetRecord> {
    const entity = this.em.create(CodeSnippet, {
      observation_id: input.observationId,
      memory_session_id: input.memorySessionId,
      project: input.project,
      language: input.language,
      code: input.code,
      file_path: input.filePath,
      line_start: input.lineStart,
      line_end: input.lineEnd,
      context: input.context,
      created_at_epoch: Date.now(),
    });

    this.em.persist(entity);
    await this.em.flush();
    return toRecord(entity);
  }

  async createMany(inputs: CreateCodeSnippetInput[]): Promise<CodeSnippetRecord[]> {
    const now = Date.now();
    const entities = inputs.map((input) =>
      this.em.create(CodeSnippet, {
        observation_id: input.observationId,
        memory_session_id: input.memorySessionId,
        project: input.project,
        language: input.language,
        code: input.code,
        file_path: input.filePath,
        line_start: input.lineStart,
        line_end: input.lineEnd,
        context: input.context,
        created_at_epoch: now,
      })
    );

    entities.forEach((e) => this.em.persist(e));
    await this.em.flush();
    return entities.map(toRecord);
  }

  async findById(id: number): Promise<CodeSnippetRecord | null> {
    const entity = await this.em.findOne(CodeSnippet, { id });
    return entity ? toRecord(entity) : null;
  }

  async findByObservationId(observationId: number): Promise<CodeSnippetRecord[]> {
    const entities = await this.em.find(CodeSnippet, { observation_id: observationId });
    return entities.map(toRecord);
  }

  async list(
    filters?: CodeSnippetQueryFilters,
    options?: QueryOptions
  ): Promise<CodeSnippetRecord[]> {
    const where: Record<string, unknown> = {};

    if (filters?.project) {
      where.project = filters.project;
    }
    if (filters?.language) {
      where.language = filters.language;
    }
    if (filters?.sessionId) {
      where.memory_session_id = filters.sessionId;
    }

    const entities = await this.em.find(CodeSnippet, where, {
      limit: options?.limit || 50,
      offset: options?.offset || 0,
      orderBy: { created_at_epoch: options?.order === 'asc' ? 'ASC' : 'DESC' },
    });

    return entities.map(toRecord);
  }

  async search(
    query: string,
    filters?: CodeSnippetQueryFilters,
    options?: QueryOptions
  ): Promise<CodeSnippetRecord[]> {
    // Build FTS5 query
    let sql = `
      SELECT cs.* FROM code_snippets cs
      JOIN code_snippets_fts fts ON cs.id = fts.rowid
      WHERE code_snippets_fts MATCH ?
    `;
    const params: unknown[] = [query];

    if (filters?.project) {
      sql += ` AND cs.project = ?`;
      params.push(filters.project);
    }
    if (filters?.language) {
      sql += ` AND cs.language = ?`;
      params.push(filters.language);
    }
    if (filters?.sessionId) {
      sql += ` AND cs.memory_session_id = ?`;
      params.push(filters.sessionId);
    }

    sql += ` ORDER BY rank LIMIT ? OFFSET ?`;
    params.push(options?.limit || 50);
    params.push(options?.offset || 0);

    const result = await this.em.getConnection().execute(sql, params);
    return (result as CodeSnippet[]).map(toRecord);
  }

  async delete(id: number): Promise<boolean> {
    const entity = await this.em.findOne(CodeSnippet, { id });
    if (!entity) return false;
    this.em.remove(entity);
    await this.em.flush();
    return true;
  }

  async deleteByObservationId(observationId: number): Promise<number> {
    const result = await this.em.nativeDelete(CodeSnippet, { observation_id: observationId });
    return result;
  }

  async count(filters?: CodeSnippetQueryFilters): Promise<number> {
    const where: Record<string, unknown> = {};

    if (filters?.project) {
      where.project = filters.project;
    }
    if (filters?.language) {
      where.language = filters.language;
    }
    if (filters?.sessionId) {
      where.memory_session_id = filters.sessionId;
    }

    return this.em.count(CodeSnippet, where);
  }

  async getDistinctLanguages(project?: string): Promise<string[]> {
    const where = project ? { project } : {};
    const result = await this.em
      .createQueryBuilder(CodeSnippet, 'cs')
      .select('language', true)
      .where(where)
      .andWhere({ language: { $ne: null } })
      .distinct()
      .orderBy({ language: 'ASC' })
      .execute<{ language: string }[]>();
    return result.map((r) => r.language);
  }
}

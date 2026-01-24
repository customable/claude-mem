/**
 * MikroORM CLAUDE.md Repository
 *
 * Stores generated CLAUDE.md content per project.
 */

import type { SqlEntityManager } from '@mikro-orm/knex';
import type {
  IClaudeMdRepository,
  ClaudeMdRecord,
  UpsertClaudeMdInput,
} from '@claude-mem/types';
import { ClaudeMd } from '../../entities/ClaudeMd.js';

// Re-export types for backward compatibility
export type { ClaudeMdRecord, UpsertClaudeMdInput } from '@claude-mem/types';

/**
 * Convert ClaudeMd entity to ClaudeMdRecord
 */
function toRecord(entity: ClaudeMd): ClaudeMdRecord {
  return {
    id: entity.id,
    project: entity.project,
    content: entity.content,
    content_session_id: entity.content_session_id,
    memory_session_id: entity.memory_session_id ?? null,
    working_directory: entity.working_directory ?? null,
    generated_at: entity.generated_at,
    tokens: entity.tokens,
  };
}

export class MikroOrmClaudeMdRepository implements IClaudeMdRepository {
  constructor(private readonly em: SqlEntityManager) {}

  /**
   * Insert or update CLAUDE.md content for a project/session
   */
  async upsert(input: UpsertClaudeMdInput): Promise<ClaudeMdRecord> {
    const now = Date.now();

    // Check for existing record
    const existing = await this.em.findOne(ClaudeMd, {
      project: input.project,
      content_session_id: input.contentSessionId,
    });

    if (existing) {
      // Update existing
      existing.content = input.content;
      existing.memory_session_id = input.memorySessionId;
      existing.working_directory = input.workingDirectory;
      existing.generated_at = now;
      existing.tokens = input.tokens ?? 0;
      await this.em.flush();
      return toRecord(existing);
    }

    // Create new
    const entity = this.em.create(ClaudeMd, {
      project: input.project,
      content: input.content,
      content_session_id: input.contentSessionId,
      memory_session_id: input.memorySessionId,
      working_directory: input.workingDirectory,
      generated_at: now,
      tokens: input.tokens ?? 0,
    });

    this.em.persist(entity);
    await this.em.flush();
    return toRecord(entity);
  }

  /**
   * Get latest CLAUDE.md content for a project
   */
  async getByProject(project: string): Promise<ClaudeMdRecord | null> {
    const entity = await this.em.findOne(
      ClaudeMd,
      { project },
      { orderBy: { generated_at: 'DESC' } }
    );
    return entity ? toRecord(entity) : null;
  }

  /**
   * Get CLAUDE.md content by project and session
   */
  async getByProjectAndSession(
    project: string,
    contentSessionId: string
  ): Promise<ClaudeMdRecord | null> {
    const entity = await this.em.findOne(ClaudeMd, {
      project,
      content_session_id: contentSessionId,
    });
    return entity ? toRecord(entity) : null;
  }

  /**
   * List all CLAUDE.md records for a project
   */
  async listByProject(project: string, limit = 10): Promise<ClaudeMdRecord[]> {
    const entities = await this.em.find(
      ClaudeMd,
      { project },
      { orderBy: { generated_at: 'DESC' }, limit }
    );
    return entities.map(toRecord);
  }

  /**
   * Delete CLAUDE.md record by ID
   */
  async delete(id: number): Promise<boolean> {
    const entity = await this.em.findOne(ClaudeMd, { id });
    if (!entity) return false;
    this.em.remove(entity);
    await this.em.flush();
    return true;
  }

  /**
   * Delete all CLAUDE.md records for a project
   */
  async deleteByProject(project: string): Promise<number> {
    const result = await this.em.nativeDelete(ClaudeMd, { project });
    return result;
  }

  /**
   * Get all distinct projects with CLAUDE.md content
   */
  async getDistinctProjects(): Promise<string[]> {
    const result = await this.em.createQueryBuilder(ClaudeMd, 'c')
      .select('project', true)
      .distinct()
      .orderBy({ project: 'ASC' })
      .execute<{ project: string }[]>();
    return result.map((r: { project: string }) => r.project);
  }
}

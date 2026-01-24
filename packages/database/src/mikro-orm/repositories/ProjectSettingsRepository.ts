/**
 * MikroORM Project Settings Repository
 *
 * Manages project-specific settings and metadata.
 */

import type { SqlEntityManager } from '@mikro-orm/knex';
import type {
  IProjectSettingsRepository,
  UpsertProjectSettingsInput,
  QueryOptions,
  ProjectSettingsRecord,
} from '@claude-mem/types';
import { ProjectSettings } from '../../entities/ProjectSettings.js';

/**
 * Convert ProjectSettings entity to ProjectSettingsRecord
 */
function toRecord(entity: ProjectSettings): ProjectSettingsRecord {
  return {
    id: entity.id,
    project: entity.project,
    display_name: entity.display_name,
    description: entity.description,
    settings: entity.settings,
    metadata: entity.metadata,
    observation_count: entity.observation_count,
    session_count: entity.session_count,
    last_activity_epoch: entity.last_activity_epoch,
    created_at: entity.created_at,
    created_at_epoch: entity.created_at_epoch,
    updated_at: entity.updated_at,
    updated_at_epoch: entity.updated_at_epoch,
  };
}

export class MikroOrmProjectSettingsRepository implements IProjectSettingsRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async getOrCreate(project: string): Promise<ProjectSettingsRecord> {
    let entity = await this.em.findOne(ProjectSettings, { project });

    if (!entity) {
      const now = new Date();
      entity = this.em.create(ProjectSettings, {
        project,
        settings: '{}',
        metadata: '{}',
        observation_count: 0,
        session_count: 0,
        created_at: now.toISOString(),
        created_at_epoch: now.getTime(),
      });
      this.em.persist(entity);
      await this.em.flush();
    }

    return toRecord(entity);
  }

  async findByProject(project: string): Promise<ProjectSettingsRecord | null> {
    const entity = await this.em.findOne(ProjectSettings, { project });
    return entity ? toRecord(entity) : null;
  }

  async update(project: string, input: Partial<UpsertProjectSettingsInput>): Promise<ProjectSettingsRecord | null> {
    const entity = await this.em.findOne(ProjectSettings, { project });
    if (!entity) return null;

    const now = new Date();
    if (input.displayName !== undefined) entity.display_name = input.displayName;
    if (input.description !== undefined) entity.description = input.description;
    if (input.settings !== undefined) entity.settings = input.settings;
    if (input.metadata !== undefined) entity.metadata = input.metadata;
    entity.updated_at = now.toISOString();
    entity.updated_at_epoch = now.getTime();

    await this.em.flush();
    return toRecord(entity);
  }

  async updateActivityStats(project: string, observationDelta = 0, sessionDelta = 0): Promise<void> {
    const entity = await this.em.findOne(ProjectSettings, { project });
    if (!entity) {
      // Auto-create if doesn't exist
      await this.getOrCreate(project);
      return this.updateActivityStats(project, observationDelta, sessionDelta);
    }

    const now = Date.now();
    entity.observation_count = (entity.observation_count || 0) + observationDelta;
    entity.session_count = (entity.session_count || 0) + sessionDelta;
    entity.last_activity_epoch = now;
    entity.updated_at = new Date(now).toISOString();
    entity.updated_at_epoch = now;

    await this.em.flush();
  }

  async listAll(options?: QueryOptions): Promise<ProjectSettingsRecord[]> {
    const qb = this.em.createQueryBuilder(ProjectSettings, 'p');

    qb.orderBy({ [options?.orderBy || 'project']: options?.order || 'ASC' });

    if (options?.limit) qb.limit(options.limit);
    if (options?.offset) qb.offset(options.offset);

    const entities = await qb.getResult();
    return entities.map(toRecord);
  }

  async getRecentlyActive(limit = 10): Promise<ProjectSettingsRecord[]> {
    const entities = await this.em.find(
      ProjectSettings,
      { last_activity_epoch: { $ne: null } },
      {
        orderBy: { last_activity_epoch: 'DESC' },
        limit,
      }
    );
    return entities.map(toRecord);
  }

  async delete(project: string): Promise<boolean> {
    const entity = await this.em.findOne(ProjectSettings, { project });
    if (!entity) return false;

    this.em.remove(entity);
    await this.em.flush();
    return true;
  }

  async count(): Promise<number> {
    return this.em.count(ProjectSettings);
  }
}

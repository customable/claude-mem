/**
 * MikroORM Observation Template Repository
 *
 * Manages observation templates.
 */

import type { SqlEntityManager } from '@mikro-orm/knex';
import type {
  IObservationTemplateRepository,
  CreateTemplateInput,
  TemplateQueryFilters,
  QueryOptions,
  ObservationTemplateRecord,
  ObservationType,
} from '@claude-mem/types';
import { ObservationTemplate } from '../../entities/ObservationTemplate.js';

/**
 * Convert ObservationTemplate entity to ObservationTemplateRecord
 */
function toRecord(entity: ObservationTemplate): ObservationTemplateRecord {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    type: entity.type as ObservationType,
    project: entity.project,
    fields: entity.fields,
    is_default: entity.is_default,
    is_system: entity.is_system,
    created_at: entity.created_at,
    created_at_epoch: entity.created_at_epoch,
    updated_at: entity.updated_at,
    updated_at_epoch: entity.updated_at_epoch,
  };
}

export class MikroOrmObservationTemplateRepository implements IObservationTemplateRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async create(input: CreateTemplateInput): Promise<ObservationTemplateRecord> {
    const now = new Date();
    const entity = this.em.create(ObservationTemplate, {
      name: input.name,
      description: input.description,
      type: input.type,
      project: input.project,
      fields: input.fields,
      is_default: input.isDefault ?? false,
      is_system: false, // User-created templates are never system templates
      created_at: now.toISOString(),
      created_at_epoch: now.getTime(),
    });

    this.em.persist(entity);
    await this.em.flush();
    return toRecord(entity);
  }

  async findById(id: number): Promise<ObservationTemplateRecord | null> {
    const entity = await this.em.findOne(ObservationTemplate, { id });
    return entity ? toRecord(entity) : null;
  }

  async findByName(name: string, project?: string): Promise<ObservationTemplateRecord | null> {
    // First try project-specific, then global
    if (project) {
      const projectTemplate = await this.em.findOne(ObservationTemplate, { name, project });
      if (projectTemplate) return toRecord(projectTemplate);
    }

    // Fall back to global template
    const globalTemplate = await this.em.findOne(ObservationTemplate, { name, project: null });
    return globalTemplate ? toRecord(globalTemplate) : null;
  }

  async update(id: number, input: Partial<CreateTemplateInput>): Promise<ObservationTemplateRecord | null> {
    const entity = await this.em.findOne(ObservationTemplate, { id });
    if (!entity) return null;

    // Cannot modify system templates
    if (entity.is_system) {
      throw new Error('Cannot modify system templates');
    }

    const now = new Date();
    if (input.name !== undefined) entity.name = input.name;
    if (input.description !== undefined) entity.description = input.description;
    if (input.type !== undefined) entity.type = input.type;
    if (input.project !== undefined) entity.project = input.project;
    if (input.fields !== undefined) entity.fields = input.fields;
    if (input.isDefault !== undefined) entity.is_default = input.isDefault;
    entity.updated_at = now.toISOString();
    entity.updated_at_epoch = now.getTime();

    await this.em.flush();
    return toRecord(entity);
  }

  async list(filters?: TemplateQueryFilters, options?: QueryOptions): Promise<ObservationTemplateRecord[]> {
    const qb = this.em.createQueryBuilder(ObservationTemplate, 't');

    if (filters?.type) {
      qb.andWhere({ type: filters.type });
    }
    if (filters?.project !== undefined) {
      if (filters.project === null) {
        qb.andWhere({ project: null });
      } else {
        // Include both project-specific and global templates
        qb.andWhere({
          $or: [
            { project: filters.project },
            { project: null },
          ],
        });
      }
    }
    if (filters?.isDefault !== undefined) {
      qb.andWhere({ is_default: filters.isDefault });
    }
    if (filters?.isSystem !== undefined) {
      qb.andWhere({ is_system: filters.isSystem });
    }

    qb.orderBy({ [options?.orderBy || 'name']: options?.order || 'ASC' });

    if (options?.limit) qb.limit(options.limit);
    if (options?.offset) qb.offset(options.offset);

    const entities = await qb.getResult();
    return entities.map(toRecord);
  }

  async getByType(type: ObservationType, project?: string): Promise<ObservationTemplateRecord[]> {
    return this.list({ type, project });
  }

  async getDefaults(project?: string): Promise<ObservationTemplateRecord[]> {
    return this.list({ isDefault: true, project });
  }

  async delete(id: number): Promise<boolean> {
    const entity = await this.em.findOne(ObservationTemplate, { id });
    if (!entity) return false;

    // Cannot delete system templates
    if (entity.is_system) {
      throw new Error('Cannot delete system templates');
    }

    this.em.remove(entity);
    await this.em.flush();
    return true;
  }

  async count(filters?: TemplateQueryFilters): Promise<number> {
    const qb = this.em.createQueryBuilder(ObservationTemplate, 't');

    if (filters?.type) {
      qb.andWhere({ type: filters.type });
    }
    if (filters?.project !== undefined) {
      if (filters.project === null) {
        qb.andWhere({ project: null });
      } else {
        qb.andWhere({
          $or: [
            { project: filters.project },
            { project: null },
          ],
        });
      }
    }
    if (filters?.isDefault !== undefined) {
      qb.andWhere({ is_default: filters.isDefault });
    }
    if (filters?.isSystem !== undefined) {
      qb.andWhere({ is_system: filters.isSystem });
    }

    return qb.count();
  }
}

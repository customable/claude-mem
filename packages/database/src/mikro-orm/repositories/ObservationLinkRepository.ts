/**
 * MikroORM Observation Link Repository
 *
 * Manages links/relationships between observations.
 */

import type { SqlEntityManager } from '@mikro-orm/knex';
import type {
  IObservationLinkRepository,
  CreateObservationLinkInput,
  ObservationLinkQueryFilters,
  QueryOptions,
  ObservationLinkRecord,
  ObservationLinkType,
} from '@claude-mem/types';
import { ObservationLink } from '../../entities/ObservationLink.js';

/**
 * Convert ObservationLink entity to ObservationLinkRecord
 */
function toRecord(entity: ObservationLink): ObservationLinkRecord {
  return {
    id: entity.id,
    source_id: entity.source_id,
    target_id: entity.target_id,
    link_type: entity.link_type as ObservationLinkType,
    description: entity.description,
    created_at: entity.created_at,
    created_at_epoch: entity.created_at_epoch,
  };
}

export class MikroOrmObservationLinkRepository implements IObservationLinkRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async create(input: CreateObservationLinkInput): Promise<ObservationLinkRecord> {
    const now = new Date();
    const entity = this.em.create(ObservationLink, {
      source_id: input.sourceId,
      target_id: input.targetId,
      link_type: input.linkType,
      description: input.description,
      created_at: now.toISOString(),
      created_at_epoch: now.getTime(),
    });

    this.em.persist(entity);
    await this.em.flush();
    return toRecord(entity);
  }

  async findById(id: number): Promise<ObservationLinkRecord | null> {
    const entity = await this.em.findOne(ObservationLink, { id });
    return entity ? toRecord(entity) : null;
  }

  async getLinksFrom(sourceId: number, linkType?: ObservationLinkType): Promise<ObservationLinkRecord[]> {
    const where: Record<string, unknown> = { source_id: sourceId };
    if (linkType) {
      where.link_type = linkType;
    }

    const entities = await this.em.find(ObservationLink, where, {
      orderBy: { created_at_epoch: 'DESC' },
    });
    return entities.map(toRecord);
  }

  async getLinksTo(targetId: number, linkType?: ObservationLinkType): Promise<ObservationLinkRecord[]> {
    const where: Record<string, unknown> = { target_id: targetId };
    if (linkType) {
      where.link_type = linkType;
    }

    const entities = await this.em.find(ObservationLink, where, {
      orderBy: { created_at_epoch: 'DESC' },
    });
    return entities.map(toRecord);
  }

  async getAllLinks(observationId: number): Promise<ObservationLinkRecord[]> {
    const entities = await this.em.find(
      ObservationLink,
      {
        $or: [
          { source_id: observationId },
          { target_id: observationId },
        ],
      },
      { orderBy: { created_at_epoch: 'DESC' } }
    );
    return entities.map(toRecord);
  }

  async linkExists(sourceId: number, targetId: number, linkType: ObservationLinkType): Promise<boolean> {
    const count = await this.em.count(ObservationLink, {
      source_id: sourceId,
      target_id: targetId,
      link_type: linkType,
    });
    return count > 0;
  }

  async delete(id: number): Promise<boolean> {
    const entity = await this.em.findOne(ObservationLink, { id });
    if (!entity) return false;
    this.em.remove(entity);
    await this.em.flush();
    return true;
  }

  async deleteByObservationId(observationId: number): Promise<number> {
    const result = await this.em.nativeDelete(ObservationLink, {
      $or: [
        { source_id: observationId },
        { target_id: observationId },
      ],
    });
    return result;
  }

  async list(filters?: ObservationLinkQueryFilters, options?: QueryOptions): Promise<ObservationLinkRecord[]> {
    const qb = this.em.createQueryBuilder(ObservationLink, 'l');

    if (filters?.sourceId) {
      qb.andWhere({ source_id: filters.sourceId });
    }
    if (filters?.targetId) {
      qb.andWhere({ target_id: filters.targetId });
    }
    if (filters?.linkType) {
      if (Array.isArray(filters.linkType)) {
        qb.andWhere({ link_type: { $in: filters.linkType } });
      } else {
        qb.andWhere({ link_type: filters.linkType });
      }
    }

    qb.orderBy({ [options?.orderBy || 'created_at_epoch']: options?.order || 'DESC' });

    if (options?.limit) qb.limit(options.limit);
    if (options?.offset) qb.offset(options.offset);

    const entities = await qb.getResult();
    return entities.map(toRecord);
  }

  async count(filters?: ObservationLinkQueryFilters): Promise<number> {
    const qb = this.em.createQueryBuilder(ObservationLink, 'l');

    if (filters?.sourceId) {
      qb.andWhere({ source_id: filters.sourceId });
    }
    if (filters?.targetId) {
      qb.andWhere({ target_id: filters.targetId });
    }
    if (filters?.linkType) {
      if (Array.isArray(filters.linkType)) {
        qb.andWhere({ link_type: { $in: filters.linkType } });
      } else {
        qb.andWhere({ link_type: filters.linkType });
      }
    }

    return qb.count();
  }
}

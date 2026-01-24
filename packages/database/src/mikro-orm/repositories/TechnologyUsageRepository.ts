/**
 * TechnologyUsage Repository
 *
 * Repository for tracking technology usage across observations.
 */

import type { SqlEntityManager } from '@mikro-orm/knex';
import type { ITechnologyUsageRepository, TechnologyUsageRecord, CreateTechnologyUsageInput } from '@claude-mem/types';
import { TechnologyUsage } from '../../entities/TechnologyUsage.js';

export class MikroOrmTechnologyUsageRepository implements ITechnologyUsageRepository {
  constructor(private em: SqlEntityManager) {}

  async upsert(input: CreateTechnologyUsageInput): Promise<TechnologyUsageRecord> {
    const existing = await this.em.findOne(TechnologyUsage, {
      name: input.name,
      project: input.project ?? null,
    });

    if (existing) {
      existing.last_used_epoch = Date.now();
      existing.observation_count += 1;
      if (input.category && !existing.category) {
        existing.category = input.category;
      }

      this.em.persist(existing);
      await this.em.flush();
      return this.toRecord(existing);
    }

    // Create new record
    const tech = new TechnologyUsage();
    tech.name = input.name;
    tech.category = input.category;
    tech.project = input.project;
    tech.first_seen_epoch = Date.now();
    tech.last_used_epoch = Date.now();
    tech.observation_count = 1;

    this.em.persist(tech);
    await this.em.flush();
    return this.toRecord(tech);
  }

  async incrementUsage(name: string, project?: string): Promise<TechnologyUsageRecord | null> {
    const tech = await this.em.findOne(TechnologyUsage, {
      name,
      project: project ?? null,
    });

    if (!tech) {
      return null;
    }

    tech.last_used_epoch = Date.now();
    tech.observation_count += 1;

    this.em.persist(tech);
    await this.em.flush();
    return this.toRecord(tech);
  }

  async getTopTechnologies(limit: number, project?: string): Promise<TechnologyUsageRecord[]> {
    const filter: Record<string, unknown> = {};
    if (project) {
      filter.project = project;
    }

    const techs = await this.em.find(TechnologyUsage, filter, {
      orderBy: { observation_count: 'DESC' },
      limit,
    });

    return techs.map(t => this.toRecord(t));
  }

  async getByProject(project: string): Promise<TechnologyUsageRecord[]> {
    const techs = await this.em.find(
      TechnologyUsage,
      { project },
      { orderBy: { observation_count: 'DESC' } }
    );
    return techs.map(t => this.toRecord(t));
  }

  async getDistinctCategories(): Promise<string[]> {
    const result = await this.em.getConnection().execute<{ category: string }[]>(
      'SELECT DISTINCT category FROM technology_usage WHERE category IS NOT NULL ORDER BY category'
    );
    return result.map(r => r.category);
  }

  async count(project?: string): Promise<number> {
    const filter: Record<string, unknown> = {};
    if (project) {
      filter.project = project;
    }
    return this.em.count(TechnologyUsage, filter);
  }

  private toRecord(entity: TechnologyUsage): TechnologyUsageRecord {
    return {
      id: entity.id,
      name: entity.name,
      category: entity.category ?? null,
      first_seen_epoch: entity.first_seen_epoch,
      last_used_epoch: entity.last_used_epoch,
      observation_count: entity.observation_count,
      project: entity.project ?? null,
    };
  }
}

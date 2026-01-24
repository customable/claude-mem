/**
 * TechnologyUsage Entity
 *
 * Tracks technology usage across observations for insights dashboard.
 */

import { Entity, PrimaryKey, Property, Index, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'technology_usage' })
@Unique({ properties: ['name', 'project'] })
export class TechnologyUsage {
  @PrimaryKey()
  id!: number;

  @Property()
  @Index()
  name!: string;

  @Property({ nullable: true })
  category?: string; // 'language', 'framework', 'database', 'tool', etc.

  @Property()
  first_seen_epoch!: number;

  @Property()
  last_used_epoch!: number;

  @Property({ default: 0 })
  @Index()
  observation_count!: number;

  @Property({ nullable: true })
  @Index()
  project?: string;
}

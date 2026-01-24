/**
 * DailyStats Entity
 *
 * Aggregated daily statistics for the learning insights dashboard.
 */

import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';

@Entity({ tableName: 'daily_stats' })
export class DailyStats {
  @PrimaryKey()
  id!: number;

  @Property()
  @Index()
  date!: string; // YYYY-MM-DD format

  @Property({ default: 0 })
  observation_count!: number;

  @Property({ default: 0 })
  session_count!: number;

  @Property({ default: 0 })
  project_count!: number;

  @Property({ default: 0 })
  decision_count!: number;

  @Property({ default: 0 })
  error_count!: number;

  @Property({ default: 0 })
  bug_fix_count!: number;

  @Property({ default: 0 })
  discovery_count!: number;

  @Property({ default: 0 })
  tokens_used!: number;

  @Property({ nullable: true, type: 'text' })
  technologies?: string; // JSON array of technology names

  @Property({ nullable: true, type: 'text' })
  projects?: string; // JSON array of project names

  @Property()
  created_at_epoch!: number;
}

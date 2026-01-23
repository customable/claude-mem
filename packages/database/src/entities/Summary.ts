/**
 * Summary Entity
 *
 * Session summaries with learning outcomes.
 */

import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';

@Entity({ tableName: 'session_summaries' })
export class Summary {
  @PrimaryKey()
  id!: number;

  @Property()
  @Index()
  memory_session_id!: string;

  @Property()
  @Index()
  project!: string;

  @Property({ nullable: true, type: 'text' })
  request?: string;

  @Property({ nullable: true, type: 'text' })
  investigated?: string;

  @Property({ nullable: true, type: 'text' })
  learned?: string;

  @Property({ nullable: true, type: 'text' })
  completed?: string;

  @Property({ nullable: true, type: 'text' })
  next_steps?: string;

  @Property({ nullable: true })
  prompt_number?: number;

  @Property({ nullable: true })
  discovery_tokens?: number;

  @Property()
  created_at!: string;

  @Property()
  @Index()
  created_at_epoch!: number;
}

/**
 * Summary Entity
 *
 * Session summaries with learning outcomes.
 */

import { Entity, PrimaryKey, Property, Index, ManyToOne, type Ref } from '@mikro-orm/core';
import type { Session } from './Session.js';

@Entity({ tableName: 'summaries' })
export class Summary {
  @PrimaryKey()
  id!: number;

  /**
   * Session ID (FK stored in database)
   */
  @Property()
  @Index()
  memory_session_id!: string;

  /**
   * Relation to Session via memory_session_id (Issue #267)
   * Virtual relation for ORM navigation
   */
  @ManyToOne('Session', {
    fieldName: 'memory_session_id',
    referencedColumnNames: ['memory_session_id'],
    ref: true,
    persist: false,
  })
  session?: Ref<Session>;

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

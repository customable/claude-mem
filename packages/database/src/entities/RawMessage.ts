/**
 * RawMessage Entity
 *
 * Stores raw messages without AI processing (Lazy Mode).
 * Messages are processed on-demand or in batches.
 */

import { Entity, PrimaryKey, Property, Index, ManyToOne, type Ref } from '@mikro-orm/core';
import type { Session } from './Session.js';
import type { Observation } from './Observation.js';

@Entity({ tableName: 'raw_messages' })
export class RawMessage {
  @PrimaryKey()
  id!: number;

  /**
   * Session ID (FK stored in database)
   */
  @Property()
  @Index()
  session_id!: string;

  /**
   * Relation to Session via session_id (Issue #267)
   * Virtual relation for ORM navigation
   */
  @ManyToOne('Session', {
    fieldName: 'session_id',
    referencedColumnNames: ['content_session_id'],
    ref: true,
    persist: false,
  })
  session?: Ref<Session>;

  @Property()
  @Index()
  project!: string;

  @Property({ nullable: true })
  prompt_number?: number;

  @Property()
  role!: 'user' | 'assistant' | 'tool';

  @Property({ type: 'text' })
  content!: string;

  @Property({ type: 'text', nullable: true })
  tool_calls?: string; // JSON array of tool calls

  @Property({ type: 'text', nullable: true })
  tool_name?: string;

  @Property({ type: 'text', nullable: true })
  tool_input?: string;

  @Property({ type: 'text', nullable: true })
  tool_output?: string;

  @Property({ default: false })
  @Index()
  processed!: boolean;

  @Property({ nullable: true })
  processed_at?: string;

  @Property({ nullable: true })
  processed_at_epoch?: number;

  /**
   * Observation ID (FK stored in database)
   */
  @Property({ nullable: true })
  observation_id?: number;

  /**
   * Relation to generated Observation (Issue #267)
   * Virtual relation for ORM navigation
   */
  @ManyToOne('Observation', {
    fieldName: 'observation_id',
    ref: true,
    persist: false,
  })
  observation?: Ref<Observation>;

  @Property()
  created_at!: string;

  @Property()
  @Index()
  created_at_epoch!: number;
}

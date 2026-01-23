/**
 * Session Entity
 *
 * Represents a Claude Code SDK session.
 */

import { Entity, PrimaryKey, Property, Unique, Index } from '@mikro-orm/core';

export type SessionStatus = 'active' | 'completed' | 'failed';

@Entity({ tableName: 'sdk_sessions' })
export class Session {
  @PrimaryKey()
  id!: number;

  @Property()
  @Unique()
  content_session_id!: string;

  @Property({ nullable: true })
  @Index()
  memory_session_id?: string;

  @Property()
  @Index()
  project!: string;

  @Property({ nullable: true, type: 'text' })
  user_prompt?: string;

  @Property()
  started_at!: string;

  @Property()
  @Index()
  started_at_epoch!: number;

  @Property({ nullable: true })
  completed_at?: string;

  @Property({ nullable: true })
  completed_at_epoch?: number;

  @Property({ default: 'active' })
  @Index()
  status!: SessionStatus;

  @Property({ nullable: true })
  worker_port?: number;

  @Property({ default: 0 })
  prompt_counter!: number;
}

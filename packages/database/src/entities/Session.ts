/**
 * Session Entity
 *
 * Represents a Claude Code SDK session.
 */

import { Entity, PrimaryKey, Property, Unique, Index, OneToMany, Collection, Cascade } from '@mikro-orm/core';
import type { UserPrompt } from './UserPrompt.js';
import type { Summary } from './Summary.js';
import type { ClaudeMd } from './ClaudeMd.js';
import type { RawMessage } from './RawMessage.js';

export type SessionStatus = 'active' | 'completed' | 'failed';

@Entity({ tableName: 'sessions' })
@Index({ properties: ['project', 'started_at_epoch'] })
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

  @Property({ nullable: true })
  working_directory?: string;

  @Property({ nullable: true })
  @Index()
  repo_path?: string;

  @Property({ nullable: true, type: 'boolean', default: false })
  is_worktree?: boolean;

  @Property({ nullable: true })
  branch?: string;

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

  // Relations - Session as central hub (Issue #267 Phase 4)
  // Note: These use virtual relations via string session IDs
  @OneToMany('UserPrompt', 'session', {
    cascade: [Cascade.PERSIST],
    orphanRemoval: true,
  })
  prompts = new Collection<UserPrompt>(this);

  @OneToMany('Summary', 'session', {
    cascade: [Cascade.PERSIST],
    orphanRemoval: true,
  })
  summaries = new Collection<Summary>(this);

  @OneToMany('ClaudeMd', 'contentSession', {
    cascade: [Cascade.PERSIST],
    orphanRemoval: true,
  })
  claudeMdFiles = new Collection<ClaudeMd>(this);

  @OneToMany('RawMessage', 'session', {
    cascade: [Cascade.PERSIST],
    orphanRemoval: true,
  })
  rawMessages = new Collection<RawMessage>(this);
}

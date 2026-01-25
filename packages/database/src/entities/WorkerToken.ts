/**
 * WorkerToken Entity (Issue #263)
 *
 * Token-based worker authentication following GitLab/Forgejo runner patterns.
 * Tokens can be created, used by multiple workers, and revoked.
 */

import { Entity, PrimaryKey, Property, Index, OneToMany, Collection } from '@mikro-orm/core';
import { WorkerRegistration } from './WorkerRegistration.js';

export type TokenScope = 'instance' | 'group' | 'project';

@Entity({ tableName: 'worker_tokens' })
export class WorkerToken {
  @PrimaryKey({ type: 'string' })
  id!: string;

  @Property()
  @Index()
  name!: string;

  @Property({ type: 'text' })
  token_hash!: string; // bcrypt hash of the actual token

  @Property()
  token_prefix!: string; // "cmwt-abc" for display (first 12 chars)

  @Property({ default: 'instance' })
  @Index()
  scope!: TokenScope;

  @Property({ nullable: true })
  @Index()
  hub_id?: string; // For 'group' scope - restricts to specific hub

  @Property({ nullable: true })
  project_filter?: string; // For 'project' scope - project name pattern

  @Property({ type: 'json', nullable: true })
  capabilities?: string[]; // Restrict which capabilities workers can claim

  @Property({ type: 'json', nullable: true })
  labels?: Record<string, string>; // Labels for routing

  @Property()
  created_at!: Date;

  @Property({ nullable: true })
  expires_at?: Date;

  @Property({ nullable: true })
  last_used_at?: Date;

  @Property({ nullable: true })
  @Index()
  revoked_at?: Date; // If set, token is revoked

  @OneToMany(() => WorkerRegistration, (reg) => reg.token)
  registrations = new Collection<WorkerRegistration>(this);
}

/**
 * WorkerRegistration Entity (Issue #263)
 *
 * Tracks individual worker instances that have connected using a token.
 * Multiple workers can use the same token.
 */

import { Entity, PrimaryKey, Property, Index, ManyToOne, ref } from '@mikro-orm/core';
import type { Ref } from '@mikro-orm/core';
import { WorkerToken } from './WorkerToken.js';

export type RegistrationStatus = 'online' | 'offline';

@Entity({ tableName: 'worker_registrations' })
@Index({ properties: ['token', 'status'] })
export class WorkerRegistration {
  @PrimaryKey({ type: 'string' })
  id!: string;

  @ManyToOne(() => WorkerToken, { ref: true })
  token!: Ref<WorkerToken>;

  @Property()
  @Index()
  system_id!: string; // hostname + pid - unique per worker instance

  @Property({ nullable: true })
  hostname?: string;

  @Property({ nullable: true })
  worker_id?: string; // WebSocket worker ID once connected

  @Property({ type: 'json', nullable: true })
  labels?: Record<string, string>;

  @Property({ type: 'json', nullable: true })
  capabilities?: string[];

  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>; // version, agent, etc.

  @Property({ default: 'offline' })
  @Index()
  status!: RegistrationStatus;

  @Property()
  connected_at!: Date;

  @Property({ nullable: true })
  disconnected_at?: Date;

  @Property({ nullable: true })
  last_heartbeat?: Date;

  /**
   * Helper to set token reference
   */
  setToken(token: WorkerToken): void {
    this.token = ref(token);
  }
}

/**
 * Hub Entity (Issue #263)
 *
 * Registry of worker hubs. The backend has a built-in hub,
 * and external hubs can federate with it.
 */

import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';

export type HubType = 'builtin' | 'external';
export type HubStatus = 'healthy' | 'degraded' | 'unhealthy' | 'offline';

@Entity({ tableName: 'hubs' })
export class Hub {
  @PrimaryKey({ type: 'string' })
  id!: string;

  @Property()
  @Index()
  name!: string;

  @Property({ default: 'builtin' })
  @Index()
  type!: HubType;

  @Property({ nullable: true })
  endpoint?: string; // WebSocket URL for external hubs

  @Property({ default: 50 })
  priority!: number; // Higher = preferred (0-100)

  @Property({ default: 100 })
  weight!: number; // For weighted routing (0-100)

  @Property({ nullable: true })
  region?: string; // Geographic region for locality-aware routing

  @Property({ type: 'json', nullable: true })
  labels?: Record<string, string>; // For tag-based routing

  @Property({ type: 'json', nullable: true })
  capabilities?: string[]; // Aggregated from connected workers

  @Property({ default: 'healthy' })
  @Index()
  status!: HubStatus;

  @Property({ default: 0 })
  connected_workers!: number;

  @Property({ default: 0 })
  active_workers!: number; // Workers currently processing tasks

  @Property({ nullable: true })
  avg_latency_ms?: number;

  @Property()
  created_at!: Date;

  @Property({ nullable: true })
  last_heartbeat?: Date;
}

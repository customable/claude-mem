/**
 * Task Entity
 *
 * Task queue for backend/worker coordination.
 */

import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';
import type { TaskStatus, TaskType } from '@claude-mem/types';

@Entity({ tableName: 'tasks' })
@Index({ properties: ['assigned_worker_id', 'status'] })
@Index({ properties: ['required_capability', 'status', 'priority'] })
export class Task {
  @PrimaryKey({ type: 'string' })
  id!: string;

  @Property()
  @Index()
  type!: TaskType;

  @Property({ default: 'pending' })
  @Index()
  status!: TaskStatus;

  @Property()
  @Index()
  required_capability!: string;

  @Property({ nullable: true, type: 'text' })
  fallback_capabilities?: string; // JSON array

  @Property({ default: 0 })
  priority!: number;

  @Property({ type: 'text' })
  payload!: string; // JSON

  @Property({ nullable: true, type: 'text' })
  result?: string; // JSON

  @Property({ nullable: true, type: 'text' })
  error?: string;

  @Property({ default: 0 })
  retry_count!: number;

  @Property({ default: 3 })
  max_retries!: number;

  @Property({ nullable: true })
  @Index()
  assigned_worker_id?: string;

  @Property()
  created_at!: number; // epoch

  @Property({ nullable: true })
  assigned_at?: number; // epoch

  @Property({ nullable: true })
  completed_at?: number; // epoch

  @Property({ nullable: true })
  @Index()
  retry_after?: number; // epoch - when task can be retried (Issue #206)

  @Property({ nullable: true })
  @Index()
  deduplication_key?: string; // Hash of type+payload for deduplication (Issue #207)
}

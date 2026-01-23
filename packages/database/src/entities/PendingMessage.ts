/**
 * PendingMessage Entity
 *
 * Legacy async processing queue.
 */

import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';

@Entity({ tableName: 'pending_messages' })
export class PendingMessage {
  @PrimaryKey()
  id!: number;

  @Property()
  @Index()
  session_id!: string;

  @Property()
  project!: string;

  @Property({ nullable: true })
  prompt_number?: number;

  @Property()
  tool_name!: string;

  @Property({ type: 'text' })
  tool_input!: string;

  @Property({ type: 'text' })
  tool_output!: string;

  @Property({ default: 'pending' })
  @Index()
  status!: string;

  @Property({ nullable: true, type: 'text' })
  error?: string;

  @Property({ default: 0 })
  retry_count!: number;

  @Property()
  created_at!: string;

  @Property()
  @Index()
  created_at_epoch!: number;

  @Property({ nullable: true })
  processed_at?: string;

  @Property({ nullable: true })
  processed_at_epoch?: number;
}

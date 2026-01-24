/**
 * RawMessage Entity
 *
 * Stores raw messages without AI processing (Lazy Mode).
 * Messages are processed on-demand or in batches.
 */

import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';

@Entity({ tableName: 'raw_messages' })
export class RawMessage {
  @PrimaryKey()
  id!: number;

  @Property()
  @Index()
  session_id!: string;

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

  @Property({ nullable: true })
  observation_id?: number; // Reference to generated observation

  @Property()
  created_at!: string;

  @Property()
  @Index()
  created_at_epoch!: number;
}

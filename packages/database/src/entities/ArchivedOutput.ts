/**
 * Archived Output Entity
 *
 * Stores full tool outputs for Endless Mode (Issue #109).
 * Enables perfect recall while using compressed observations in context.
 */

import { Entity, PrimaryKey, Property, Index, ManyToOne } from '@mikro-orm/core';
import type { CompressionStatus } from '@claude-mem/types';
import type { Observation } from './Observation.js';

@Entity({ tableName: 'archived_outputs' })
@Index({ properties: ['project', 'created_at_epoch'] })
@Index({ properties: ['memory_session_id'] })
@Index({ properties: ['compression_status'] })
export class ArchivedOutput {
  @PrimaryKey()
  id!: number;

  @Property()
  @Index()
  memory_session_id!: string;

  @Property()
  @Index()
  project!: string;

  @Property()
  tool_name!: string;

  @Property({ type: 'text' })
  tool_input!: string; // JSON string

  @Property({ type: 'text' })
  tool_output!: string; // Full uncompressed output

  @Property({ nullable: true })
  @Index()
  compressed_observation_id?: number;

  @Property({ default: 'pending' })
  @Index()
  compression_status!: CompressionStatus;

  @Property({ nullable: true })
  token_count?: number;

  @Property({ nullable: true })
  compressed_token_count?: number;

  @Property({ nullable: true, type: 'text' })
  error_message?: string;

  @Property()
  created_at!: string;

  @Property()
  @Index()
  created_at_epoch!: number;

  @Property({ nullable: true })
  compressed_at?: string;

  @Property({ nullable: true })
  compressed_at_epoch?: number;

  // Optional relation to compressed observation
  @ManyToOne('Observation', { nullable: true })
  compressedObservation?: Observation;
}

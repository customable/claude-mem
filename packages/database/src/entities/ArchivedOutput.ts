/**
 * Archived Output Entity
 *
 * Stores full tool outputs for Endless Mode (Issue #109).
 * Enables perfect recall while using compressed observations in context.
 */

import { Entity, PrimaryKey, Property, Index, ManyToOne, type Ref } from '@mikro-orm/core';
import type { CompressionStatus } from '@claude-mem/types';
import type { Observation } from './Observation.js';

@Entity({ tableName: 'archived_outputs' })
// Composite index for time-based project queries (Issue #267 Phase 5)
@Index({ properties: ['project', 'created_at_epoch'] })
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

  /**
   * Relation to the compressed Observation created from this archived output.
   * Uses Ref<T> for type-safe lazy loading (MikroORM best practice).
   * The fieldName preserves backwards compatibility with existing data.
   */
  @ManyToOne('Observation', {
    fieldName: 'compressed_observation_id',
    nullable: true,
    ref: true,
    // persist: false would skip FK constraint - keeping true for proper relations
  })
  @Index()
  compressedObservation?: Ref<Observation>;

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
}

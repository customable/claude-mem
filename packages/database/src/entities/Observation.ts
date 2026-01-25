/**
 * Observation Entity
 *
 * AI-generated observations from Claude Code sessions.
 */

import { Entity, PrimaryKey, Property, Index, OneToMany, Collection } from '@mikro-orm/core';
import type { ObservationType } from '@claude-mem/types';
import type { ArchivedOutput } from './ArchivedOutput.js';
import type { CodeSnippet } from './CodeSnippet.js';
import type { Document } from './Document.js';
import type { ObservationLink } from './ObservationLink.js';
import type { RawMessage } from './RawMessage.js';

@Entity({ tableName: 'observations' })
@Index({ properties: ['project', 'created_at_epoch'] })
@Index({ properties: ['working_directory'] })
export class Observation {
  @PrimaryKey()
  id!: number;

  @Property()
  @Index()
  memory_session_id!: string;

  @Property()
  @Index()
  project!: string;

  @Property({ nullable: true, type: 'text' })
  text?: string;

  @Property({ default: 'discovery' })
  @Index()
  type!: ObservationType;

  @Property({ nullable: true })
  title?: string;

  @Property({ nullable: true })
  subtitle?: string;

  @Property({ nullable: true, type: 'text' })
  narrative?: string;

  @Property({ nullable: true })
  concept?: string;

  @Property({ nullable: true, type: 'text' })
  concepts?: string; // JSON array

  @Property({ nullable: true, type: 'text' })
  facts?: string; // JSON array

  @Property({ nullable: true, type: 'text' })
  source_files?: string;

  @Property({ nullable: true, type: 'text' })
  files_read?: string; // JSON array

  @Property({ nullable: true, type: 'text' })
  files_modified?: string; // JSON array

  @Property({ nullable: true })
  git_branch?: string;

  @Property({ nullable: true })
  working_directory?: string;

  @Property({ nullable: true })
  @Index()
  repo_path?: string;

  @Property({ nullable: true })
  prompt_number?: number;

  @Property({ nullable: true })
  discovery_tokens?: number;

  @Property()
  created_at!: string;

  @Property()
  @Index()
  created_at_epoch!: number;

  // Decision tracking (for conflict detection)
  @Property({ nullable: true })
  decision_category?: string;

  @Property({ nullable: true })
  superseded_by?: number;

  @Property({ nullable: true })
  supersedes?: number;

  @Property({ nullable: true })
  superseded_at?: string;

  // Memory tiering (for Sleep Agent)
  @Property({ nullable: true, default: 'working' })
  @Index()
  memory_tier?: string; // 'core' | 'working' | 'archive' | 'ephemeral'

  @Property({ nullable: true })
  tier_changed_at?: string;

  @Property({ nullable: true, default: 0 })
  access_count?: number;

  @Property({ nullable: true })
  last_accessed_at?: string;

  @Property({ nullable: true })
  @Index()
  last_accessed_at_epoch?: number;

  @Property({ nullable: true })
  consolidation_score?: number;

  // Importance scoring
  @Property({ nullable: true, default: false })
  @Index()
  pinned?: boolean;

  @Property({ nullable: true, default: 0 })
  importance_boost?: number; // Manual boost (-10 to +10)

  // Relations (string references to avoid circular imports)
  @OneToMany('CodeSnippet', 'observation')
  codeSnippets = new Collection<CodeSnippet>(this);

  @OneToMany('Document', 'observation')
  documents = new Collection<Document>(this);

  @OneToMany('ObservationLink', 'source')
  outgoingLinks = new Collection<ObservationLink>(this);

  @OneToMany('ObservationLink', 'target')
  incomingLinks = new Collection<ObservationLink>(this);

  // Endless Mode: archived outputs that were compressed into this observation
  @OneToMany('ArchivedOutput', 'compressedObservation')
  archivedOutputs = new Collection<ArchivedOutput>(this);

  // Lazy Mode: raw messages that generated this observation
  @OneToMany('RawMessage', 'observation')
  rawMessages = new Collection<RawMessage>(this);
}

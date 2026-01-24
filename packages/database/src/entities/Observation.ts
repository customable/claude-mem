/**
 * Observation Entity
 *
 * AI-generated observations from Claude Code sessions.
 */

import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';
import type { ObservationType } from '@claude-mem/types';

@Entity({ tableName: 'observations' })
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
  cwd?: string;

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
}

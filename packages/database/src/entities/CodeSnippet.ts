/**
 * CodeSnippet Entity
 *
 * Extracted code snippets from observations for search and indexing.
 */

import { Entity, PrimaryKey, Property, Index, ManyToOne } from '@mikro-orm/core';
import { Observation } from './Observation.js';

@Entity({ tableName: 'code_snippets' })
export class CodeSnippet {
  @PrimaryKey()
  id!: number;

  @Property()
  @Index()
  observation_id!: number;

  @ManyToOne(() => Observation, { nullable: true })
  observation?: Observation;

  @Property()
  @Index()
  memory_session_id!: string;

  @Property()
  @Index()
  project!: string;

  @Property({ nullable: true })
  @Index()
  language?: string;

  @Property({ type: 'text' })
  code!: string;

  @Property({ nullable: true })
  @Index()
  file_path?: string;

  @Property({ nullable: true })
  line_start?: number;

  @Property({ nullable: true })
  line_end?: number;

  @Property({ nullable: true, type: 'text' })
  context?: string;

  @Property()
  created_at_epoch!: number;
}

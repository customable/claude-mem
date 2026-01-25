/**
 * ClaudeMd Entity
 *
 * Generated CLAUDE.md content per project.
 */

import { Entity, PrimaryKey, Property, Index, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'claudemd' })
@Unique({ properties: ['project', 'content_session_id'] })
export class ClaudeMd {
  @PrimaryKey()
  id!: number;

  @Property()
  @Index()
  project!: string;

  @Property({ type: 'text' })
  content!: string;

  @Property()
  content_session_id!: string;

  @Property({ nullable: true })
  memory_session_id?: string;

  @Property({ nullable: true })
  working_directory?: string;

  @Property()
  @Index()
  generated_at!: number; // epoch

  @Property({ default: 0 })
  tokens!: number;
}

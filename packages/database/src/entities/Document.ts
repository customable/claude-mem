/**
 * Document Entity
 *
 * Cached MCP documentation (Context7, WebFetch, etc.)
 */

import { Entity, PrimaryKey, Property, Index, Unique } from '@mikro-orm/core';
import type { DocumentType } from '@claude-mem/types';

@Entity({ tableName: 'documents' })
export class Document {
  @PrimaryKey()
  id!: number;

  @Property()
  @Index()
  project!: string;

  @Property()
  @Index()
  source!: string;

  @Property()
  @Index()
  source_tool!: string;

  @Property({ nullable: true })
  title?: string;

  @Property({ type: 'text' })
  content!: string;

  @Property()
  @Unique()
  @Index()
  content_hash!: string;

  @Property({ default: 'library-docs' })
  @Index()
  type!: DocumentType;

  @Property({ nullable: true, type: 'text' })
  metadata?: string; // JSON

  @Property({ nullable: true })
  memory_session_id?: string;

  @Property({ nullable: true })
  observation_id?: number;

  @Property({ default: 1 })
  access_count!: number;

  @Property()
  @Index()
  last_accessed_epoch!: number;

  @Property()
  created_at!: string;

  @Property()
  @Index()
  created_at_epoch!: number;
}

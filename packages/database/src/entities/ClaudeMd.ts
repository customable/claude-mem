/**
 * ClaudeMd Entity
 *
 * Generated CLAUDE.md content per project.
 */

import { Entity, PrimaryKey, Property, Index, Unique, ManyToOne, type Ref } from '@mikro-orm/core';
import type { Session } from './Session.js';

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

  /**
   * Content Session ID (FK stored in database)
   */
  @Property()
  content_session_id!: string;

  /**
   * Memory Session ID (may differ from content_session_id)
   */
  @Property({ nullable: true })
  memory_session_id?: string;

  /**
   * Relation to Session via content_session_id (Issue #267)
   * Virtual relation for ORM navigation
   */
  @ManyToOne('Session', {
    fieldName: 'content_session_id',
    referencedColumnNames: ['content_session_id'],
    ref: true,
    persist: false,
  })
  contentSession?: Ref<Session>;

  /**
   * Relation to Session via memory_session_id
   * Virtual relation for ORM navigation
   */
  @ManyToOne('Session', {
    fieldName: 'memory_session_id',
    referencedColumnNames: ['memory_session_id'],
    ref: true,
    persist: false,
  })
  memorySession?: Ref<Session>;

  @Property({ nullable: true })
  working_directory?: string;

  @Property()
  @Index()
  generated_at!: number; // epoch

  @Property({ default: 0 })
  tokens!: number;
}

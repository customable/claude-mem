/**
 * UserPrompt Entity
 *
 * Tracks user messages/prompts per session.
 */

import { Entity, PrimaryKey, Property, Index, Unique, ManyToOne, type Ref } from '@mikro-orm/core';
import type { Session } from './Session.js';

@Entity({ tableName: 'prompts' })
@Unique({ properties: ['content_session_id', 'prompt_number'] })
export class UserPrompt {
  @PrimaryKey()
  id!: number;

  /**
   * Session ID (FK stored in database)
   * Kept as regular property for backwards compatibility in queries and records
   */
  @Property()
  @Index()
  content_session_id!: string;

  /**
   * Relation to Session via content_session_id (Issue #267)
   * Virtual relation for ORM navigation - uses existing FK column
   */
  @ManyToOne('Session', {
    fieldName: 'content_session_id',
    referencedColumnNames: ['content_session_id'],
    ref: true,
    persist: false, // Don't persist - uses existing content_session_id column
  })
  session?: Ref<Session>;

  @Property()
  prompt_number!: number;

  @Property({ type: 'text' })
  prompt_text!: string;

  @Property()
  created_at!: string;

  @Property()
  @Index()
  created_at_epoch!: number;

  /** Whether this prompt was detected as urgent (CAPSLOCK) - Issue #233 */
  @Property({ default: false })
  @Index()
  is_urgent: boolean = false;
}

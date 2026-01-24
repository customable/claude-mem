/**
 * UserPrompt Entity
 *
 * Tracks user messages/prompts per session.
 */

import { Entity, PrimaryKey, Property, Index, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'user_prompts' })
@Unique({ properties: ['content_session_id', 'prompt_number'] })
export class UserPrompt {
  @PrimaryKey()
  id!: number;

  @Property()
  @Index()
  content_session_id!: string;

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

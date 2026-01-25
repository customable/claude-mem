/**
 * UserTask Entity (Issue #260)
 *
 * Tracks user-facing tasks from CLI tools (Claude Code TaskCreate/TaskUpdate,
 * Cursor, Aider, etc.). This is separate from the worker Task entity which
 * handles backend job coordination.
 *
 * The WebUI is read-only - all mutations come from CLI hooks.
 */

import { Entity, PrimaryKey, Property, Index, ManyToOne, OneToMany, Collection } from '@mikro-orm/core';
import type { Session } from './Session.js';

/**
 * Task status lifecycle (based on AiderDesk pattern)
 */
export type UserTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'more_info_needed'
  | 'ready_for_review'
  | 'completed'
  | 'cancelled';

/**
 * Source CLI that created this task
 */
export type UserTaskSource =
  | 'claude-code'
  | 'cursor'
  | 'aider'
  | 'copilot'
  | 'manual'
  | 'api';

@Entity({ tableName: 'user_tasks' })
@Index({ properties: ['project', 'status'] })
@Index({ properties: ['session_id', 'created_at_epoch'] })
@Index({ properties: ['parent_task_id'] })
export class UserTask {
  @PrimaryKey()
  id!: number;

  /**
   * External task ID from CLI (e.g., Claude Code's taskId)
   */
  @Property({ nullable: true })
  @Index()
  external_id?: string;

  /**
   * Task title/subject
   */
  @Property()
  title!: string;

  /**
   * Detailed description
   */
  @Property({ nullable: true, type: 'text' })
  description?: string;

  /**
   * Present continuous form for UI display (e.g., "Running tests")
   */
  @Property({ nullable: true })
  active_form?: string;

  /**
   * Task status
   */
  @Property({ default: 'pending' })
  @Index()
  status!: UserTaskStatus;

  /**
   * Priority level
   */
  @Property({ nullable: true })
  priority?: 'low' | 'medium' | 'high';

  /**
   * Project this task belongs to
   */
  @Property()
  @Index()
  project!: string;

  /**
   * Session that created/owns this task
   */
  @Property({ nullable: true })
  @Index()
  session_id?: string;

  /**
   * Parent task ID for plan hierarchies
   */
  @Property({ nullable: true })
  parent_task_id?: number;

  /**
   * Source CLI that created this task
   */
  @Property({ default: 'claude-code' })
  source!: UserTaskSource;

  /**
   * Source-specific metadata (JSON)
   */
  @Property({ nullable: true, type: 'text' })
  source_metadata?: string;

  /**
   * Task owner (agent name for Claude Code)
   */
  @Property({ nullable: true })
  owner?: string;

  /**
   * Working directory where task was created
   */
  @Property({ nullable: true })
  working_directory?: string;

  /**
   * Git branch when task was created
   */
  @Property({ nullable: true })
  git_branch?: string;

  /**
   * Affected files (JSON array)
   */
  @Property({ nullable: true, type: 'text' })
  affected_files?: string;

  /**
   * Task IDs that block this task (JSON array)
   */
  @Property({ nullable: true, type: 'text' })
  blocked_by?: string;

  /**
   * Task IDs that this task blocks (JSON array)
   */
  @Property({ nullable: true, type: 'text' })
  blocks?: string;

  /**
   * Due date (epoch ms)
   */
  @Property({ nullable: true, type: 'bigint' })
  due_at_epoch?: number;

  /**
   * Created timestamp (epoch ms)
   */
  @Property({ type: 'bigint' })
  @Index()
  created_at_epoch!: number;

  /**
   * Last updated timestamp (epoch ms)
   */
  @Property({ type: 'bigint' })
  updated_at_epoch!: number;

  /**
   * Completed timestamp (epoch ms)
   */
  @Property({ nullable: true, type: 'bigint' })
  completed_at_epoch?: number;

  /**
   * Token cost for this task
   */
  @Property({ nullable: true })
  cost_tokens?: number;

  /**
   * Estimated cost in USD
   */
  @Property({ nullable: true, type: 'float' })
  cost_usd?: number;
}

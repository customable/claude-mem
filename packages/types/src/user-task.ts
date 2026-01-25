/**
 * User Task Types (Issue #260)
 *
 * Types for user-facing tasks from CLI tools.
 * The WebUI is read-only - all mutations come from CLI hooks.
 */

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

/**
 * User task record from database
 */
export interface UserTaskRecord {
  id: number;
  externalId?: string;
  title: string;
  description?: string;
  activeForm?: string;
  status: UserTaskStatus;
  priority?: 'low' | 'medium' | 'high';
  project: string;
  sessionId?: string;
  parentTaskId?: number;
  source: UserTaskSource;
  sourceMetadata?: Record<string, unknown>;
  owner?: string;
  workingDirectory?: string;
  gitBranch?: string;
  affectedFiles?: string[];
  blockedBy?: string[];
  blocks?: string[];
  dueAtEpoch?: number;
  createdAtEpoch: number;
  updatedAtEpoch: number;
  completedAtEpoch?: number;
  costTokens?: number;
  costUsd?: number;
}

/**
 * Input for creating a user task
 */
export interface CreateUserTaskInput {
  externalId?: string;
  title: string;
  description?: string;
  activeForm?: string;
  status?: UserTaskStatus;
  priority?: 'low' | 'medium' | 'high';
  project: string;
  sessionId?: string;
  parentTaskId?: number;
  source?: UserTaskSource;
  sourceMetadata?: Record<string, unknown>;
  owner?: string;
  workingDirectory?: string;
  gitBranch?: string;
  affectedFiles?: string[];
  blockedBy?: string[];
  blocks?: string[];
}

/**
 * Input for updating a user task
 */
export interface UpdateUserTaskInput {
  title?: string;
  description?: string;
  activeForm?: string;
  status?: UserTaskStatus;
  priority?: 'low' | 'medium' | 'high';
  owner?: string;
  blockedBy?: string[];
  blocks?: string[];
  costTokens?: number;
  costUsd?: number;
}

/**
 * User task repository interface
 */
export interface IUserTaskRepository {
  create(input: CreateUserTaskInput): Promise<UserTaskRecord>;
  findById(id: number): Promise<UserTaskRecord | null>;
  findByExternalId(externalId: string): Promise<UserTaskRecord | null>;
  update(id: number, input: UpdateUserTaskInput): Promise<UserTaskRecord | null>;
  updateByExternalId(externalId: string, input: UpdateUserTaskInput): Promise<UserTaskRecord | null>;
  list(options?: {
    project?: string;
    sessionId?: string;
    status?: UserTaskStatus | UserTaskStatus[];
    source?: UserTaskSource;
    parentTaskId?: number | null;
    limit?: number;
    offset?: number;
  }): Promise<UserTaskRecord[]>;
  getChildren(parentTaskId: number): Promise<UserTaskRecord[]>;
  countByStatus(project?: string): Promise<Record<UserTaskStatus, number>>;
  getStats(project?: string): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    blocked: number;
  }>;
  delete(id: number): Promise<boolean>;
}

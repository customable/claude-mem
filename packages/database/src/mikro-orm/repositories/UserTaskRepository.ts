/**
 * MikroORM UserTask Repository (Issue #260)
 *
 * Repository for user-facing tasks from CLI tools.
 * All mutations come from CLI hooks - UI is read-only.
 */

import type { SqlEntityManager } from '@mikro-orm/knex';
import { UserTask, type UserTaskStatus, type UserTaskSource } from '../../entities/UserTask.js';
import type { IUserTaskRepository, UserTaskRecord, CreateUserTaskInput, UpdateUserTaskInput } from '@claude-mem/types';

/**
 * MikroORM implementation of IUserTaskRepository
 */
export class MikroOrmUserTaskRepository implements IUserTaskRepository {
  constructor(private em: SqlEntityManager) {}

  /**
   * Create a new user task
   */
  async create(input: CreateUserTaskInput): Promise<UserTaskRecord> {
    const now = Date.now();
    const task = this.em.create(UserTask, {
      external_id: input.externalId,
      title: input.title,
      description: input.description,
      active_form: input.activeForm,
      status: input.status || 'pending',
      priority: input.priority,
      project: input.project,
      session_id: input.sessionId,
      parent_task_id: input.parentTaskId,
      source: input.source || 'claude-code',
      source_metadata: input.sourceMetadata ? JSON.stringify(input.sourceMetadata) : undefined,
      owner: input.owner,
      working_directory: input.workingDirectory,
      git_branch: input.gitBranch,
      affected_files: input.affectedFiles ? JSON.stringify(input.affectedFiles) : undefined,
      blocked_by: input.blockedBy ? JSON.stringify(input.blockedBy) : undefined,
      blocks: input.blocks ? JSON.stringify(input.blocks) : undefined,
      created_at_epoch: now,
      updated_at_epoch: now,
    });

    await this.em.persistAndFlush(task);
    return this.toRecord(task);
  }

  /**
   * Find task by ID
   */
  async findById(id: number): Promise<UserTaskRecord | null> {
    const task = await this.em.findOne(UserTask, { id });
    return task ? this.toRecord(task) : null;
  }

  /**
   * Find task by external ID
   */
  async findByExternalId(externalId: string): Promise<UserTaskRecord | null> {
    const task = await this.em.findOne(UserTask, { external_id: externalId });
    return task ? this.toRecord(task) : null;
  }

  /**
   * Update a task
   */
  async update(id: number, input: UpdateUserTaskInput): Promise<UserTaskRecord | null> {
    const task = await this.em.findOne(UserTask, { id });
    if (!task) return null;

    const now = Date.now();

    if (input.title !== undefined) task.title = input.title;
    if (input.description !== undefined) task.description = input.description;
    if (input.activeForm !== undefined) task.active_form = input.activeForm;
    if (input.status !== undefined) {
      task.status = input.status;
      if (input.status === 'completed') {
        task.completed_at_epoch = now;
      }
    }
    if (input.priority !== undefined) task.priority = input.priority;
    if (input.owner !== undefined) task.owner = input.owner;
    if (input.blockedBy !== undefined) task.blocked_by = JSON.stringify(input.blockedBy);
    if (input.blocks !== undefined) task.blocks = JSON.stringify(input.blocks);
    if (input.costTokens !== undefined) task.cost_tokens = input.costTokens;
    if (input.costUsd !== undefined) task.cost_usd = input.costUsd;

    task.updated_at_epoch = now;

    await this.em.flush();
    return this.toRecord(task);
  }

  /**
   * Update task by external ID
   */
  async updateByExternalId(externalId: string, input: UpdateUserTaskInput): Promise<UserTaskRecord | null> {
    const task = await this.em.findOne(UserTask, { external_id: externalId });
    if (!task) return null;
    return this.update(task.id, input);
  }

  /**
   * List tasks with filtering
   */
  async list(options: {
    project?: string;
    sessionId?: string;
    status?: UserTaskStatus | UserTaskStatus[];
    source?: UserTaskSource;
    parentTaskId?: number | null;
    limit?: number;
    offset?: number;
  } = {}): Promise<UserTaskRecord[]> {
    const where: Record<string, unknown> = {};

    if (options.project) where.project = options.project;
    if (options.sessionId) where.session_id = options.sessionId;
    if (options.source) where.source = options.source;

    if (options.status) {
      where.status = Array.isArray(options.status)
        ? { $in: options.status }
        : options.status;
    }

    // null means root tasks (no parent)
    if (options.parentTaskId === null) {
      where.parent_task_id = null;
    } else if (options.parentTaskId !== undefined) {
      where.parent_task_id = options.parentTaskId;
    }

    const tasks = await this.em.find(UserTask, where, {
      limit: options.limit || 100,
      offset: options.offset || 0,
      orderBy: { created_at_epoch: 'DESC' },
    });

    return tasks.map(t => this.toRecord(t));
  }

  /**
   * Get child tasks of a parent
   */
  async getChildren(parentTaskId: number): Promise<UserTaskRecord[]> {
    return this.list({ parentTaskId });
  }

  /**
   * Count tasks by status
   */
  async countByStatus(project?: string): Promise<Record<UserTaskStatus, number>> {
    const knex = this.em.getKnex();
    const query = knex('user_tasks')
      .select('status')
      .count('* as count')
      .groupBy('status');

    if (project) {
      query.where('project', project);
    }

    const results = await query;

    const counts: Record<UserTaskStatus, number> = {
      pending: 0,
      in_progress: 0,
      blocked: 0,
      more_info_needed: 0,
      ready_for_review: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const row of results) {
      const status = row.status as UserTaskStatus;
      counts[status] = Number(row.count);
    }

    return counts;
  }

  /**
   * Get task statistics
   */
  async getStats(project?: string): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    blocked: number;
  }> {
    const counts = await this.countByStatus(project);
    return {
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      pending: counts.pending,
      inProgress: counts.in_progress,
      completed: counts.completed,
      blocked: counts.blocked + counts.more_info_needed,
    };
  }

  /**
   * Delete a task
   */
  async delete(id: number): Promise<boolean> {
    const task = await this.em.findOne(UserTask, { id });
    if (!task) return false;
    await this.em.removeAndFlush(task);
    return true;
  }

  /**
   * Convert entity to record
   */
  private toRecord(task: UserTask): UserTaskRecord {
    return {
      id: task.id,
      externalId: task.external_id,
      title: task.title,
      description: task.description,
      activeForm: task.active_form,
      status: task.status,
      priority: task.priority,
      project: task.project,
      sessionId: task.session_id,
      parentTaskId: task.parent_task_id,
      source: task.source,
      sourceMetadata: task.source_metadata ? JSON.parse(task.source_metadata) : undefined,
      owner: task.owner,
      workingDirectory: task.working_directory,
      gitBranch: task.git_branch,
      affectedFiles: task.affected_files ? JSON.parse(task.affected_files) : undefined,
      blockedBy: task.blocked_by ? JSON.parse(task.blocked_by) : undefined,
      blocks: task.blocks ? JSON.parse(task.blocks) : undefined,
      dueAtEpoch: task.due_at_epoch ? Number(task.due_at_epoch) : undefined,
      createdAtEpoch: Number(task.created_at_epoch),
      updatedAtEpoch: Number(task.updated_at_epoch),
      completedAtEpoch: task.completed_at_epoch ? Number(task.completed_at_epoch) : undefined,
      costTokens: task.cost_tokens,
      costUsd: task.cost_usd,
    };
  }
}

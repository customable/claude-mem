/**
 * Data Routes
 *
 * API endpoints for data retrieval (UI, MCP, etc.)
 */

import type { Request, Response } from 'express';
import { BaseRouter } from './base-router.js';
import type { SessionService } from '../services/session-service.js';
import type { TaskService } from '../services/task-service.js';
import type { IObservationRepository, ObservationType, TaskStatus } from '@claude-mem/types';

/**
 * Helper to get string from query/params (handles string | string[])
 */
function getString(val: unknown): string | undefined {
  if (Array.isArray(val)) return val[0];
  if (typeof val === 'string') return val;
  return undefined;
}

/**
 * Helper to get required string from params (handles string | string[])
 */
function getRequiredString(val: unknown): string {
  if (Array.isArray(val)) return val[0] ?? '';
  if (typeof val === 'string') return val;
  return '';
}

export interface DataRouterDeps {
  sessionService: SessionService;
  taskService: TaskService;
  observations: IObservationRepository;
}

export class DataRouter extends BaseRouter {
  constructor(private readonly deps: DataRouterDeps) {
    super();
  }

  protected setupRoutes(): void {
    // Sessions
    this.router.get('/sessions', this.asyncHandler(this.listSessions.bind(this)));
    this.router.get('/sessions/:id', this.asyncHandler(this.getSession.bind(this)));
    this.router.delete('/sessions/:id', this.asyncHandler(this.deleteSession.bind(this)));

    // Observations
    this.router.get('/observations', this.asyncHandler(this.listObservations.bind(this)));
    this.router.get('/observations/:id', this.asyncHandler(this.getObservation.bind(this)));
    this.router.get('/sessions/:sessionId/observations', this.asyncHandler(this.getSessionObservations.bind(this)));

    // Tasks
    this.router.get('/tasks', this.asyncHandler(this.listTasks.bind(this)));
    this.router.get('/tasks/:id', this.asyncHandler(this.getTask.bind(this)));
    this.router.get('/tasks/status/counts', this.asyncHandler(this.getTaskCounts.bind(this)));

    // Stats
    this.router.get('/stats', this.asyncHandler(this.getStats.bind(this)));
  }

  /**
   * GET /api/data/sessions
   */
  private async listSessions(req: Request, res: Response): Promise<void> {
    const { project, status, limit, offset } = req.query;

    const sessions = await this.deps.sessionService.listSessions({
      project: getString(project),
      status: getString(status),
      limit: this.parseOptionalIntParam(getString(limit)),
      offset: this.parseOptionalIntParam(getString(offset)),
    });

    const total = await this.deps.sessionService.getSessionCount({
      project: getString(project),
      status: getString(status),
    });

    const parsedLimit = this.parseOptionalIntParam(getString(limit)) ?? 50;
    const parsedOffset = this.parseOptionalIntParam(getString(offset)) ?? 0;

    this.success(res, {
      data: sessions,
      total,
      limit: parsedLimit,
      offset: parsedOffset,
    });
  }

  /**
   * GET /api/data/sessions/:id
   */
  private async getSession(req: Request, res: Response): Promise<void> {
    const id = getRequiredString(req.params.id);

    const session = await this.deps.sessionService.getSession(id);
    if (!session) {
      this.notFound(`Session not found: ${id}`);
    }

    this.success(res, session);
  }

  /**
   * DELETE /api/data/sessions/:id
   */
  private async deleteSession(req: Request, res: Response): Promise<void> {
    const id = getRequiredString(req.params.id);

    const deleted = await this.deps.sessionService.deleteSession(id);
    if (!deleted) {
      this.notFound(`Session not found: ${id}`);
    }

    this.noContent(res);
  }

  /**
   * GET /api/data/observations
   */
  private async listObservations(req: Request, res: Response): Promise<void> {
    const { project, type, sessionId, limit, offset } = req.query;

    const observations = await this.deps.observations.list(
      {
        project: getString(project),
        type: getString(type) as ObservationType | undefined,
        sessionId: getString(sessionId),
      },
      {
        limit: this.parseOptionalIntParam(getString(limit)) ?? 50,
        offset: this.parseOptionalIntParam(getString(offset)),
      }
    );

    const total = await this.deps.observations.count({
      project: getString(project),
      type: getString(type) as ObservationType | undefined,
      sessionId: getString(sessionId),
    });

    const parsedLimit = this.parseOptionalIntParam(getString(limit)) ?? 50;
    const parsedOffset = this.parseOptionalIntParam(getString(offset)) ?? 0;

    this.success(res, {
      data: observations,
      total,
      limit: parsedLimit,
      offset: parsedOffset,
    });
  }

  /**
   * GET /api/data/observations/:id
   */
  private async getObservation(req: Request, res: Response): Promise<void> {
    const id = this.parseIntParam(getString(req.params.id), 'id');

    const observation = await this.deps.observations.findById(id);
    if (!observation) {
      this.notFound(`Observation not found: ${id}`);
    }

    this.success(res, observation);
  }

  /**
   * GET /api/data/sessions/:sessionId/observations
   */
  private async getSessionObservations(req: Request, res: Response): Promise<void> {
    const sessionId = getRequiredString(req.params.sessionId);
    const { limit, offset } = req.query;

    const observations = await this.deps.sessionService.getSessionObservations(sessionId, {
      limit: this.parseOptionalIntParam(getString(limit)),
      offset: this.parseOptionalIntParam(getString(offset)),
    });

    this.success(res, { data: observations });
  }

  /**
   * GET /api/data/tasks
   */
  private async listTasks(req: Request, res: Response): Promise<void> {
    const { status, type, limit, offset } = req.query;

    const tasks = await this.deps.taskService.listTasks({
      status: getString(status) as TaskStatus | undefined,
      type: getString(type),
      limit: this.parseOptionalIntParam(getString(limit)),
      offset: this.parseOptionalIntParam(getString(offset)),
    });

    this.success(res, { data: tasks });
  }

  /**
   * GET /api/data/tasks/:id
   */
  private async getTask(req: Request, res: Response): Promise<void> {
    const id = getRequiredString(req.params.id);

    const task = await this.deps.taskService.getTask(id);
    if (!task) {
      this.notFound(`Task not found: ${id}`);
    }

    this.success(res, task);
  }

  /**
   * GET /api/data/tasks/status/counts
   */
  private async getTaskCounts(_req: Request, res: Response): Promise<void> {
    const counts = await this.deps.taskService.getQueueStatus();
    this.success(res, counts);
  }

  /**
   * GET /api/data/stats
   */
  private async getStats(req: Request, res: Response): Promise<void> {
    const { project } = req.query;

    const sessionCount = await this.deps.sessionService.getSessionCount({
      project: getString(project),
    });

    const observationCount = await this.deps.observations.count({
      project: getString(project),
    });

    const taskCounts = await this.deps.taskService.getQueueStatus();

    this.success(res, {
      sessions: sessionCount,
      observations: observationCount,
      tasks: taskCounts,
    });
  }
}

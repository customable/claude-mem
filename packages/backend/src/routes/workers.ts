/**
 * Workers Routes
 *
 * API endpoints for worker management and status.
 */

import type { Request, Response } from 'express';
import { loadSettings } from '@claude-mem/shared';
import { BaseRouter } from './base-router.js';
import type { WorkerHub } from '../websocket/worker-hub.js';
import type { WorkerProcessManager } from '../services/worker-process-manager.js';

/**
 * Helper to get required string from params (handles string | string[])
 */
function getRequiredString(val: unknown): string {
  if (Array.isArray(val)) return val[0] ?? '';
  if (typeof val === 'string') return val;
  return '';
}

export interface WorkersRouterDeps {
  workerHub: WorkerHub;
  workerProcessManager?: WorkerProcessManager;
}

export class WorkersRouter extends BaseRouter {
  constructor(private readonly deps: WorkersRouterDeps) {
    super();
  }

  protected setupRoutes(): void {
    // List connected workers
    this.router.get('/', this.asyncHandler(this.listWorkers.bind(this)));

    // Get worker stats
    this.router.get('/stats', this.asyncHandler(this.getStats.bind(this)));

    // Spawn status - check if spawning is available
    this.router.get('/spawn-status', this.asyncHandler(this.getSpawnStatus.bind(this)));

    // List spawned workers
    this.router.get('/spawned', this.asyncHandler(this.listSpawnedWorkers.bind(this)));

    // Spawn a new worker
    this.router.post('/spawn', this.asyncHandler(this.spawnWorker.bind(this)));

    // Terminate a spawned worker
    this.router.delete('/spawned/:id', this.asyncHandler(this.terminateWorker.bind(this)));

    // Get specific worker (must be last due to :id param)
    this.router.get('/:id', this.asyncHandler(this.getWorker.bind(this)));
  }

  /**
   * GET /api/workers
   */
  private async listWorkers(_req: Request, res: Response): Promise<void> {
    const workers = this.deps.workerHub.getWorkers().map(w => ({
      id: w.id,
      capabilities: w.capabilities,
      connectedAt: w.connectedAt,
      lastHeartbeat: w.lastHeartbeat,
      currentTaskId: w.currentTaskId,
      metadata: w.metadata,
    }));

    this.success(res, {
      data: workers,
      total: workers.length,
    });
  }

  /**
   * GET /api/workers/stats
   */
  private async getStats(_req: Request, res: Response): Promise<void> {
    const stats = this.deps.workerHub.getStats();
    this.success(res, stats);
  }

  /**
   * GET /api/workers/:id
   */
  private async getWorker(req: Request, res: Response): Promise<void> {
    const id = getRequiredString(req.params.id);

    const worker = this.deps.workerHub.getWorker(id);
    if (!worker) {
      this.notFound(`Worker not found: ${id}`);
    }

    this.success(res, {
      id: worker.id,
      capabilities: worker.capabilities,
      connectedAt: worker.connectedAt,
      lastHeartbeat: worker.lastHeartbeat,
      currentTaskId: worker.currentTaskId,
      metadata: worker.metadata,
    });
  }

  /**
   * GET /api/workers/spawn-status
   */
  private async getSpawnStatus(_req: Request, res: Response): Promise<void> {
    const settings = loadSettings();

    if (!this.deps.workerProcessManager) {
      this.success(res, {
        available: false,
        reason: 'Worker process manager not initialized',
        spawnedCount: 0,
        maxWorkers: settings.MAX_WORKERS,
        canSpawnMore: false,
      });
      return;
    }

    const spawnedCount = this.deps.workerProcessManager.getSpawnedCount();

    this.success(res, {
      available: this.deps.workerProcessManager.canSpawnWorkers(),
      reason: this.deps.workerProcessManager.getSpawnUnavailableReason(),
      spawnedCount,
      maxWorkers: settings.MAX_WORKERS,
      canSpawnMore: spawnedCount < settings.MAX_WORKERS,
    });
  }

  /**
   * GET /api/workers/spawned
   */
  private async listSpawnedWorkers(_req: Request, res: Response): Promise<void> {
    const settings = loadSettings();

    if (!this.deps.workerProcessManager) {
      this.success(res, {
        data: [],
        canSpawn: false,
        maxWorkers: settings.MAX_WORKERS,
      });
      return;
    }

    this.success(res, {
      data: this.deps.workerProcessManager.getSpawnedWorkers(),
      canSpawn: this.deps.workerProcessManager.canSpawnWorkers(),
      maxWorkers: settings.MAX_WORKERS,
    });
  }

  /**
   * POST /api/workers/spawn
   */
  private async spawnWorker(_req: Request, res: Response): Promise<void> {
    if (!this.deps.workerProcessManager) {
      this.badRequest('Worker process manager not available');
    }

    try {
      const result = await this.deps.workerProcessManager!.spawn();
      this.created(res, {
        message: 'Worker spawned',
        ...result,
      });
    } catch (error) {
      const err = error as Error;
      this.badRequest(err.message);
    }
  }

  /**
   * DELETE /api/workers/spawned/:id
   */
  private async terminateWorker(req: Request, res: Response): Promise<void> {
    const id = getRequiredString(req.params.id);

    if (!this.deps.workerProcessManager) {
      this.badRequest('Worker process manager not available');
    }

    try {
      await this.deps.workerProcessManager!.terminate(id);
      this.success(res, { message: 'Worker terminated' });
    } catch (error) {
      const err = error as Error;
      this.notFound(err.message);
    }
  }
}

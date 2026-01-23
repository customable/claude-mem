/**
 * Workers Routes
 *
 * API endpoints for worker management and status.
 */

import type { Request, Response } from 'express';
import { BaseRouter } from './base-router.js';
import type { WorkerHub } from '../websocket/worker-hub.js';

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

    // Get specific worker
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
}

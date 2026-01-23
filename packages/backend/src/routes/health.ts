/**
 * Health Routes
 *
 * Health check and status endpoints.
 */

import type { Request, Response } from 'express';
import { VERSION } from '@claude-mem/shared';
import { BaseRouter } from './base-router.js';
import type { WorkerHub } from '../websocket/worker-hub.js';
import type { ITaskQueueRepository } from '@claude-mem/types';

export interface HealthRouterDeps {
  workerHub: WorkerHub;
  taskQueue: ITaskQueueRepository;
  getInitializationStatus: () => { coreReady: boolean; fullyInitialized: boolean };
  onRestart?: () => Promise<void>;
}

export class HealthRouter extends BaseRouter {
  constructor(private readonly deps: HealthRouterDeps) {
    super();
  }

  protected setupRoutes(): void {
    // Basic health check - always responds
    this.router.get('/health', this.asyncHandler(this.health.bind(this)));

    // Core ready check - for hooks
    this.router.get('/core-ready', this.asyncHandler(this.coreReady.bind(this)));

    // Full readiness check - for production
    this.router.get('/ready', this.asyncHandler(this.readiness.bind(this)));
    this.router.get('/readiness', this.asyncHandler(this.readiness.bind(this))); // Alias

    // Version info
    this.router.get('/version', this.asyncHandler(this.version.bind(this)));

    // Detailed status
    this.router.get('/status', this.asyncHandler(this.status.bind(this)));

    // Admin: Restart backend
    this.router.post('/admin/restart', this.asyncHandler(this.restart.bind(this)));
  }

  /**
   * GET /api/health
   * Basic health check - always responds if server is up
   */
  private async health(_req: Request, res: Response): Promise<void> {
    const status = this.deps.getInitializationStatus();
    const workerStats = this.deps.workerHub.getStats();

    this.success(res, {
      status: 'ok',
      version: VERSION,
      timestamp: Date.now(),
      initialized: status.fullyInitialized,
      coreReady: status.coreReady,
      workers: {
        connected: workerStats.totalConnected,
      },
    });
  }

  /**
   * GET /api/core-ready
   * Returns 200 when core systems ready (hooks can proceed)
   */
  private async coreReady(_req: Request, res: Response): Promise<void> {
    const status = this.deps.getInitializationStatus();

    if (status.coreReady) {
      this.success(res, { ready: true });
    } else {
      res.status(503).json({ ready: false, message: 'Core systems initializing' });
    }
  }

  /**
   * GET /api/ready
   * Kubernetes-style readiness check
   */
  private async readiness(_req: Request, res: Response): Promise<void> {
    const status = this.deps.getInitializationStatus();

    if (status.fullyInitialized) {
      this.success(res, { ready: true });
    } else {
      res.status(503).json({ ready: false, message: 'Still initializing' });
    }
  }

  /**
   * GET /api/version
   */
  private async version(_req: Request, res: Response): Promise<void> {
    this.success(res, {
      version: VERSION,
      build: process.env.BUILD_ID || 'dev',
    });
  }

  /**
   * GET /api/status
   * Detailed status information
   */
  private async status(_req: Request, res: Response): Promise<void> {
    const initStatus = this.deps.getInitializationStatus();
    const workerStats = this.deps.workerHub.getStats();
    const taskCounts = await this.deps.taskQueue.countByStatus();

    this.success(res, {
      version: VERSION,
      uptime: process.uptime(),
      timestamp: Date.now(),
      initialization: initStatus,
      workers: {
        connected: workerStats.totalConnected,
        byCapability: workerStats.byCapability,
      },
      tasks: taskCounts,
      memory: process.memoryUsage(),
    });
  }

  /**
   * POST /api/admin/restart
   * Restart the backend service
   */
  private async restart(_req: Request, res: Response): Promise<void> {
    if (!this.deps.onRestart) {
      this.badRequest('Restart not supported');
    }

    this.success(res, { message: 'Restart initiated' });

    // Delay restart to allow response to be sent
    setTimeout(async () => {
      await this.deps.onRestart!();
    }, 100);
  }
}

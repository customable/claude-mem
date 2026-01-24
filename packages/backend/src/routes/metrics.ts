/**
 * Metrics Router (Issue #209)
 *
 * Exposes Prometheus metrics endpoint.
 */

import { Router, type IRouter } from 'express';
import { registry, taskQueueDepth, workerCount, workerBusy, sessionCount, observationCount } from '../metrics/index.js';
import type { IUnitOfWork } from '@claude-mem/types';
import type { WorkerHub } from '../websocket/worker-hub.js';

export interface MetricsRouterOptions {
  unitOfWork: IUnitOfWork;
  workerHub: WorkerHub;
}

export class MetricsRouter {
  public readonly router: IRouter = Router();

  constructor(private readonly options: MetricsRouterOptions) {
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.get('/', async (_req, res) => {
      try {
        // Update gauges before returning metrics
        await this.updateGauges();

        res.set('Content-Type', registry.contentType);
        res.send(await registry.metrics());
      } catch (error) {
        res.status(500).send('Error collecting metrics');
      }
    });
  }

  private async updateGauges(): Promise<void> {
    const { unitOfWork, workerHub } = this.options;

    try {
      // Task queue depths
      const taskRepo = unitOfWork.taskQueue;
      const queueStats = await taskRepo.countByStatus();
      taskQueueDepth.set({ status: 'pending' }, queueStats.pending || 0);
      taskQueueDepth.set({ status: 'processing' }, queueStats.processing || 0);
      taskQueueDepth.set({ status: 'completed' }, queueStats.completed || 0);
      taskQueueDepth.set({ status: 'failed' }, queueStats.failed || 0);

      // Worker counts
      const workers = workerHub.getWorkers();
      // Cast metadata to check for spawnedId (extended metadata not in base type)
      const permanentWorkers = workers.filter((w) => !w.metadata?.spawnedId);
      const spawnedWorkers = workers.filter((w) => !!w.metadata?.spawnedId);
      workerCount.set({ type: 'permanent' }, permanentWorkers.length);
      workerCount.set({ type: 'spawned' }, spawnedWorkers.length);
      workerBusy.set(workers.filter((w) => !!w.currentTaskId).length);

      // Session counts
      const sessionRepo = unitOfWork.sessions;
      const [activeCount, totalCount] = await Promise.all([
        sessionRepo.count({ status: 'active' }),
        sessionRepo.count(),
      ]);
      sessionCount.set({ status: 'active' }, activeCount);
      sessionCount.set({ status: 'total' }, totalCount);

      // Observation count
      const observationRepo = unitOfWork.observations;
      const obsCount = await observationRepo.count({});
      observationCount.set(obsCount);
    } catch (error) {
      // Silently ignore errors during gauge updates
    }
  }
}

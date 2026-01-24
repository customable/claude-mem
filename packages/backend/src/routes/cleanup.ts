/**
 * Cleanup Router
 *
 * API endpoints for system cleanup and maintenance.
 * Addresses issue #101 (process/memory leaks).
 */

import { Router, type Request, type Response } from 'express';
import { BaseRouter } from './base-router.js';
import type { CleanupService } from '../services/cleanup-service.js';
import { createLogger } from '@claude-mem/shared';

const logger = createLogger('cleanup-router');

export interface CleanupRouterDeps {
  cleanupService: CleanupService;
}

export class CleanupRouter extends BaseRouter {
  constructor(private readonly deps: CleanupRouterDeps) {
    super();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    /**
     * GET /api/cleanup/stats
     * Get cleanup statistics
     */
    this.router.get('/stats', async (_req: Request, res: Response) => {
      try {
        const stats = await this.deps.cleanupService.getStats();
        res.json(stats);
      } catch (error) {
        logger.error('Failed to get cleanup stats:', { message: (error as Error).message });
        res.status(500).json({ error: 'Failed to get cleanup stats' });
      }
    });

    /**
     * POST /api/cleanup/run
     * Manually trigger cleanup
     */
    this.router.post('/run', async (_req: Request, res: Response) => {
      try {
        logger.info('Manual cleanup triggered');
        const result = await this.deps.cleanupService.runCleanup();
        res.json({
          success: true,
          result,
        });
      } catch (error) {
        logger.error('Cleanup failed:', { message: (error as Error).message });
        res.status(500).json({ error: 'Cleanup failed' });
      }
    });
  }
}

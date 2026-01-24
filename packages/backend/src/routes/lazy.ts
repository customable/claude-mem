/**
 * Lazy Mode Routes
 *
 * API endpoints for lazy processing mode.
 */

import type { Request, Response } from 'express';
import { BaseRouter } from './base-router.js';
import type { LazyProcessingService } from '../services/lazy-processing-service.js';

/**
 * Helper to get number from query param
 */
function getNumber(val: unknown, defaultVal: number): number {
  if (typeof val === 'string') {
    const num = parseInt(val, 10);
    return isNaN(num) ? defaultVal : num;
  }
  return defaultVal;
}

/**
 * Helper to get optional string from query param
 */
function getString(val: unknown): string | undefined {
  if (Array.isArray(val)) return val[0];
  if (typeof val === 'string') return val;
  return undefined;
}

export interface LazyRouterDeps {
  lazyService: LazyProcessingService;
}

export class LazyRouter extends BaseRouter {
  constructor(private readonly deps: LazyRouterDeps) {
    super();
  }

  protected setupRoutes(): void {
    // Status
    this.router.get('/status', this.asyncHandler(this.getStatus.bind(this)));

    // Processing
    this.router.post('/process', this.asyncHandler(this.processBatch.bind(this)));
    this.router.post('/process/search', this.asyncHandler(this.processForSearch.bind(this)));

    // Cleanup
    this.router.post('/cleanup', this.asyncHandler(this.cleanup.bind(this)));

    // Messages (for debugging)
    this.router.get('/messages', this.asyncHandler(this.listMessages.bind(this)));
  }

  /**
   * GET /lazy/status
   * Get lazy mode processing status
   */
  private async getStatus(_req: Request, res: Response): Promise<void> {
    const status = await this.deps.lazyService.getStatus();
    res.json(status);
  }

  /**
   * POST /lazy/process
   * Trigger batch processing of raw messages
   */
  private async processBatch(req: Request, res: Response): Promise<void> {
    const { sessionId, limit } = req.body as {
      sessionId?: string;
      limit?: number;
    };

    const result = await this.deps.lazyService.processBatch({
      sessionId,
      limit: limit ?? 50,
    });

    res.json(result);
  }

  /**
   * POST /lazy/process/search
   * Process messages matching a search query
   */
  private async processForSearch(req: Request, res: Response): Promise<void> {
    const { query, project } = req.body as {
      query: string;
      project?: string;
    };

    if (!query) {
      res.status(400).json({ error: 'query is required' });
      return;
    }

    const messages = await this.deps.lazyService.processForSearch(query, project);
    res.json({
      processed: messages.length,
      messages,
    });
  }

  /**
   * POST /lazy/cleanup
   * Clean up old processed messages
   */
  private async cleanup(req: Request, res: Response): Promise<void> {
    const { olderThanDays } = req.body as { olderThanDays?: number };
    const deleted = await this.deps.lazyService.cleanup(olderThanDays ?? 30);
    res.json({ deleted });
  }

  /**
   * GET /lazy/messages
   * List raw messages (for debugging)
   */
  private async listMessages(req: Request, res: Response): Promise<void> {
    const limit = getNumber(req.query.limit, 50);
    const sessionId = getString(req.query.sessionId);
    const project = getString(req.query.project);
    const processed = req.query.processed === 'true' ? true :
                      req.query.processed === 'false' ? false : undefined;

    // Access rawMessages directly from the service's uow
    // For now, we can return the status instead
    const status = await this.deps.lazyService.getStatus();

    res.json({
      mode: status.mode,
      unprocessedCount: status.unprocessedCount,
      // Note: Full message listing would require exposing uow through the service
      // For now, return status info only
      message: 'Use /lazy/status for queue info. Full message listing is available via database queries.',
    });
  }
}

/**
 * Search Routes
 *
 * API endpoints for semantic and full-text search.
 */

import type { Request, Response } from 'express';
import { BaseRouter } from './base-router.js';
import type { IObservationRepository } from '@claude-mem/types';

/**
 * Helper to get string from query/params
 */
function getString(val: unknown): string | undefined {
  if (Array.isArray(val)) return val[0];
  if (typeof val === 'string') return val;
  return undefined;
}

export interface SearchRouterDeps {
  observations: IObservationRepository;
  // qdrantService will be added when worker integration is complete
}

export class SearchRouter extends BaseRouter {
  constructor(private readonly deps: SearchRouterDeps) {
    super();
  }

  protected setupRoutes(): void {
    // Full-text search
    this.router.get('/text', this.asyncHandler(this.textSearch.bind(this)));

    // Semantic search (vector-based)
    this.router.get('/semantic', this.asyncHandler(this.semanticSearch.bind(this)));

    // Combined search
    this.router.get('/', this.asyncHandler(this.combinedSearch.bind(this)));
  }

  /**
   * GET /api/search/text
   * Full-text search in observation titles and content
   */
  private async textSearch(req: Request, res: Response): Promise<void> {
    const query = getString(req.query.query) || getString(req.query.q);
    const project = getString(req.query.project);
    const type = getString(req.query.type);
    const limit = this.parseOptionalIntParam(getString(req.query.limit)) ?? 30;

    if (!query) {
      this.badRequest('query parameter is required');
    }

    // Use repository's search method
    const results = await this.deps.observations.search(
      query!,
      { project, type: type as any },
      { limit }
    );

    this.success(res, {
      items: results,
      query,
      total: results.length,
    });
  }

  /**
   * GET /api/search/semantic
   * Vector-based semantic search using Qdrant
   */
  private async semanticSearch(req: Request, res: Response): Promise<void> {
    const query = getString(req.query.query) || getString(req.query.q);
    const project = getString(req.query.project);
    const type = getString(req.query.type);
    const limit = this.parseOptionalIntParam(getString(req.query.limit)) ?? 30;

    if (!query) {
      this.badRequest('query parameter is required');
    }

    // TODO: Integrate with Qdrant service via worker
    // For now, fallback to text search
    const results = await this.deps.observations.search(
      query!,
      { project, type: type as any },
      { limit }
    );

    this.success(res, {
      items: results,
      query,
      total: results.length,
      mode: 'text-fallback', // Will be 'semantic' when Qdrant is integrated
    });
  }

  /**
   * GET /api/search
   * Combined search (semantic with text fallback)
   */
  private async combinedSearch(req: Request, res: Response): Promise<void> {
    const query = getString(req.query.query) || getString(req.query.q);
    const project = getString(req.query.project);
    const type = getString(req.query.type);
    const limit = this.parseOptionalIntParam(getString(req.query.limit)) ?? 30;

    if (!query) {
      this.badRequest('query parameter is required');
    }

    // For now, use text search as semantic isn't fully integrated yet
    const results = await this.deps.observations.search(
      query!,
      { project, type: type as any },
      { limit }
    );

    this.success(res, {
      items: results,
      query,
      total: results.length,
    });
  }
}

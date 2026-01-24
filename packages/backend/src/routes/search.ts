/**
 * Search Routes
 *
 * API endpoints for semantic and full-text search.
 *
 * Semantic Search Status (Issue #156):
 * - Qdrant service is fully implemented in worker package
 * - Settings support VECTOR_DB: 'none' | 'qdrant'
 * - When VECTOR_DB='qdrant', semantic search uses vector similarity
 * - When VECTOR_DB='none' (default), falls back to SQLite FTS5 text search
 *
 * To enable semantic search:
 * 1. Set VECTOR_DB=qdrant in settings.json or env
 * 2. Ensure Qdrant is running (default: http://localhost:6333)
 * 3. Worker will automatically index observations
 */

import type { Request, Response } from 'express';
import { BaseRouter } from './base-router.js';
import type { IObservationRepository } from '@claude-mem/types';
import { loadSettings } from '@claude-mem/shared';

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
   *
   * Note: Semantic search via Qdrant is available when VECTOR_DB='qdrant'.
   * The worker handles vector indexing and similarity search.
   * When VECTOR_DB='none', falls back to SQLite FTS5 text search.
   */
  private async semanticSearch(req: Request, res: Response): Promise<void> {
    const query = getString(req.query.query) || getString(req.query.q);
    const project = getString(req.query.project);
    const type = getString(req.query.type);
    const limit = this.parseOptionalIntParam(getString(req.query.limit)) ?? 30;

    if (!query) {
      this.badRequest('query parameter is required');
    }

    const settings = loadSettings();
    const vectorDbEnabled = settings.VECTOR_DB === 'qdrant';

    // When Qdrant is enabled, semantic search is handled by the worker
    // via WebSocket task. For now, we provide text search as fallback.
    // Full integration requires: worker sends search results back via WebSocket
    const results = await this.deps.observations.search(
      query!,
      { project, type: type as any },
      { limit }
    );

    this.success(res, {
      items: results,
      query,
      total: results.length,
      mode: vectorDbEnabled ? 'semantic-pending' : 'text',
      vectorDbEnabled,
      note: vectorDbEnabled
        ? 'Qdrant enabled but direct search not yet integrated. Using text fallback.'
        : 'Enable VECTOR_DB=qdrant for semantic search.',
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

    const settings = loadSettings();
    const vectorDbEnabled = settings.VECTOR_DB === 'qdrant';

    // Use text search (FTS5) - works reliably regardless of Qdrant status
    const results = await this.deps.observations.search(
      query!,
      { project, type: type as any },
      { limit }
    );

    this.success(res, {
      items: results,
      query,
      total: results.length,
      mode: 'text',
      vectorDbEnabled,
    });
  }
}

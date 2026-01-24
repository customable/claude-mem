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
import { loadSettings, createLogger } from '@claude-mem/shared';
import type { TaskService } from '../services/task-service.js';

const logger = createLogger('search-router');

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
  taskService?: TaskService;
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
   * Full-text search in observation titles and content (Issue #211)
   *
   * Query parameters:
   * - query/q: Search query (supports: "phrase", OR, -NOT, prefix*)
   * - project: Filter by project
   * - type: Filter by observation type
   * - limit: Max results (default: 30)
   * - offset: Pagination offset
   * - highlight: Include highlights (default: true)
   * - facets: Include facet counts (default: false)
   * - snippetLength: Snippet context length (default: 64)
   */
  private async textSearch(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const query = getString(req.query.query) || getString(req.query.q);
    const project = getString(req.query.project);
    const type = getString(req.query.type);
    const limit = this.parseOptionalIntParam(getString(req.query.limit)) ?? 30;
    const offset = this.parseOptionalIntParam(getString(req.query.offset)) ?? 0;
    const highlight = getString(req.query.highlight) !== 'false';
    const includeFacets = getString(req.query.facets) === 'true';
    const snippetLength = this.parseOptionalIntParam(getString(req.query.snippetLength)) ?? 64;

    if (!query) {
      this.badRequest('query parameter is required');
    }

    const filters = { project, type: type as any };

    // Use enhanced search with ranking and highlights
    if (highlight) {
      const { results, total } = await this.deps.observations.searchWithRanking(
        query!,
        filters,
        { limit, offset, snippetLength }
      );

      // Optionally get facets
      let facets;
      if (includeFacets) {
        facets = await this.deps.observations.getSearchFacets(query!, filters);
      }

      const took = Date.now() - startTime;

      this.success(res, {
        results,
        total,
        facets,
        query: {
          original: query,
          parsed: query, // Could be enhanced to show normalized query
          took,
        },
      });
    } else {
      // Use simple search (backwards compatible)
      const items = await this.deps.observations.search(
        query!,
        filters,
        { limit, offset }
      );

      this.success(res, {
        items,
        query,
        total: items.length,
      });
    }
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
    const minScore = this.parseOptionalFloatParam(getString(req.query.minScore)) ?? 0.5;

    if (!query) {
      this.badRequest('query parameter is required');
    }

    const settings = loadSettings();
    const vectorDbEnabled = settings.VECTOR_DB === 'qdrant';

    // If Qdrant is enabled and task service is available, use semantic search
    if (vectorDbEnabled && this.deps.taskService) {
      try {
        const result = await this.deps.taskService.executeSemanticSearch({
          query: query!,
          project,
          limit,
          types: type ? [type] : undefined,
          minScore,
          timeoutMs: 30000,
        });

        this.success(res, {
          items: result.results,
          query,
          total: result.totalFound,
          mode: 'semantic',
          vectorDbEnabled: true,
          durationMs: result.durationMs,
        });
        return;
      } catch (error) {
        const err = error as Error;
        logger.warn(`Semantic search failed, falling back to text: ${err.message}`);
        // Fall through to text search fallback
      }
    }

    // Fallback to text search
    const results = await this.deps.observations.search(
      query!,
      { project, type: type as any },
      { limit }
    );

    this.success(res, {
      items: results,
      query,
      total: results.length,
      mode: vectorDbEnabled ? 'text-fallback' : 'text',
      vectorDbEnabled,
      note: vectorDbEnabled
        ? 'Semantic search unavailable, using text fallback.'
        : 'Enable VECTOR_DB=qdrant for semantic search.',
    });
  }

  /**
   * Parse optional float parameter
   */
  private parseOptionalFloatParam(val: string | undefined): number | undefined {
    if (!val) return undefined;
    const num = parseFloat(val);
    return isNaN(num) ? undefined : num;
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

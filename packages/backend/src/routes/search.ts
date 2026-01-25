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

/**
 * Parse ISO 8601 date string to epoch timestamp
 */
function parseDate(dateStr: string | undefined): number | undefined {
  if (!dateStr) return undefined;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? undefined : date.getTime();
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

    // Timeline view around an anchor (Issue #239)
    this.router.get('/timeline', this.asyncHandler(this.timeline.bind(this)));

    // Get observations by IDs (Issue #240)
    this.router.get('/observations', this.asyncHandler(this.getObservations.bind(this)));

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
   * - dateStart: Start date filter (ISO 8601) (Issue #241)
   * - dateEnd: End date filter (ISO 8601) (Issue #241)
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
    const dateStart = parseDate(getString(req.query.dateStart));
    const dateEnd = parseDate(getString(req.query.dateEnd));

    if (!query) {
      this.badRequest('query parameter is required');
    }

    // Build filters with date range support (Issue #241)
    const filters: any = { project, type: type as any };
    if (dateStart || dateEnd) {
      filters.dateRange = { start: dateStart, end: dateEnd };
    }

    try {
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
    } catch (error) {
      // Handle FTS5 query parsing errors as bad request (Issue #238)
      const err = error as Error;
      if (err.message?.includes('search query') || err.message?.includes('wildcard')) {
        this.badRequest(err.message);
      }
      throw error;
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
    try {
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
    } catch (error) {
      // Handle FTS5 query parsing errors as bad request (Issue #238)
      const err = error as Error;
      if (err.message?.includes('search query') || err.message?.includes('wildcard')) {
        this.badRequest(err.message);
      }
      throw error;
    }
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
   * Supports dateStart/dateEnd filters (Issue #241)
   */
  private async combinedSearch(req: Request, res: Response): Promise<void> {
    const query = getString(req.query.query) || getString(req.query.q);
    const project = getString(req.query.project);
    const type = getString(req.query.type);
    const limit = this.parseOptionalIntParam(getString(req.query.limit)) ?? 30;
    const dateStart = parseDate(getString(req.query.dateStart));
    const dateEnd = parseDate(getString(req.query.dateEnd));

    if (!query) {
      this.badRequest('query parameter is required');
    }

    const settings = loadSettings();
    const vectorDbEnabled = settings.VECTOR_DB === 'qdrant';

    // Build filters with date range (Issue #241)
    const filters: any = { project, type: type as any };
    if (dateStart || dateEnd) {
      filters.dateRange = { start: dateStart, end: dateEnd };
    }

    // Use text search (FTS5) - works reliably regardless of Qdrant status
    try {
      const results = await this.deps.observations.search(
        query!,
        filters,
        { limit }
      );

      this.success(res, {
        items: results,
        query,
        total: results.length,
        mode: 'text',
        vectorDbEnabled,
        filters: { dateStart, dateEnd, project, type },
      });
    } catch (error) {
      // Handle FTS5 query parsing errors as bad request (Issue #238)
      const err = error as Error;
      if (err.message?.includes('search query') || err.message?.includes('wildcard')) {
        this.badRequest(err.message);
      }
      throw error;
    }
  }

  /**
   * GET /api/search/timeline
   * Get observations around an anchor point (Issue #239)
   *
   * Query parameters:
   * - anchor: Observation ID to center on
   * - query: Search query to find anchor (alternative to anchor ID)
   * - depth_before: Number of observations before anchor (default: 5)
   * - depth_after: Number of observations after anchor (default: 5)
   * - project: Filter by project
   */
  private async timeline(req: Request, res: Response): Promise<void> {
    const anchorId = this.parseOptionalIntParam(getString(req.query.anchor));
    const query = getString(req.query.query);
    const depthBefore = this.parseOptionalIntParam(getString(req.query.depth_before)) ?? 5;
    const depthAfter = this.parseOptionalIntParam(getString(req.query.depth_after)) ?? 5;
    const project = getString(req.query.project);

    let anchorObservation;

    // Find anchor by ID or by search query
    if (anchorId) {
      anchorObservation = await this.deps.observations.findById(anchorId);
      if (!anchorObservation) {
        this.notFound(`Observation not found: ${anchorId}`);
      }
    } else if (query) {
      // Search and use first result as anchor
      const searchResults = await this.deps.observations.search(query, { project }, { limit: 1 });
      if (searchResults.length === 0) {
        this.notFound('No observations found for query');
      }
      anchorObservation = searchResults[0];
    } else {
      this.badRequest('Either anchor ID or query is required');
    }

    const anchorEpoch = anchorObservation!.created_at_epoch;

    // Get observations before anchor
    const beforeObs = await this.deps.observations.list(
      {
        project: project || anchorObservation!.project,
        dateRange: { end: anchorEpoch - 1 },
      },
      { limit: depthBefore, orderBy: 'created_at_epoch', order: 'desc' }
    );

    // Get observations after anchor
    const afterObs = await this.deps.observations.list(
      {
        project: project || anchorObservation!.project,
        dateRange: { start: anchorEpoch + 1 },
      },
      { limit: depthAfter, orderBy: 'created_at_epoch', order: 'asc' }
    );

    // Combine: before (reversed) + anchor + after
    const timeline = [
      ...beforeObs.reverse(),
      anchorObservation!,
      ...afterObs,
    ];

    this.success(res, {
      anchor: anchorObservation,
      before: beforeObs.reverse(),
      after: afterObs,
      timeline,
      total: timeline.length,
    });
  }

  /**
   * GET /api/search/observations
   * Fetch full details for specific observation IDs (Issue #240)
   *
   * Query parameters:
   * - ids: Comma-separated list of observation IDs
   * - project: Filter by project (optional)
   */
  private async getObservations(req: Request, res: Response): Promise<void> {
    const idsParam = getString(req.query.ids);
    const project = getString(req.query.project);

    if (!idsParam) {
      this.badRequest('ids parameter is required');
    }

    // Parse comma-separated IDs
    const ids = idsParam!.split(',')
      .map(id => parseInt(id.trim(), 10))
      .filter(id => !isNaN(id));

    if (ids.length === 0) {
      this.badRequest('No valid IDs provided');
    }

    // Fetch observations by ID
    const observations = await Promise.all(
      ids.map(id => this.deps.observations.findById(id))
    );

    // Filter nulls and optionally filter by project
    let results = observations.filter((obs): obs is NonNullable<typeof obs> => obs !== null);

    if (project) {
      results = results.filter(obs => obs.project === project);
    }

    this.success(res, {
      data: results,
      requested: ids.length,
      found: results.length,
    });
  }
}

/**
 * Suggestions Routes
 *
 * API endpoints for AI-powered memory suggestions.
 */

import type { Request, Response } from 'express';
import { BaseRouter } from './base-router.js';
import type { SuggestionService, SuggestionContext } from '../services/suggestion-service.js';
import type { ObservationType } from '@claude-mem/types';

/**
 * Helper to get string from query/params
 */
function getString(val: unknown): string | undefined {
  if (Array.isArray(val)) return val[0];
  if (typeof val === 'string') return val;
  return undefined;
}

export interface SuggestionsRouterDeps {
  suggestionService: SuggestionService;
}

export class SuggestionsRouter extends BaseRouter {
  constructor(private readonly deps: SuggestionsRouterDeps) {
    super();
  }

  protected setupRoutes(): void {
    // Get suggestions
    this.router.get('/', this.asyncHandler(this.getSuggestions.bind(this)));

    // Get suggestions for a specific file
    this.router.get('/for-file', this.asyncHandler(this.getSuggestionsForFile.bind(this)));

    // Get suggestions for an error
    this.router.get('/for-error', this.asyncHandler(this.getSuggestionsForError.bind(this)));

    // Submit feedback
    this.router.post('/:id/feedback', this.asyncHandler(this.submitFeedback.bind(this)));

    // Get feedback stats
    this.router.get('/feedback/stats', this.asyncHandler(this.getFeedbackStats.bind(this)));

    // Clear cache
    this.router.post('/cache/clear', this.asyncHandler(this.clearCache.bind(this)));
  }

  /**
   * GET /api/suggestions
   * Get suggestions based on context
   */
  private async getSuggestions(req: Request, res: Response): Promise<void> {
    const context: SuggestionContext = {
      project: getString(req.query.project),
      filePath: getString(req.query.filePath),
      cwd: getString(req.query.cwd),
      keywords: getString(req.query.keywords)?.split(',').filter(Boolean),
      types: getString(req.query.types)?.split(',').filter(Boolean) as ObservationType[] | undefined,
      errorMessage: getString(req.query.error),
    };

    const limit = this.parseOptionalIntParam(getString(req.query.limit)) ?? 5;

    const suggestions = await this.deps.suggestionService.getSuggestions(context, limit);

    this.success(res, {
      suggestions: suggestions.map(s => ({
        id: s.id,
        relevance: s.relevance,
        reason: s.reason,
        matchType: s.matchType,
        observation: {
          id: s.observation.id,
          title: s.observation.title,
          subtitle: s.observation.subtitle,
          type: s.observation.type,
          project: s.observation.project,
          created_at: s.observation.created_at,
          pinned: s.observation.pinned,
        },
      })),
      context: {
        project: context.project,
        filePath: context.filePath,
        cwd: context.cwd,
      },
      total: suggestions.length,
    });
  }

  /**
   * GET /api/suggestions/for-file
   * Get suggestions for a specific file
   */
  private async getSuggestionsForFile(req: Request, res: Response): Promise<void> {
    const filePath = getString(req.query.path);
    const project = getString(req.query.project);

    if (!filePath) {
      this.badRequest('path parameter is required');
    }

    const context: SuggestionContext = {
      project,
      filePath,
    };

    const limit = this.parseOptionalIntParam(getString(req.query.limit)) ?? 5;
    const suggestions = await this.deps.suggestionService.getSuggestions(context, limit);

    this.success(res, {
      suggestions: suggestions.map(s => ({
        id: s.id,
        relevance: s.relevance,
        reason: s.reason,
        matchType: s.matchType,
        observation: {
          id: s.observation.id,
          title: s.observation.title,
          subtitle: s.observation.subtitle,
          type: s.observation.type,
          created_at: s.observation.created_at,
        },
      })),
      filePath,
      total: suggestions.length,
    });
  }

  /**
   * GET /api/suggestions/for-error
   * Get suggestions for an error message
   */
  private async getSuggestionsForError(req: Request, res: Response): Promise<void> {
    const errorMessage = getString(req.query.error);
    const project = getString(req.query.project);

    if (!errorMessage) {
      this.badRequest('error parameter is required');
    }

    const context: SuggestionContext = {
      project,
      errorMessage,
    };

    const limit = this.parseOptionalIntParam(getString(req.query.limit)) ?? 5;
    const suggestions = await this.deps.suggestionService.getSuggestions(context, limit);

    this.success(res, {
      suggestions: suggestions.map(s => ({
        id: s.id,
        relevance: s.relevance,
        reason: s.reason,
        matchType: s.matchType,
        observation: {
          id: s.observation.id,
          title: s.observation.title,
          subtitle: s.observation.subtitle,
          type: s.observation.type,
          created_at: s.observation.created_at,
        },
      })),
      error: errorMessage,
      total: suggestions.length,
    });
  }

  /**
   * POST /api/suggestions/:id/feedback
   * Submit feedback for a suggestion
   */
  private async submitFeedback(req: Request, res: Response): Promise<void> {
    const observationId = this.parseIntParam(getString(req.params.id), 'id');
    const { helpful, context } = req.body;

    if (typeof helpful !== 'boolean') {
      this.badRequest('helpful parameter is required (boolean)');
    }

    const suggestionContext: SuggestionContext = context || {};

    this.deps.suggestionService.recordFeedback(observationId, suggestionContext, helpful);

    this.success(res, { recorded: true, observationId, helpful });
  }

  /**
   * GET /api/suggestions/feedback/stats
   * Get feedback statistics
   */
  private async getFeedbackStats(_req: Request, res: Response): Promise<void> {
    const stats = this.deps.suggestionService.getFeedbackStats();
    this.success(res, stats);
  }

  /**
   * POST /api/suggestions/cache/clear
   * Clear suggestion cache
   */
  private async clearCache(_req: Request, res: Response): Promise<void> {
    this.deps.suggestionService.clearCache();
    this.success(res, { cleared: true });
  }
}

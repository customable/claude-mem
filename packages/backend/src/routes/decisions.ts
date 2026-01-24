/**
 * Decisions Router
 *
 * API endpoints for conflict detection and decision management.
 */

import { BaseRouter } from './base-router.js';
import type { DecisionService } from '../services/decision-service.js';
import type { DecisionCategory } from '@claude-mem/types';

export interface DecisionsRouterDeps {
  decisionService: DecisionService;
}

export class DecisionsRouter extends BaseRouter {
  constructor(private deps: DecisionsRouterDeps) {
    super();
  }

  protected setupRoutes(): void {
    /**
     * POST /check-conflicts
     * Check for potential conflicts with existing decisions
     */
    this.router.post('/check-conflicts', async (req, res) => {
      try {
        const { content, category, project } = req.body as {
          content: string;
          category?: DecisionCategory;
          project: string;
        };

        if (!content || !project) {
          return res.status(400).json({
            error: 'Missing required fields: content, project',
          });
        }

        const result = await this.deps.decisionService.checkConflicts({
          content,
          category,
          project,
        });

        res.json(result);
      } catch (error) {
        this.handleError(res, error);
      }
    });

    /**
     * POST /:id/supersede
     * Mark a decision as superseded by another
     */
    this.router.post('/:id/supersede', async (req, res) => {
      try {
        const observationId = parseInt(req.params.id, 10);
        const { supersededBy, reason } = req.body as {
          supersededBy: number;
          reason?: string;
        };

        if (isNaN(observationId) || !supersededBy) {
          return res.status(400).json({
            error: 'Missing required fields: id, supersededBy',
          });
        }

        const result = await this.deps.decisionService.supersedeDecision(
          observationId,
          supersededBy,
          reason
        );

        if (!result) {
          return res.status(404).json({ error: 'Decision not found' });
        }

        res.json(result);
      } catch (error) {
        this.handleError(res, error);
      }
    });

    /**
     * GET /project/:project
     * Get all decisions for a project
     */
    this.router.get('/project/:project', async (req, res) => {
      try {
        const { project } = req.params;
        const { category, includeSuperseded, limit } = req.query as {
          category?: DecisionCategory;
          includeSuperseded?: string;
          limit?: string;
        };

        const decisions = await this.deps.decisionService.getDecisions(project, {
          category,
          includeSuperseded: includeSuperseded === 'true',
          limit: limit ? parseInt(limit, 10) : undefined,
        });

        res.json({ decisions });
      } catch (error) {
        this.handleError(res, error);
      }
    });

    /**
     * GET /project/:project/categories
     * Get decision categories with counts
     */
    this.router.get('/project/:project/categories', async (req, res) => {
      try {
        const { project } = req.params;
        const categories = await this.deps.decisionService.getDecisionCategories(project);
        res.json({ categories });
      } catch (error) {
        this.handleError(res, error);
      }
    });

    /**
     * GET /:id/history
     * Get decision history (chain of supersessions)
     */
    this.router.get('/:id/history', async (req, res) => {
      try {
        const observationId = parseInt(req.params.id, 10);

        if (isNaN(observationId)) {
          return res.status(400).json({ error: 'Invalid observation ID' });
        }

        const history = await this.deps.decisionService.getDecisionHistory(observationId);
        res.json({ history });
      } catch (error) {
        this.handleError(res, error);
      }
    });
  }

  private handleError(res: import('express').Response, error: unknown): void {
    console.error('Decision router error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

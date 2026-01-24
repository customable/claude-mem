/**
 * Sleep Agent Router
 *
 * API endpoints for memory consolidation and tier management.
 */

import { BaseRouter } from './base-router.js';
import type { SleepAgentService } from '../services/sleep-agent-service.js';
import type { MemoryTier } from '@claude-mem/types';

export interface SleepAgentRouterDeps {
  sleepAgentService: SleepAgentService;
}

export class SleepAgentRouter extends BaseRouter {
  constructor(private deps: SleepAgentRouterDeps) {
    super();
  }

  protected setupRoutes(): void {
    /**
     * GET /status
     * Get sleep agent status and tier distribution
     */
    this.router.get('/status', async (_req, res) => {
      try {
        const status = await this.deps.sleepAgentService.getStatus();
        res.json(status);
      } catch (error) {
        this.handleError(res, error);
      }
    });

    /**
     * POST /run
     * Trigger consolidation manually
     */
    this.router.post('/run', async (req, res) => {
      try {
        const { dryRun, tasks } = req.body as {
          dryRun?: boolean;
          tasks?: ('promote' | 'demote' | 'archive' | 'cleanup')[];
        };

        const result = await this.deps.sleepAgentService.runConsolidation({
          dryRun,
          tasks,
        });

        res.json(result);
      } catch (error) {
        this.handleError(res, error);
      }
    });

    /**
     * GET /tiers
     * Get observations grouped by tier
     */
    this.router.get('/tiers', async (req, res) => {
      try {
        const { project, limit } = req.query as {
          project?: string;
          limit?: string;
        };

        const tiers: Record<string, unknown[]> = {};
        for (const tier of ['core', 'working', 'archive', 'ephemeral'] as MemoryTier[]) {
          tiers[tier] = await this.deps.sleepAgentService.getByTier(tier, {
            project,
            limit: limit ? parseInt(limit, 10) : 20,
          });
        }

        res.json({ tiers });
      } catch (error) {
        this.handleError(res, error);
      }
    });

    /**
     * GET /tier/:tier
     * Get observations for a specific tier
     */
    this.router.get('/tier/:tier', async (req, res) => {
      try {
        const tier = req.params.tier as MemoryTier;
        const { project, limit } = req.query as {
          project?: string;
          limit?: string;
        };

        if (!['core', 'working', 'archive', 'ephemeral'].includes(tier)) {
          return res.status(400).json({ error: 'Invalid tier' });
        }

        const observations = await this.deps.sleepAgentService.getByTier(tier, {
          project,
          limit: limit ? parseInt(limit, 10) : 100,
        });

        res.json({ tier, observations });
      } catch (error) {
        this.handleError(res, error);
      }
    });

    /**
     * PUT /observation/:id/tier
     * Set tier for a specific observation
     */
    this.router.put('/observation/:id/tier', async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        const { tier } = req.body as { tier: MemoryTier };

        if (isNaN(id)) {
          return res.status(400).json({ error: 'Invalid observation ID' });
        }

        if (!['core', 'working', 'archive', 'ephemeral'].includes(tier)) {
          return res.status(400).json({ error: 'Invalid tier' });
        }

        const result = await this.deps.sleepAgentService.setTier(id, tier);

        if (!result) {
          return res.status(404).json({ error: 'Observation not found' });
        }

        res.json(result);
      } catch (error) {
        this.handleError(res, error);
      }
    });
  }

  private handleError(res: import('express').Response, error: unknown): void {
    console.error('Sleep agent router error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

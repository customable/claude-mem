/**
 * Insights Routes
 *
 * API endpoints for learning insights dashboard.
 */

import type { Request, Response } from 'express';
import { BaseRouter } from './base-router.js';
import type { InsightsService } from '../services/insights-service.js';

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

export interface InsightsRouterDeps {
  insightsService: InsightsService;
}

export class InsightsRouter extends BaseRouter {
  constructor(private readonly deps: InsightsRouterDeps) {
    super();
  }

  protected setupRoutes(): void {
    // Summary
    this.router.get('/summary', this.asyncHandler(this.getSummary.bind(this)));

    // Activity
    this.router.get('/activity', this.asyncHandler(this.getActivity.bind(this)));
    this.router.get('/activity/heatmap', this.asyncHandler(this.getHeatmap.bind(this)));

    // Technologies
    this.router.get('/technologies', this.asyncHandler(this.getTechnologies.bind(this)));
    this.router.get('/technologies/categories', this.asyncHandler(this.getTechnologyCategories.bind(this)));
    this.router.post('/technologies', this.asyncHandler(this.trackTechnology.bind(this)));

    // Achievements
    this.router.get('/achievements', this.asyncHandler(this.getAchievements.bind(this)));
    this.router.post('/achievements/check', this.asyncHandler(this.checkAchievements.bind(this)));
  }

  /**
   * GET /insights/summary
   * Get summary insights for a date range
   */
  private async getSummary(req: Request, res: Response): Promise<void> {
    const days = getNumber(req.query.days, 30);
    const summary = await this.deps.insightsService.getSummary(days);
    res.json(summary);
  }

  /**
   * GET /insights/activity
   * Get recent daily activity stats
   */
  private async getActivity(req: Request, res: Response): Promise<void> {
    const days = getNumber(req.query.days, 30);
    const activity = await this.deps.insightsService.getRecentActivity(days);
    res.json(activity);
  }

  /**
   * GET /insights/activity/heatmap
   * Get activity heatmap data for the past year
   */
  private async getHeatmap(_req: Request, res: Response): Promise<void> {
    const heatmap = await this.deps.insightsService.getActivityHeatmap();
    res.json(heatmap);
  }

  /**
   * GET /insights/technologies
   * Get top technologies
   */
  private async getTechnologies(req: Request, res: Response): Promise<void> {
    const limit = getNumber(req.query.limit, 10);
    const project = getString(req.query.project);

    const technologies = project
      ? await this.deps.insightsService.getTechnologiesByProject(project)
      : await this.deps.insightsService.getTopTechnologies(limit);

    res.json(technologies);
  }

  /**
   * GET /insights/technologies/categories
   * Get distinct technology categories
   */
  private async getTechnologyCategories(_req: Request, res: Response): Promise<void> {
    const categories = await this.deps.insightsService.getTechnologyCategories();
    res.json(categories);
  }

  /**
   * POST /insights/technologies
   * Track technology usage
   */
  private async trackTechnology(req: Request, res: Response): Promise<void> {
    const { name, category, project } = req.body as {
      name: string;
      category?: string;
      project?: string;
    };

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const technology = await this.deps.insightsService.trackTechnology(name, category, project);
    res.json(technology);
  }

  /**
   * GET /insights/achievements
   * Get all achievements with progress
   */
  private async getAchievements(_req: Request, res: Response): Promise<void> {
    const achievements = await this.deps.insightsService.getAchievements();
    res.json(achievements);
  }

  /**
   * POST /insights/achievements/check
   * Check and update achievements based on current stats
   */
  private async checkAchievements(_req: Request, res: Response): Promise<void> {
    const updated = await this.deps.insightsService.checkAchievements();
    res.json({
      checked: true,
      updated: updated.length,
      achievements: updated,
    });
  }
}

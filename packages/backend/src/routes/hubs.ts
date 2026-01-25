/**
 * Hubs Routes (Issue #263)
 *
 * API endpoints for hub management.
 */

import type { Request, Response } from 'express';
import { BaseRouter } from './base-router.js';
import type { HubRegistry } from '../services/hub-registry.js';
import type { CreateHubInput, UpdateHubInput } from '@claude-mem/types';

/**
 * Helper to get required string from params
 */
function getRequiredString(val: unknown): string {
  if (Array.isArray(val)) return val[0] ?? '';
  if (typeof val === 'string') return val;
  return '';
}

export interface HubsRouterDeps {
  hubRegistry: HubRegistry;
}

export class HubsRouter extends BaseRouter {
  constructor(private readonly deps: HubsRouterDeps) {
    super();
  }

  protected setupRoutes(): void {
    // Get hub stats (must be before /:id)
    this.router.get('/stats', this.asyncHandler(this.getStats.bind(this)));

    // List all hubs
    this.router.get('/', this.asyncHandler(this.listHubs.bind(this)));

    // Register a new external hub
    this.router.post('/', this.asyncHandler(this.registerHub.bind(this)));

    // Get hub details
    this.router.get('/:id', this.asyncHandler(this.getHub.bind(this)));

    // Get workers connected to a hub
    this.router.get('/:id/workers', this.asyncHandler(this.getHubWorkers.bind(this)));

    // Update hub configuration
    this.router.patch('/:id', this.asyncHandler(this.updateHub.bind(this)));
    this.router.put('/:id', this.asyncHandler(this.updateHub.bind(this)));

    // Remove a hub
    this.router.delete('/:id', this.asyncHandler(this.removeHub.bind(this)));
  }

  /**
   * GET /api/hubs/stats
   */
  private async getStats(_req: Request, res: Response): Promise<void> {
    const hubs = await this.deps.hubRegistry.listHubs();
    const healthyHubs = hubs.filter((h) => h.status === 'healthy').length;
    const totalWorkers = hubs.reduce((sum, h) => sum + h.connected_workers, 0);
    const activeWorkers = hubs.reduce((sum, h) => sum + h.active_workers, 0);

    this.success(res, {
      totalHubs: hubs.length,
      healthyHubs,
      totalWorkers,
      activeWorkers,
    });
  }

  /**
   * GET /api/hubs
   */
  private async listHubs(_req: Request, res: Response): Promise<void> {
    const hubs = await this.deps.hubRegistry.listHubs();
    this.success(res, {
      data: hubs.map((h) => this.deps.hubRegistry.toRecord(h)),
      total: hubs.length,
    });
  }

  /**
   * POST /api/hubs
   * Body: CreateHubInput
   */
  private async registerHub(req: Request, res: Response): Promise<void> {
    const input = req.body as CreateHubInput;

    if (!input.name || typeof input.name !== 'string') {
      this.badRequest('Hub name is required');
    }

    const hub = await this.deps.hubRegistry.registerHub(input);
    this.created(res, this.deps.hubRegistry.toRecord(hub));
  }

  /**
   * GET /api/hubs/:id
   */
  private async getHub(req: Request, res: Response): Promise<void> {
    const id = getRequiredString(req.params.id);
    const hub = await this.deps.hubRegistry.getHub(id);

    if (!hub) {
      this.notFound(`Hub not found: ${id}`);
    }

    this.success(res, this.deps.hubRegistry.toRecord(hub!));
  }

  /**
   * PATCH /api/hubs/:id
   * Body: UpdateHubInput
   */
  private async updateHub(req: Request, res: Response): Promise<void> {
    const id = getRequiredString(req.params.id);
    const input = req.body as UpdateHubInput;

    const hub = await this.deps.hubRegistry.updateHub(id, input);

    if (!hub) {
      this.notFound(`Hub not found: ${id}`);
    }

    this.success(res, this.deps.hubRegistry.toRecord(hub!));
  }

  /**
   * GET /api/hubs/:id/workers
   */
  private async getHubWorkers(req: Request, res: Response): Promise<void> {
    const id = getRequiredString(req.params.id);
    const hub = await this.deps.hubRegistry.getHub(id);

    if (!hub) {
      this.notFound(`Hub not found: ${id}`);
    }

    // Get workers for this hub from registrations
    const workers = await this.deps.hubRegistry.getHubWorkers(id);

    this.success(res, {
      data: workers,
      total: workers.length,
    });
  }

  /**
   * DELETE /api/hubs/:id
   */
  private async removeHub(req: Request, res: Response): Promise<void> {
    const id = getRequiredString(req.params.id);

    const success = await this.deps.hubRegistry.removeHub(id);

    if (!success) {
      this.badRequest('Cannot remove hub (may be built-in or not found)');
    }

    this.success(res, { message: 'Hub removed', id });
  }
}

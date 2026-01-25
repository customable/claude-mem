/**
 * Worker Tokens Routes (Issue #263)
 *
 * API endpoints for worker token management.
 */

import type { Request, Response } from 'express';
import { BaseRouter } from './base-router.js';
import type { WorkerTokenService } from '../services/worker-token-service.js';
import type { CreateTokenInput } from '@claude-mem/types';

/**
 * Helper to get required string from params
 */
function getRequiredString(val: unknown): string {
  if (Array.isArray(val)) return val[0] ?? '';
  if (typeof val === 'string') return val;
  return '';
}

export interface WorkerTokensRouterDeps {
  workerTokenService: WorkerTokenService;
}

export class WorkerTokensRouter extends BaseRouter {
  constructor(private readonly deps: WorkerTokensRouterDeps) {
    super();
  }

  protected setupRoutes(): void {
    // List all tokens
    this.router.get('/', this.asyncHandler(this.listTokens.bind(this)));

    // Create a new token
    this.router.post('/', this.asyncHandler(this.createToken.bind(this)));

    // Get token details
    this.router.get('/:id', this.asyncHandler(this.getToken.bind(this)));

    // Get registrations using a token (UI expects /registrations)
    this.router.get('/:id/registrations', this.asyncHandler(this.getTokenWorkers.bind(this)));
    this.router.get('/:id/workers', this.asyncHandler(this.getTokenWorkers.bind(this)));

    // Revoke a token
    this.router.delete('/:id', this.asyncHandler(this.revokeToken.bind(this)));
  }

  /**
   * GET /api/worker-tokens
   */
  private async listTokens(_req: Request, res: Response): Promise<void> {
    const tokens = await this.deps.workerTokenService.listTokens();
    this.success(res, {
      data: tokens,
      total: tokens.length,
    });
  }

  /**
   * POST /api/worker-tokens
   * Body: CreateTokenInput
   */
  private async createToken(req: Request, res: Response): Promise<void> {
    const input = req.body as CreateTokenInput;

    if (!input.name || typeof input.name !== 'string') {
      this.badRequest('Token name is required');
    }

    const result = await this.deps.workerTokenService.createToken(input);

    // Return the plaintext token - this is the only time it's visible!
    // UI expects: { token, id, prefix }
    this.created(res, {
      token: result.plainToken,
      id: result.token.id,
      prefix: result.token.tokenPrefix,
      warning: 'Store this token securely - it will not be shown again!',
    });
  }

  /**
   * GET /api/worker-tokens/:id
   */
  private async getToken(req: Request, res: Response): Promise<void> {
    const id = getRequiredString(req.params.id);
    const token = await this.deps.workerTokenService.getToken(id);

    if (!token) {
      this.notFound(`Token not found: ${id}`);
    }

    this.success(res, token);
  }

  /**
   * GET /api/worker-tokens/:id/registrations
   * GET /api/worker-tokens/:id/workers
   */
  private async getTokenWorkers(req: Request, res: Response): Promise<void> {
    const id = getRequiredString(req.params.id);
    const token = await this.deps.workerTokenService.getToken(id);

    if (!token) {
      this.notFound(`Token not found: ${id}`);
    }

    const workers = await this.deps.workerTokenService.getTokenWorkers(id);

    this.success(res, {
      data: workers,
      total: workers.length,
    });
  }

  /**
   * DELETE /api/worker-tokens/:id
   */
  private async revokeToken(req: Request, res: Response): Promise<void> {
    const id = getRequiredString(req.params.id);

    const success = await this.deps.workerTokenService.revokeToken(id);

    if (!success) {
      this.notFound(`Token not found: ${id}`);
    }

    this.success(res, { message: 'Token revoked', id });
  }
}

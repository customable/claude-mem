/**
 * Stream Routes
 *
 * Server-Sent Events endpoint for real-time updates.
 */

import type { Request, Response } from 'express';
import { BaseRouter } from './base-router.js';
import type { SSEBroadcaster } from '../services/sse-broadcaster.js';

export interface StreamRouterDeps {
  sseBroadcaster: SSEBroadcaster;
}

export class StreamRouter extends BaseRouter {
  constructor(private readonly deps: StreamRouterDeps) {
    super();
  }

  protected setupRoutes(): void {
    // SSE stream endpoint
    this.router.get('/', this.stream.bind(this));
  }

  /**
   * GET /api/stream
   * SSE endpoint for real-time updates
   */
  private stream(_req: Request, res: Response): void {
    // Add client to broadcaster
    const clientId = this.deps.sseBroadcaster.addClient(res);

    // Keep connection alive with periodic comments
    const keepAlive = setInterval(() => {
      if (!res.writableEnded) {
        res.write(':keepalive\n\n');
      }
    }, 30000);

    // Cleanup on close
    res.on('close', () => {
      clearInterval(keepAlive);
      this.deps.sseBroadcaster.removeClient(clientId);
    });
  }
}

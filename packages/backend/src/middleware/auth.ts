/**
 * Authentication Middleware
 *
 * Handles authentication for remote access.
 * Localhost is always allowed, remote requires token.
 */

import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '@claude-mem/shared';
import { UnauthorizedError } from './error-handler.js';

const logger = createLogger('auth');

/**
 * Check if request is from localhost
 */
function isLocalhost(req: Request): boolean {
  const ip = req.ip || req.socket.remoteAddress || '';
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === 'localhost' ||
    ip === '::ffff:127.0.0.1'
  );
}

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(authToken?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Always allow localhost
    if (isLocalhost(req)) {
      next();
      return;
    }

    // If no auth token configured, deny all remote access
    if (!authToken) {
      logger.warn(`Remote access denied (no token configured): ${req.ip}`);
      throw new UnauthorizedError('Remote access not configured');
    }

    // Check for Bearer token
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      if (token === authToken) {
        next();
        return;
      }
    }

    // Check for token in cookie
    const cookieToken = req.cookies?.auth_token;
    if (cookieToken === authToken) {
      next();
      return;
    }

    logger.warn(`Unauthorized remote access attempt: ${req.ip}`);
    throw new UnauthorizedError('Invalid or missing authentication token');
  };
}

/**
 * Require localhost-only access
 */
export function requireLocalhost(req: Request, _res: Response, next: NextFunction): void {
  if (!isLocalhost(req)) {
    throw new UnauthorizedError('This endpoint is only accessible from localhost');
  }
  next();
}

/**
 * Request Logger Middleware (Issue #208)
 *
 * Logs incoming requests and outgoing responses with timing information.
 * Includes slow request warnings.
 */

import type { Request, Response, NextFunction } from 'express';
import { logger, getSettings } from '@claude-mem/shared';

// Slow request threshold in milliseconds
const SLOW_REQUEST_THRESHOLD_MS = 1000;

// Paths to skip logging (health checks, etc.)
const SKIP_PATHS = new Set(['/health', '/api/health', '/metrics', '/favicon.ico']);

/**
 * Normalize path for logging (replace IDs with :id)
 */
function normalizePath(path: string): string {
  return path
    // UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    // Numeric IDs
    .replace(/\/\d+(?=\/|$)/g, '/:id');
}

/**
 * Middleware that logs requests and responses
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip logging for certain paths
  if (SKIP_PATHS.has(req.path)) {
    return next();
  }

  const start = Date.now();
  const requestId = req.requestId || 'unknown';

  // Log request start (debug level to avoid noise)
  logger.debug('API request started', {
    requestId,
    method: req.method,
    path: req.path,
    normalizedPath: normalizePath(req.path),
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    contentLength: req.headers['content-length'],
  });

  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    // Determine log level based on status and duration
    const isError = status >= 400;
    const isSlow = duration > SLOW_REQUEST_THRESHOLD_MS;

    const logData = {
      requestId,
      method: req.method,
      path: normalizePath(req.path),
      status,
      duration,
      contentLength: res.getHeader('content-length'),
    };

    if (isError && status >= 500) {
      logger.error('API request failed', logData);
    } else if (isError) {
      logger.warn('API request client error', logData);
    } else if (isSlow) {
      logger.warn('Slow API request', logData);
    } else {
      logger.info('API request completed', logData);
    }
  });

  next();
}

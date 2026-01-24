/**
 * Metrics Middleware (Issue #209)
 *
 * Tracks HTTP request duration and counts for Prometheus.
 */

import type { Request, Response, NextFunction } from 'express';
import { httpRequestDuration, httpRequestTotal } from '../metrics/index.js';

// Paths to skip metrics collection
const SKIP_PATHS = new Set(['/metrics', '/favicon.ico']);

/**
 * Normalize path for metrics (replace IDs with :id to reduce cardinality)
 */
function normalizePath(path: string): string {
  return path
    // UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    // Numeric IDs
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    // Limit path length to prevent cardinality explosion
    .slice(0, 50);
}

/**
 * Middleware that tracks HTTP request metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip metrics for certain paths
  if (SKIP_PATHS.has(req.path)) {
    return next();
  }

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const labels = {
      method: req.method,
      path: normalizePath(req.path),
      status: String(res.statusCode),
    };

    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);
  });

  next();
}

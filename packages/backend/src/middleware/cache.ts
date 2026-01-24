/**
 * Cache Middleware (Issue #203)
 *
 * HTTP caching middleware with ETag support and cache-control headers.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { createHash } from 'crypto';
import { createLogger } from '@claude-mem/shared';
import { ResponseCache, createCacheKey } from '../services/cache-service.js';

const logger = createLogger('cache-middleware');

export interface CacheMiddlewareOptions {
  /** Cache instance to use */
  cache: ResponseCache;
  /** Function to generate cache key from request */
  keyFn?: (req: Request) => string;
  /** Cache-Control max-age in seconds (default: derived from cache TTL) */
  maxAge?: number;
  /** Whether cache is public or private (default: private) */
  isPublic?: boolean;
  /** Whether to add ETag header (default: true) */
  useEtag?: boolean;
}

/**
 * Default key generator based on URL and query params
 */
function defaultKeyFn(req: Request): string {
  const params: Record<string, unknown> = { ...req.query };
  return createCacheKey(req.path, params);
}

/**
 * Generate ETag from data
 */
function generateEtag(data: unknown): string {
  const hash = createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex');
  return `"${hash}"`;
}

/**
 * Create caching middleware for a route
 *
 * Usage:
 * ```ts
 * router.get('/projects', withCache({ cache: projectCache }), handler);
 * ```
 */
export function withCache(options: CacheMiddlewareOptions): RequestHandler {
  const {
    cache,
    keyFn = defaultKeyFn,
    maxAge,
    isPublic = false,
    useEtag = true,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      next();
      return;
    }

    const cacheKey = keyFn(req);

    try {
      // Check cache
      const cached = cache.get(cacheKey);

      if (cached !== undefined) {
        // Set cache headers
        const cacheControl = isPublic ? 'public' : 'private';
        const age = maxAge ?? 60;
        res.set('Cache-Control', `${cacheControl}, max-age=${age}`);

        // ETag support
        if (useEtag) {
          const etag = generateEtag(cached);
          res.set('ETag', etag);

          // Check If-None-Match
          const ifNoneMatch = req.headers['if-none-match'];
          if (ifNoneMatch === etag) {
            res.status(304).end();
            return;
          }
        }

        res.set('X-Cache', 'HIT');
        res.json(cached);
        return;
      }

      // Cache miss - capture response
      res.set('X-Cache', 'MISS');

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json to capture response data
      res.json = function(data: unknown): Response {
        // Cache the response (only cache objects)
        if (data !== null && typeof data === 'object') {
          cache.set(cacheKey, data as object);
        }

        // Set cache headers
        const cacheControl = isPublic ? 'public' : 'private';
        const age = maxAge ?? 60;
        res.set('Cache-Control', `${cacheControl}, max-age=${age}`);

        // Add ETag
        if (useEtag) {
          res.set('ETag', generateEtag(data));
        }

        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error', { error, key: cacheKey });
      next();
    }
  };
}

/**
 * Middleware to set no-cache headers for dynamic content
 */
export function noCache(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  };
}

/**
 * Middleware to set cache headers without server-side caching
 */
export function cacheHeaders(options: {
  maxAge: number;
  isPublic?: boolean;
}): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const cacheControl = options.isPublic ? 'public' : 'private';
    res.set('Cache-Control', `${cacheControl}, max-age=${options.maxAge}`);
    next();
  };
}

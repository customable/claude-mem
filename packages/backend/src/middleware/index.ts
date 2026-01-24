/**
 * Middleware Exports
 */

export {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from './error-handler.js';
export type { ErrorResponse } from './error-handler.js';

export { createAuthMiddleware, requireLocalhost } from './auth.js';

export { requestIdMiddleware } from './request-id.js';
export { requestLoggerMiddleware } from './request-logger.js';
export { metricsMiddleware } from './metrics.js';

export { withCache, noCache, cacheHeaders } from './cache.js';
export type { CacheMiddlewareOptions } from './cache.js';

export {
  standardLimiter,
  expensiveLimiter,
  searchLimiter,
  speedLimiter,
  workerSpawnLimiter,
  projectLimiter,
  adminLimiter,
} from './rate-limit.js';

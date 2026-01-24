/**
 * Express Application Setup
 *
 * Creates and configures the Express application.
 */

import express, { type Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createLogger } from '@claude-mem/shared';
import {
  errorHandler,
  notFoundHandler,
  createAuthMiddleware,
  requestIdMiddleware,
  requestLoggerMiddleware,
  metricsMiddleware,
} from '../middleware/index.js';

const logger = createLogger('app');

export interface AppOptions {
  /** Auth token for remote access */
  authToken?: string;
  /** Enable CORS */
  enableCors?: boolean;
  /** Request body size limit */
  bodyLimit?: string;
}

/**
 * Create and configure Express application
 */
export function createApp(options: AppOptions = {}): Application {
  const app = express();

  // Trust proxy (for correct IP detection behind reverse proxy)
  app.set('trust proxy', true);

  // Body parsing
  app.use(express.json({ limit: options.bodyLimit ?? '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: options.bodyLimit ?? '50mb' }));

  // Cookies
  app.use(cookieParser());

  // CORS
  if (options.enableCors !== false) {
    app.use(cors({
      origin: true,
      credentials: true,
    }));
  }

  // Request ID and tracing (Issue #208)
  app.use(requestIdMiddleware);

  // Structured request logging (Issue #208)
  app.use(requestLoggerMiddleware);

  // Prometheus metrics collection (Issue #209)
  app.use(metricsMiddleware);

  // Authentication (applied to all /api routes)
  if (options.authToken) {
    app.use('/api', createAuthMiddleware(options.authToken));
  }

  return app;
}

/**
 * Finalize app setup (error handlers must be last)
 */
export function finalizeApp(app: Application): void {
  // 404 handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);
}

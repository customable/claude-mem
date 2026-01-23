/**
 * @claude-mem/backend
 *
 * Backend server for claude-mem.
 * Provides REST API, WebSocket Hub for workers, and task queue management.
 */

// Server
export { BackendService, createApp, finalizeApp } from './server/index.js';
export type { BackendServiceOptions, AppOptions } from './server/index.js';

// WebSocket
export { WorkerHub, TaskDispatcher } from './websocket/index.js';
export type {
  WorkerHubOptions,
  TaskDispatcherOptions,
  ConnectedWorker,
  WorkerStats,
  TaskAssignment,
} from './websocket/index.js';

// Services
export { SSEBroadcaster, TaskService, SessionService } from './services/index.js';
export type { SSEEvent, SSEEventType, TaskServiceOptions } from './services/index.js';

// Middleware
export {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  createAuthMiddleware,
  requireLocalhost,
  AppError,
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from './middleware/index.js';
export type { ErrorResponse } from './middleware/index.js';

// Routes
export {
  BaseRouter,
  HealthRouter,
  HooksRouter,
  DataRouter,
  StreamRouter,
  WorkersRouter,
} from './routes/index.js';

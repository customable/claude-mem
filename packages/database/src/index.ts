/**
 * @claude-mem/database
 *
 * Database layer for claude-mem.
 *
 * Currently provides SQLite implementation. The Repository pattern
 * allows for easy extension to other databases (PostgreSQL, etc.)
 */

// SQLite implementation (default)
export * from './sqlite/index.js';

// Migrations
export { MigrationRunner, migrations } from './migrations/index.js';
export type { Migration } from './migrations/index.js';
export * as schema from './migrations/schema.js';

// Re-export types for convenience
export type {
  IDatabaseConnection,
  IUnitOfWork,
  ISessionRepository,
  IObservationRepository,
  ISummaryRepository,
  IUserPromptRepository,
  ITaskQueueRepository,
  DatabaseConfig,
} from '@claude-mem/types';

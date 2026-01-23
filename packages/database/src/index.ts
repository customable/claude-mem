/**
 * @claude-mem/database
 *
 * Database layer for claude-mem.
 *
 * Uses MikroORM for multi-database support (SQLite, PostgreSQL, MySQL).
 * The Repository pattern provides clean abstractions for data access.
 */

// MikroORM implementation (primary entry point)
export * as mikroOrm from './mikro-orm/index.js';

// SQLite implementation (legacy, for migration compatibility)
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
  IDocumentRepository,
  IUserPromptRepository,
  ITaskQueueRepository,
  DatabaseConfig,
} from '@claude-mem/types';

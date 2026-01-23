/**
 * @claude-mem/database
 *
 * Database layer for claude-mem.
 *
 * Provides two implementations:
 * 1. SQLite with raw bun:sqlite (default, legacy)
 * 2. MikroORM (multi-database support: SQLite, PostgreSQL, MySQL)
 *
 * The Repository pattern allows for easy extension to other databases.
 */

// SQLite implementation (default, legacy)
export * from './sqlite/index.js';

// MikroORM implementation (multi-database support)
export * as mikroOrm from './mikro-orm/index.js';

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

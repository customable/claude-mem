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

// NOTE: Legacy SQLite implementation (bun:sqlite) and MigrationRunner removed.
// They are incompatible with Node.js. MikroORM handles migrations now.

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

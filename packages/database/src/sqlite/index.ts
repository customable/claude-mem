/**
 * SQLite Database Module
 *
 * Provides SQLite implementation of the database layer.
 */

export { SQLiteConnection, createSQLiteConnection } from './connection.js';
export type { Database } from './connection.js';

export { SQLiteUnitOfWork } from './unit-of-work.js';

export {
  SQLiteSessionRepository,
  SQLiteObservationRepository,
  SQLiteSummaryRepository,
  SQLiteUserPromptRepository,
  SQLiteTaskQueueRepository,
  SQLiteClaudeMdRepository,
} from './repositories/index.js';

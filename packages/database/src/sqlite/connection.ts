/**
 * SQLite Database Connection
 *
 * Manages the SQLite database connection using bun:sqlite.
 */

import { Database } from 'bun:sqlite';
import type { IDatabaseConnection, DatabaseConfig } from '@claude-mem/types';
import { createLogger, DB_PATH, DATA_DIR, ensureDir } from '@claude-mem/shared';
import { MigrationRunner } from '../migrations/runner.js';

const logger = createLogger('sqlite');

// SQLite optimization constants
const SQLITE_MMAP_SIZE_BYTES = 256 * 1024 * 1024; // 256MB
const SQLITE_CACHE_SIZE_PAGES = 10_000;

/**
 * SQLite Database Connection implementation
 */
export class SQLiteConnection implements IDatabaseConnection {
  private db: Database | null = null;
  private dbPath: string;
  private isInitialized = false;

  constructor(config?: DatabaseConfig) {
    this.dbPath = config?.path || DB_PATH;
  }

  /**
   * Initialize the database connection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Ensure data directory exists (skip for in-memory)
    if (this.dbPath !== ':memory:') {
      ensureDir(DATA_DIR);
    }

    logger.info('Initializing SQLite database', { path: this.dbPath });

    // Create database connection
    this.db = new Database(this.dbPath, { create: true, readwrite: true });

    // Apply optimized SQLite settings
    this.db.run('PRAGMA journal_mode = WAL');
    this.db.run('PRAGMA synchronous = NORMAL');
    this.db.run('PRAGMA foreign_keys = ON');
    this.db.run('PRAGMA temp_store = memory');
    this.db.run(`PRAGMA mmap_size = ${SQLITE_MMAP_SIZE_BYTES}`);
    this.db.run(`PRAGMA cache_size = ${SQLITE_CACHE_SIZE_PAGES}`);

    // Run migrations
    const migrationRunner = new MigrationRunner(this.db);
    migrationRunner.runAllMigrations();

    this.isInitialized = true;
    logger.info('SQLite database initialized successfully');
  }

  /**
   * Check if database is connected
   */
  isConnected(): boolean {
    return this.db !== null && this.isInitialized;
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      logger.info('SQLite database connection closed');
    }
  }

  /**
   * Run a function within a transaction
   */
  transaction<T>(fn: () => T): T {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    const txn = this.db.transaction(fn);
    return txn();
  }

  /**
   * Get the raw bun:sqlite Database instance
   */
  getRawConnection(): Database {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * Get the database instance (alias for getRawConnection)
   */
  getDb(): Database {
    return this.getRawConnection();
  }
}

/**
 * Create a new SQLite connection
 */
export function createSQLiteConnection(config?: DatabaseConfig): SQLiteConnection {
  return new SQLiteConnection(config);
}

// Re-export bun:sqlite Database type
export type { Database };

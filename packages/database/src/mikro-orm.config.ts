/**
 * MikroORM Configuration
 *
 * Multi-database configuration supporting SQLite, PostgreSQL, and MySQL/MariaDB.
 */

import { defineConfig as defineSqliteConfig } from '@mikro-orm/better-sqlite';
import { defineConfig as definePostgresConfig } from '@mikro-orm/postgresql';
import { defineConfig as defineMySqlConfig } from '@mikro-orm/mysql';
import { Migrator } from '@mikro-orm/migrations';
import {
  Session,
  Observation,
  Summary,
  UserPrompt,
  Document,
  Task,
  ClaudeMd,
  PendingMessage,
} from './entities/index.js';
import { Migration20240101000001_InitialSchema } from './mikro-orm/migrations/Migration20240101000001_InitialSchema.js';
import { Migration20240101000002_FTS5Indexes } from './mikro-orm/migrations/Migration20240101000002_FTS5Indexes.js';
import { Migration20260123000003_SessionWorkingDirectory } from './mikro-orm/migrations/Migration20260123000003_SessionWorkingDirectory.js';

/**
 * Database configuration options
 */
export interface DatabaseOptions {
  type: 'sqlite' | 'postgresql' | 'mysql';
  // SQLite
  dbPath?: string;
  // PostgreSQL/MySQL
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  dbName?: string;
  // Common
  debug?: boolean;
}

/**
 * All entities
 */
export const entities = [
  Session,
  Observation,
  Summary,
  UserPrompt,
  Document,
  Task,
  ClaudeMd,
  PendingMessage,
];

/**
 * All migrations
 */
export const migrationsList = [
  Migration20240101000001_InitialSchema,
  Migration20240101000002_FTS5Indexes,
  Migration20260123000003_SessionWorkingDirectory,
];

/**
 * Create MikroORM configuration based on database type
 */
export function createMikroOrmConfig(options: DatabaseOptions) {
  switch (options.type) {
    case 'sqlite':
      return defineSqliteConfig({
        entities,
        dbName: options.dbPath || ':memory:',
        debug: options.debug ?? false,
        allowGlobalContext: true,
        extensions: [Migrator],
        migrations: {
          migrationsList,
          disableForeignKeys: false,
        },
      });

    case 'postgresql':
      return definePostgresConfig({
        entities,
        host: options.host || 'localhost',
        port: options.port || 5432,
        user: options.user || 'postgres',
        password: options.password,
        dbName: options.dbName || 'claude_mem',
        debug: options.debug ?? false,
        allowGlobalContext: true,
        extensions: [Migrator],
        migrations: {
          migrationsList,
        },
      });

    case 'mysql':
      return defineMySqlConfig({
        entities,
        host: options.host || 'localhost',
        port: options.port || 3306,
        user: options.user || 'root',
        password: options.password,
        dbName: options.dbName || 'claude_mem',
        debug: options.debug ?? false,
        allowGlobalContext: true,
        extensions: [Migrator],
        migrations: {
          migrationsList,
        },
      });

    default:
      throw new Error(`Unsupported database type: ${options.type}`);
  }
}

/**
 * Default SQLite configuration for development
 */
export default defineSqliteConfig({
  entities,
  dbName: './claude-mem.db',
  debug: false,
  extensions: [Migrator],
  migrations: {
    migrationsList,
    disableForeignKeys: false,
  },
});

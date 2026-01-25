/**
 * MikroORM Configuration
 *
 * Multi-database configuration supporting SQLite, PostgreSQL, and MySQL/MariaDB.
 *
 * Use `npx mikro-orm migration:create --name=NAME` to generate new migrations.
 * New migrations are created in src/mikro-orm/migrations/ and must be added to migrationsList.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig as defineSqliteConfig } from '@mikro-orm/better-sqlite';
import { defineConfig as definePostgresConfig } from '@mikro-orm/postgresql';
import { defineConfig as defineMySqlConfig } from '@mikro-orm/mysql';
import { Migrator, type Migration } from '@mikro-orm/migrations';
import type { Constructor } from '@mikro-orm/core';
import {
  Session,
  Observation,
  Summary,
  UserPrompt,
  Document,
  Task,
  ClaudeMd,
  CodeSnippet,
  DailyStats,
  TechnologyUsage,
  Achievement,
  RawMessage,
  ObservationLink,
  ObservationTemplate,
  ProjectSettings,
  Repository,
  ArchivedOutput,
  UserTask,
  WorkerToken,
  WorkerRegistration,
  Hub,
} from './entities/index.js';
import { Migration20260125094906_initial_schema } from './mikro-orm/migrations/Migration20260125094906_initial_schema.js';
import { Migration20260125100500_fts5_and_repositories } from './mikro-orm/migrations/Migration20260125100500_fts5_and_repositories.js';
import { Migration20260125101635_add_performance_indexes } from './mikro-orm/migrations/Migration20260125101635_add_performance_indexes.js';
import { Migration20260125104748_add_task_deduplication } from './mikro-orm/migrations/Migration20260125104748_add_task_deduplication.js';
import { Migration20260125124900_add_archived_outputs } from './mikro-orm/migrations/Migration20260125124900_add_archived_outputs.js';
import { Migration20260125180000_add_user_tasks } from './mikro-orm/migrations/Migration20260125180000_add_user_tasks.js';
import { Migration20260125200000_add_worker_federation } from './mikro-orm/migrations/Migration20260125200000_add_worker_federation.js';
import { Migration20260125210000_add_plan_mode_tracking } from './mikro-orm/migrations/Migration20260125210000_add_plan_mode_tracking.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  CodeSnippet,
  DailyStats,
  TechnologyUsage,
  Achievement,
  RawMessage,
  ObservationLink,
  ObservationTemplate,
  ProjectSettings,
  Repository,
  ArchivedOutput,
  UserTask,
  WorkerToken,
  WorkerRegistration,
  Hub,
];

/**
 * Explicit list of migrations (for runtime)
 */
export const migrationsList: Constructor<Migration>[] = [
  Migration20260125094906_initial_schema,
  Migration20260125100500_fts5_and_repositories,
  Migration20260125101635_add_performance_indexes,
  Migration20260125104748_add_task_deduplication,
  Migration20260125124900_add_archived_outputs,
  Migration20260125180000_add_user_tasks,
  Migration20260125200000_add_worker_federation,
  Migration20260125210000_add_plan_mode_tracking,
];

/**
 * Migration configuration
 *
 * Uses explicit migrationsList for runtime (avoids glob pattern issues with .d.ts files).
 * pathTs is set for CLI migration generation.
 */
const migrationsConfig = {
  migrationsList,
  // Path to TS source files (for CLI generation)
  // After build, __dirname points to dist/. We go up to package root and into src/
  pathTs: join(__dirname, '../src/mikro-orm/migrations'),
  // Don't disable FKs for SQLite (causes issues with WAL mode)
  disableForeignKeys: false,
};

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
        migrations: migrationsConfig,
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
        migrations: migrationsConfig,
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
        migrations: migrationsConfig,
      });

    default:
      throw new Error(`Unsupported database type: ${options.type}`);
  }
}

/**
 * Default SQLite configuration for CLI usage
 */
export default defineSqliteConfig({
  entities,
  dbName: './claude-mem.db',
  debug: false,
  extensions: [Migrator],
  migrations: migrationsConfig,
});

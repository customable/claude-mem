/**
 * Migration Runner
 *
 * Handles database schema migrations with version tracking.
 */

import type { Database } from 'bun:sqlite';
import { createLogger } from '@claude-mem/shared';
import * as schema from './schema.js';

const logger = createLogger('migrations');

/**
 * Migration definition
 */
export interface Migration {
  version: number;
  name: string;
  up: (db: Database) => void;
  down?: (db: Database) => void;
}

/**
 * All migrations in order
 */
export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: (db: Database) => {
      // Core tables
      db.run(schema.SESSIONS_TABLE);
      db.run(schema.SESSIONS_INDEXES);

      db.run(schema.OBSERVATIONS_TABLE);
      db.run(schema.OBSERVATIONS_INDEXES);

      db.run(schema.SUMMARIES_TABLE);
      db.run(schema.SUMMARIES_INDEXES);

      db.run(schema.USER_PROMPTS_TABLE);
      db.run(schema.USER_PROMPTS_INDEXES);

      db.run(schema.TASK_QUEUE_TABLE);
      db.run(schema.TASK_QUEUE_INDEXES);

      db.run(schema.PENDING_MESSAGES_TABLE);
      db.run(schema.PENDING_MESSAGES_INDEXES);

      logger.info('Created initial schema tables');
    },
    down: (db: Database) => {
      db.run('DROP TABLE IF EXISTS pending_messages');
      db.run('DROP TABLE IF EXISTS task_queue');
      db.run('DROP TABLE IF EXISTS user_prompts');
      db.run('DROP TABLE IF EXISTS summaries');
      db.run('DROP TABLE IF EXISTS observations');
      db.run('DROP TABLE IF EXISTS sdk_sessions');
    },
  },
  {
    version: 2,
    name: 'observations_fts',
    up: (db: Database) => {
      db.run(schema.OBSERVATIONS_FTS);
      db.run(schema.OBSERVATIONS_FTS_TRIGGERS);

      // Populate FTS index with existing data
      db.run(`
        INSERT INTO observations_fts(rowid, title, text, concept)
        SELECT id, title, text, concept FROM observations
      `);

      logger.info('Created observations FTS index');
    },
    down: (db: Database) => {
      db.run('DROP TRIGGER IF EXISTS observations_au');
      db.run('DROP TRIGGER IF EXISTS observations_ad');
      db.run('DROP TRIGGER IF EXISTS observations_ai');
      db.run('DROP TABLE IF EXISTS observations_fts');
    },
  },
  {
    version: 3,
    name: 'project_claudemd',
    up: (db: Database) => {
      db.run(schema.PROJECT_CLAUDEMD_TABLE);
      db.run(schema.PROJECT_CLAUDEMD_INDEXES);

      logger.info('Created project_claudemd table');
    },
    down: (db: Database) => {
      db.run('DROP TABLE IF EXISTS project_claudemd');
    },
  },
];

/**
 * Migration Runner class
 */
export class MigrationRunner {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
    this.ensureSchemaVersionsTable();
  }

  /**
   * Ensure schema_versions table exists
   */
  private ensureSchemaVersionsTable(): void {
    this.db.run(schema.SCHEMA_VERSIONS_TABLE);
  }

  /**
   * Get current schema version
   */
  getCurrentVersion(): number {
    const result = this.db
      .query<{ version: number }, []>('SELECT MAX(version) as version FROM schema_versions')
      .get();
    return result?.version || 0;
  }

  /**
   * Get all applied versions
   */
  getAppliedVersions(): number[] {
    const results = this.db
      .query<{ version: number }, []>('SELECT version FROM schema_versions ORDER BY version')
      .all();
    return results.map(r => r.version);
  }

  /**
   * Run all pending migrations
   */
  runAllMigrations(): void {
    const appliedVersions = this.getAppliedVersions();
    const maxApplied = appliedVersions.length > 0 ? Math.max(...appliedVersions) : 0;

    for (const migration of migrations) {
      if (migration.version > maxApplied) {
        this.runMigration(migration);
      }
    }
  }

  /**
   * Run a single migration
   */
  private runMigration(migration: Migration): void {
    logger.info(`Applying migration ${migration.version}: ${migration.name}`);

    const transaction = this.db.transaction(() => {
      // Run the migration
      migration.up(this.db);

      // Record the migration
      this.db
        .query('INSERT INTO schema_versions (version, name, applied_at) VALUES (?, ?, ?)')
        .run(migration.version, migration.name, new Date().toISOString());
    });

    transaction();
    logger.info(`Migration ${migration.version} applied successfully`);
  }

  /**
   * Rollback to a specific version
   */
  rollbackTo(targetVersion: number): void {
    const appliedVersions = this.getAppliedVersions().sort((a, b) => b - a);

    for (const version of appliedVersions) {
      if (version > targetVersion) {
        const migration = migrations.find(m => m.version === version);
        if (migration?.down) {
          logger.info(`Rolling back migration ${version}: ${migration.name}`);

          const transaction = this.db.transaction(() => {
            migration.down!(this.db);
            this.db
              .query('DELETE FROM schema_versions WHERE version = ?')
              .run(version);
          });

          transaction();
          logger.info(`Migration ${version} rolled back successfully`);
        } else {
          throw new Error(`Migration ${version} has no down() function`);
        }
      }
    }
  }
}

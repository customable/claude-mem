/**
 * MikroORM Database Initializer
 *
 * Handles database initialization, migrations, and connection management.
 */

import { MikroORM } from '@mikro-orm/core';
import type { SqlEntityManager } from '@mikro-orm/knex';
import { createLogger } from '@claude-mem/shared';
import { createMikroOrmConfig, type DatabaseOptions } from '../mikro-orm.config.js';
import { MikroOrmUnitOfWork } from './unit-of-work.js';

const logger = createLogger('mikro-orm');

/**
 * MikroORM Database Connection wrapper
 */
export class MikroOrmDatabase {
  private orm: MikroORM | null = null;
  private _unitOfWork: MikroOrmUnitOfWork | null = null;

  constructor(private readonly options: DatabaseOptions) {}

  /**
   * Initialize the database connection and run migrations
   */
  async initialize(): Promise<void> {
    logger.info(`Initializing MikroORM with ${this.options.type} database`);

    const config = createMikroOrmConfig(this.options);
    // Use type assertion since we know the config is valid for any driver
    this.orm = await MikroORM.init(config as Parameters<typeof MikroORM.init>[0]);

    // Run pending migrations
    const migrator = this.orm.migrator;
    const pendingMigrations = await migrator.getPendingMigrations();

    if (pendingMigrations.length > 0) {
      logger.info(`Running ${pendingMigrations.length} pending migrations...`);
      await migrator.up();
      logger.info('Migrations completed');
    } else {
      logger.debug('No pending migrations');
    }

    // Create UnitOfWork
    this._unitOfWork = new MikroOrmUnitOfWork(
      this.orm.em.fork() as SqlEntityManager
    );

    logger.info('MikroORM initialized successfully');
  }

  /**
   * Get the UnitOfWork instance
   */
  get unitOfWork(): MikroOrmUnitOfWork {
    if (!this._unitOfWork) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this._unitOfWork;
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.orm) {
      await this.orm.close();
      this.orm = null;
      this._unitOfWork = null;
      logger.info('MikroORM connection closed');
    }
  }
}

/**
 * Create and initialize a MikroORM database connection
 */
export async function createMikroOrmDatabase(
  options: DatabaseOptions
): Promise<MikroOrmDatabase> {
  const db = new MikroOrmDatabase(options);
  await db.initialize();
  return db;
}

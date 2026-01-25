/**
 * MikroORM Database Layer Exports
 */

export { createMikroOrmConfig, type DatabaseOptions, entities, migrationsList } from '../mikro-orm.config.js';
export { MikroOrmUnitOfWork } from './unit-of-work.js';
export { MikroOrmDatabase, createMikroOrmDatabase } from './initializer.js';

// Re-export EntityManager type for services
export type { SqlEntityManager } from '@mikro-orm/knex';

// Repository exports
export {
  MikroOrmSessionRepository,
  MikroOrmObservationRepository,
  MikroOrmSummaryRepository,
  MikroOrmDocumentRepository,
  MikroOrmUserPromptRepository,
  MikroOrmTaskRepository,
  MikroOrmClaudeMdRepository,
  type ClaudeMdRecord,
  type UpsertClaudeMdInput,
} from './repositories/index.js';

// Migration exports
export * from './migrations/index.js';

// Entity exports
export * from '../entities/index.js';

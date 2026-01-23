/**
 * MikroORM Database Layer Exports
 */

export { createMikroOrmConfig, type DatabaseOptions } from '../mikro-orm.config.js';
export { MikroOrmUnitOfWork } from './unit-of-work.js';

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

// Entity exports
export * from '../entities/index.js';

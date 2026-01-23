/**
 * MikroORM Migrations Index
 */

export { Migration20240101000001_InitialSchema } from './Migration20240101000001_InitialSchema.js';
export { Migration20240101000002_FTS5Indexes } from './Migration20240101000002_FTS5Indexes.js';
export { Migration20260123000003_SessionWorkingDirectory } from './Migration20260123000003_SessionWorkingDirectory.js';
export { Migration20260123000004_AddSessionRequestType } from './Migration20260123000004_AddSessionRequestType.js';
export { Migration20260123000005_CreateDocumentsTable } from './Migration20260123000005_CreateDocumentsTable.js';

/**
 * All migrations in order
 */
export const mikroOrmMigrations = [
  'Migration20240101000001_InitialSchema',
  'Migration20240101000002_FTS5Indexes',
  'Migration20260123000003_SessionWorkingDirectory',
  'Migration20260123000004_AddSessionRequestType',
  'Migration20260123000005_CreateDocumentsTable',
];

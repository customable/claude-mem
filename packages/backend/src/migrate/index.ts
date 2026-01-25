/**
 * Migration Module (Issue #198)
 *
 * Tools for migrating data from thedotmack/claude-mem to customable/claude-mem.
 */

export { mapLegacyType, isKnownLegacyType, getKnownLegacyTypes, LEGACY_TYPE_MAP, DEFAULT_TYPE } from './type-mapper.js';

export { createBackup, getBackupPath, type BackupResult } from './backup.js';

export {
  analyzeLegacyDatabase,
  formatAnalysisReport,
  type AnalysisResult,
  type TableAnalysis,
  type ColumnInfo,
  type TypeDistribution,
} from './analyzer.js';

export {
  importLegacyDatabase,
  formatImportReport,
  parseTargetDatabase,
  type ImportOptions,
  type ImportResult,
  type ImportStats,
  type ConflictStrategy,
  type TargetDatabase,
} from './importer.js';

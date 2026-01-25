/**
 * Backup Utility for Legacy Migration (Issue #198)
 *
 * Creates timestamped backups of SQLite databases before migration.
 */

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, basename, join } from 'node:path';
import { createLogger } from '@claude-mem/shared';

const logger = createLogger('migrate:backup');

export interface BackupResult {
  success: boolean;
  originalPath: string;
  backupPath?: string;
  error?: string;
}

/**
 * Create a timestamped backup of a SQLite database
 */
export function createBackup(dbPath: string): BackupResult {
  if (!existsSync(dbPath)) {
    return {
      success: false,
      originalPath: dbPath,
      error: `Database file not found: ${dbPath}`,
    };
  }

  try {
    const dir = dirname(dbPath);
    const name = basename(dbPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${name}.backup-${timestamp}`;
    const backupPath = join(dir, backupName);

    // Ensure directory exists
    mkdirSync(dir, { recursive: true });

    // Copy the database file
    copyFileSync(dbPath, backupPath);

    // Also backup WAL and SHM files if they exist
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;

    if (existsSync(walPath)) {
      copyFileSync(walPath, `${backupPath}-wal`);
    }
    if (existsSync(shmPath)) {
      copyFileSync(shmPath, `${backupPath}-shm`);
    }

    logger.info(`Backup created: ${backupPath}`);

    return {
      success: true,
      originalPath: dbPath,
      backupPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Backup failed: ${message}`);

    return {
      success: false,
      originalPath: dbPath,
      error: message,
    };
  }
}

/**
 * Generate a backup path without creating the backup
 */
export function getBackupPath(dbPath: string): string {
  const dir = dirname(dbPath);
  const name = basename(dbPath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return join(dir, `${name}.backup-${timestamp}`);
}

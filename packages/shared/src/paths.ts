/**
 * Path configuration for claude-mem
 *
 * All paths are configurable via environment variables for flexibility
 * in different deployment scenarios (local, Docker, etc.)
 */

import { join, basename } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { createLogger } from './logger.js';

const logger = createLogger('paths');

// ============================================
// Environment-based configuration
// ============================================

/**
 * Get configuration value from environment or default
 */
function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

// ============================================
// Base directories
// ============================================

/**
 * Claude-mem data directory
 * Default: ~/.claude-mem
 */
export const DATA_DIR = getEnvOrDefault(
  'CLAUDE_MEM_DATA_DIR',
  join(homedir(), '.claude-mem')
);

/**
 * Claude Code configuration directory
 * Default: ~/.claude
 */
export const CLAUDE_CONFIG_DIR = getEnvOrDefault(
  'CLAUDE_CONFIG_DIR',
  join(homedir(), '.claude')
);

// ============================================
// Data subdirectories
// ============================================

/** Archives directory */
export const ARCHIVES_DIR = join(DATA_DIR, 'archives');

/** Logs directory */
export const LOGS_DIR = join(DATA_DIR, 'logs');

/** Trash directory */
export const TRASH_DIR = join(DATA_DIR, 'trash');

/** Backups directory */
export const BACKUPS_DIR = join(DATA_DIR, 'backups');

/** Custom modes directory */
export const MODES_DIR = join(DATA_DIR, 'modes');

/** User settings file path */
export const USER_SETTINGS_PATH = join(DATA_DIR, 'settings.json');

/** SQLite database path */
export const DB_PATH = join(DATA_DIR, 'claude-mem.db');

/** Vector database directory (Chroma/Qdrant) */
export const VECTOR_DB_DIR = join(DATA_DIR, 'vector-db');

// ============================================
// Claude integration paths
// ============================================

/** Claude settings file */
export const CLAUDE_SETTINGS_PATH = join(CLAUDE_CONFIG_DIR, 'settings.json');

/** Claude commands directory */
export const CLAUDE_COMMANDS_DIR = join(CLAUDE_CONFIG_DIR, 'commands');

/** Claude CLAUDE.md file */
export const CLAUDE_MD_PATH = join(CLAUDE_CONFIG_DIR, 'CLAUDE.md');

/** Claude credentials file */
export const CLAUDE_CREDENTIALS_PATH = join(CLAUDE_CONFIG_DIR, '.credentials.json');

/** Plugin marketplace root */
export const PLUGINS_DIR = join(CLAUDE_CONFIG_DIR, 'plugins');

/** Customable marketplace directory */
export const MARKETPLACE_ROOT = join(PLUGINS_DIR, 'marketplaces', 'customable');

// ============================================
// Helper functions
// ============================================

/**
 * Get project-specific archive directory
 */
export function getProjectArchiveDir(projectName: string): string {
  return join(ARCHIVES_DIR, projectName);
}

/**
 * Ensure a directory exists
 */
export function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

/**
 * Ensure all data directories exist
 */
export function ensureAllDataDirs(): void {
  ensureDir(DATA_DIR);
  ensureDir(ARCHIVES_DIR);
  ensureDir(LOGS_DIR);
  ensureDir(TRASH_DIR);
  ensureDir(BACKUPS_DIR);
  ensureDir(MODES_DIR);
}

/**
 * Ensure modes directory exists
 */
export function ensureModesDir(): void {
  ensureDir(MODES_DIR);
}

/**
 * Ensure all Claude integration directories exist
 */
export function ensureAllClaudeDirs(): void {
  ensureDir(CLAUDE_CONFIG_DIR);
  ensureDir(CLAUDE_COMMANDS_DIR);
}

/**
 * Get current project name from git root or cwd
 */
export function getCurrentProjectName(): string {
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      windowsHide: true,
    }).trim();
    return basename(gitRoot);
  } catch {
    logger.debug('Git root detection failed, using cwd basename', {
      cwd: process.cwd(),
    });
    return basename(process.cwd());
  }
}

/**
 * Create a timestamped backup filename
 */
export function createBackupFilename(originalPath: string): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);

  return `${originalPath}.backup.${timestamp}`;
}

// ============================================
// Version management
// ============================================

let cachedVersion: string | null = null;

/**
 * Get the current package version
 * Searches multiple locations for version info
 */
export function getVersion(): string {
  if (cachedVersion) {
    return cachedVersion;
  }

  // In a monorepo, we might be in different locations
  // Try to find package.json in parent directories
  const searchPaths = [
    join(process.cwd(), 'package.json'),
    join(process.cwd(), '..', 'package.json'),
    join(process.cwd(), '..', '..', 'package.json'),
  ];

  for (const searchPath of searchPaths) {
    try {
      if (existsSync(searchPath)) {
        const content = JSON.parse(readFileSync(searchPath, 'utf-8'));
        if (content.version) {
          const version = content.version as string;
          cachedVersion = version;
          return version;
        }
      }
    } catch {
      // Continue to next path
    }
  }

  // Fallback to timestamp-based version for development
  cachedVersion = `0.0.0-dev.${Date.now()}`;
  return cachedVersion;
}

/**
 * Reset cached version (for testing)
 */
export function resetVersionCache(): void {
  cachedVersion = null;
}

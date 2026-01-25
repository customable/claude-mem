/**
 * Path configuration for claude-mem
 *
 * All paths are configurable via environment variables for flexibility
 * in different deployment scenarios (local, Docker, etc.)
 *
 * NOTE: Most path configuration is done via settings.ts.
 * This module provides base directory constants and utilities.
 */

import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';

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

/**
 * Logs directory (Issue #251)
 * Default: ~/.claude-mem/logs
 */
export const LOGS_DIR = getEnvOrDefault(
  'CLAUDE_MEM_LOGS_DIR',
  join(DATA_DIR, 'logs')
);

// ============================================
// Helper functions
// ============================================

/**
 * Ensure a directory exists
 */
export function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

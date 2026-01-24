/**
 * Shared constants for claude-mem
 */

/**
 * Version of claude-mem
 */
export const VERSION = '2.19.12';

/**
 * Hook timeouts in milliseconds
 */
export const HOOK_TIMEOUTS = {
  /** Standard HTTP timeout (5 min for slow systems) */
  DEFAULT: 300_000,
  /** Worker health check (30s for slow systems) */
  HEALTH_CHECK: 30_000,
  /** Quick health check for session start (3s - don't block Claude) */
  QUICK_CHECK: 3_000,
  /** Wait between worker startup retries */
  WORKER_STARTUP_WAIT: 1_000,
  /** Max retries for worker startup */
  WORKER_STARTUP_RETRIES: 300,
  /** Give files time to sync before restart */
  PRE_RESTART_SETTLE_DELAY: 2_000,
  /** PowerShell process enumeration timeout */
  POWERSHELL_COMMAND: 10_000,
  /** Platform-specific multiplier for Windows */
  WINDOWS_MULTIPLIER: 1.5,
} as const;

/**
 * Get adjusted timeout for the current platform
 */
export function getTimeout(baseTimeout: number): number {
  return process.platform === 'win32'
    ? Math.round(baseTimeout * HOOK_TIMEOUTS.WINDOWS_MULTIPLIER)
    : baseTimeout;
}

/**
 * Worker constants
 */
export const WORKER = {
  /** Heartbeat interval (30 seconds) */
  HEARTBEAT_INTERVAL: 30_000,
  /** Consider worker dead after missing N heartbeats */
  HEARTBEAT_MISSED_THRESHOLD: 3,
  /** Reconnect interval (5 seconds) */
  RECONNECT_INTERVAL: 5_000,
  /** Max reconnect attempts */
  MAX_RECONNECT_ATTEMPTS: 10,
} as const;

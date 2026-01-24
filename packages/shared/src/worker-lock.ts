/**
 * Worker Lock Manager
 *
 * File-based mutex to ensure only one in-process worker
 * can register at a time. Works on Windows/Linux/macOS.
 *
 * Uses exclusive file creation (O_EXCL) for atomic lock acquisition.
 * Stores PID in lock file for stale lock detection.
 */

import { openSync, closeSync, readFileSync, unlinkSync, constants, writeFileSync } from 'fs';
import { createLogger } from './logger.js';

const logger = createLogger('worker-lock');

/**
 * Worker lock interface
 */
export interface WorkerLock {
  /** Try to acquire the lock. Returns true if successful. */
  acquire(): Promise<boolean>;
  /** Release the lock if held. */
  release(): Promise<void>;
  /** Check if this instance holds the lock. */
  isHeld(): boolean;
  /** Get the lock file path. */
  getLockPath(): string;
}

/**
 * Check if a process is running by PID
 */
function isProcessRunning(pid: number): boolean {
  try {
    // Sending signal 0 checks if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read PID from lock file
 */
function readLockPid(lockPath: string): number | null {
  try {
    const content = readFileSync(lockPath, 'utf-8').trim();
    const pid = parseInt(content, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * Create a worker lock instance
 *
 * @param lockPath - Path to the lock file
 * @returns WorkerLock instance
 */
export function createWorkerLock(lockPath: string): WorkerLock {
  let held = false;

  return {
    async acquire(): Promise<boolean> {
      if (held) {
        logger.debug('Lock already held by this process');
        return true;
      }

      try {
        // Try to create file exclusively (O_CREAT | O_EXCL | O_WRONLY)
        const fd = openSync(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY);

        // Write our PID to the lock file
        const pid = process.pid.toString();
        writeFileSync(lockPath, pid, 'utf-8');
        closeSync(fd);

        held = true;
        logger.info(`Worker lock acquired (PID: ${process.pid})`);
        return true;
      } catch (error) {
        const err = error as NodeJS.ErrnoException;

        // File exists - check if stale
        if (err.code === 'EEXIST') {
          const existingPid = readLockPid(lockPath);

          if (existingPid === null) {
            // Can't read PID, try to remove stale lock
            logger.warn('Lock file exists but no valid PID, removing stale lock');
            try {
              unlinkSync(lockPath);
              // Retry acquisition
              return this.acquire();
            } catch {
              logger.warn('Failed to remove stale lock file');
              return false;
            }
          }

          // Check if process is still running
          if (!isProcessRunning(existingPid)) {
            logger.info(`Lock held by dead process ${existingPid}, removing stale lock`);
            try {
              unlinkSync(lockPath);
              // Retry acquisition
              return this.acquire();
            } catch {
              logger.warn('Failed to remove stale lock file');
              return false;
            }
          }

          // Lock is held by another running process
          logger.debug(`Lock held by process ${existingPid}`);
          return false;
        }

        // Other error (permission, etc.)
        logger.error('Failed to acquire lock:', { message: err.message });
        return false;
      }
    },

    async release(): Promise<void> {
      if (!held) {
        logger.debug('Lock not held, nothing to release');
        return;
      }

      try {
        unlinkSync(lockPath);
        held = false;
        logger.info('Worker lock released');
      } catch (error) {
        const err = error as Error;
        logger.warn('Failed to release lock:', { message: err.message });
        held = false; // Mark as not held even if delete fails
      }
    },

    isHeld(): boolean {
      return held;
    },

    getLockPath(): string {
      return lockPath;
    },
  };
}

/**
 * Default worker lock path
 */
export function getDefaultWorkerLockPath(dataDir: string): string {
  return `${dataDir}/worker.lock`;
}

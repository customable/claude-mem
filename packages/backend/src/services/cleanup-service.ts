/**
 * Cleanup Service
 *
 * Handles cleanup of stale sessions, orphaned processes, and other maintenance tasks.
 * Addresses issues #101 (process/memory leaks).
 */

import { createLogger, loadSettings } from '@claude-mem/shared';
import type { ISessionRepository, ITaskQueueRepository } from '@claude-mem/types';
import type { WorkerProcessManager } from './worker-process-manager.js';

const logger = createLogger('cleanup-service');

/**
 * Default stale session timeout: 4 hours
 * Sessions with no activity for this duration are marked as completed.
 */
const DEFAULT_STALE_TIMEOUT_MS = 4 * 60 * 60 * 1000;

/**
 * Default cleanup interval: 30 minutes
 */
const DEFAULT_CLEANUP_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Default task cleanup age: 24 hours
 * Completed/failed tasks older than this are removed.
 */
const DEFAULT_TASK_CLEANUP_AGE_MS = 24 * 60 * 60 * 1000;

export interface CleanupServiceDeps {
  sessions: ISessionRepository;
  taskQueue: ITaskQueueRepository;
  workerProcessManager?: WorkerProcessManager;
}

export interface CleanupResult {
  staleSessions: number;
  cleanedTasks: number;
  terminatedWorkers: number;
  timestamp: number;
}

export interface CleanupConfig {
  staleTimeoutMs?: number;
  taskCleanupAgeMs?: number;
  autoCleanupEnabled?: boolean;
  cleanupIntervalMs?: number;
}

export class CleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private config: Required<CleanupConfig>;

  constructor(
    private readonly deps: CleanupServiceDeps
  ) {
    const settings = loadSettings();
    this.config = {
      staleTimeoutMs: settings.CLEANUP_STALE_TIMEOUT_MS ?? DEFAULT_STALE_TIMEOUT_MS,
      taskCleanupAgeMs: settings.CLEANUP_TASK_AGE_MS ?? DEFAULT_TASK_CLEANUP_AGE_MS,
      autoCleanupEnabled: settings.CLEANUP_AUTO_ENABLED ?? true,
      cleanupIntervalMs: settings.CLEANUP_INTERVAL_MS ?? DEFAULT_CLEANUP_INTERVAL_MS,
    };
  }

  /**
   * Start automatic periodic cleanup
   */
  startAutoCleanup(): void {
    if (!this.config.autoCleanupEnabled) {
      logger.info('Auto cleanup disabled');
      return;
    }

    if (this.cleanupInterval) {
      logger.warn('Auto cleanup already running');
      return;
    }

    logger.info(`Starting auto cleanup every ${this.config.cleanupIntervalMs}ms`);

    // Run initial cleanup after 1 minute
    setTimeout(() => {
      this.runCleanup().catch((err) => {
        logger.error('Initial cleanup failed:', { message: (err as Error).message });
      });
    }, 60000);

    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanup().catch((err) => {
        logger.error('Periodic cleanup failed:', { message: (err as Error).message });
      });
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Auto cleanup stopped');
    }
  }

  /**
   * Run full cleanup (can be called manually via API)
   */
  async runCleanup(): Promise<CleanupResult> {
    const startTime = Date.now();
    logger.info('Running cleanup...');

    const result: CleanupResult = {
      staleSessions: 0,
      cleanedTasks: 0,
      terminatedWorkers: 0,
      timestamp: startTime,
    };

    // 1. Complete stale sessions
    try {
      result.staleSessions = await this.deps.sessions.completeStale(this.config.staleTimeoutMs);
      if (result.staleSessions > 0) {
        logger.info(`Completed ${result.staleSessions} stale sessions`);
      }
    } catch (err) {
      logger.error('Failed to complete stale sessions:', { message: (err as Error).message });
    }

    // 2. Cleanup old tasks
    try {
      result.cleanedTasks = await this.deps.taskQueue.cleanup(this.config.taskCleanupAgeMs);
      if (result.cleanedTasks > 0) {
        logger.info(`Cleaned up ${result.cleanedTasks} old tasks`);
      }
    } catch (err) {
      logger.error('Failed to cleanup old tasks:', { message: (err as Error).message });
    }

    // 3. Terminate crashed/stuck workers
    if (this.deps.workerProcessManager) {
      try {
        const workers = this.deps.workerProcessManager.getSpawnedWorkers();
        for (const worker of workers) {
          // Terminate workers that have been running for too long (2 hours)
          const workerAge = startTime - worker.spawnedAt;
          if (workerAge > 2 * 60 * 60 * 1000) {
            logger.info(`Terminating long-running worker ${worker.id} (age: ${Math.round(workerAge / 60000)}min)`);
            try {
              await this.deps.workerProcessManager.terminate(worker.id, false);
              result.terminatedWorkers++;
            } catch (err) {
              logger.warn(`Failed to terminate worker ${worker.id}:`, { message: (err as Error).message });
            }
          }
        }
      } catch (err) {
        logger.error('Failed to cleanup workers:', { message: (err as Error).message });
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`Cleanup completed in ${duration}ms: ${result.staleSessions} sessions, ${result.cleanedTasks} tasks, ${result.terminatedWorkers} workers`);

    return result;
  }

  /**
   * Get cleanup statistics
   */
  async getStats(): Promise<{
    activeSessions: number;
    pendingTasks: number;
    activeWorkers: number;
    config: CleanupConfig;
  }> {
    const [activeSessions, taskCounts] = await Promise.all([
      this.deps.sessions.count({ status: 'active' }),
      this.deps.taskQueue.countByStatus(),
    ]);

    const activeWorkers = this.deps.workerProcessManager?.getSpawnedCount() ?? 0;

    return {
      activeSessions,
      pendingTasks: taskCounts.pending ?? 0,
      activeWorkers,
      config: this.config,
    };
  }
}

/**
 * Factory function for dependency injection
 */
export function createCleanupService(deps: CleanupServiceDeps): CleanupService {
  return new CleanupService(deps);
}

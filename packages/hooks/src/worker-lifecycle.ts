/**
 * Worker Lifecycle Manager
 *
 * Manages the hook-to-worker transition for in-process workers.
 * Ensures proper mutex handling and graceful shutdown.
 *
 * When a hook process finishes its work, it can try to become
 * an in-process worker instead of exiting. This eliminates the
 * need to spawn separate worker processes.
 */

import { join } from 'path';
import {
  createLogger,
  loadSettings,
  createWorkerLock,
  getDefaultWorkerLockPath,
  type WorkerLock,
} from '@claude-mem/shared';
import { InProcessWorker, type InProcessWorkerOptions } from '@claude-mem/worker';
import { getBackendClient } from './client.js';

const logger = createLogger('worker-lifecycle');

/**
 * Worker lifecycle options
 */
export interface WorkerLifecycleOptions {
  /** Custom lock path (default: ~/.claude-mem/worker.lock) */
  lockPath?: string;
  /** Worker options to pass to InProcessWorker */
  workerOptions?: Partial<InProcessWorkerOptions>;
}

/**
 * Singleton instance
 */
let lifecycleManager: WorkerLifecycleManager | null = null;

/**
 * Worker Lifecycle Manager
 *
 * Coordinates the acquisition of the worker lock and
 * the transition from hook process to worker process.
 */
export class WorkerLifecycleManager {
  private lock: WorkerLock;
  private worker: InProcessWorker | null = null;
  private workerOptions: Partial<InProcessWorkerOptions>;

  constructor(options: WorkerLifecycleOptions = {}) {
    const settings = loadSettings();
    const lockPath = options.lockPath || getDefaultWorkerLockPath(settings.DATA_DIR);

    this.lock = createWorkerLock(lockPath);
    this.workerOptions = options.workerOptions || {};

    logger.debug(`Worker lock path: ${lockPath}`);
  }

  /**
   * Check if this process should try to become an in-process worker
   *
   * Conditions:
   * - WORKER_MODE is 'in-process' or 'hybrid'
   * - Backend is available
   */
  async shouldTryBecomeWorker(): Promise<boolean> {
    const settings = loadSettings();

    // Check worker mode
    if (settings.WORKER_MODE === 'spawn') {
      logger.debug('WORKER_MODE is spawn, not becoming worker');
      return false;
    }

    // Check if backend is available
    const client = getBackendClient();
    const ready = await client.isCoreReady();
    if (!ready) {
      logger.debug('Backend not ready, not becoming worker');
      return false;
    }

    return true;
  }

  /**
   * Try to acquire the worker lock
   *
   * Returns true if lock was acquired and this process should become a worker.
   */
  async tryAcquireLock(): Promise<boolean> {
    const acquired = await this.lock.acquire();

    if (acquired) {
      logger.info('Worker lock acquired, transitioning to worker mode');
    } else {
      logger.debug('Worker lock not acquired, another process is the worker');
    }

    return acquired;
  }

  /**
   * Run as an in-process worker until exit conditions are met
   *
   * This method blocks until the worker exits (idle timeout, max runtime, or disconnect).
   */
  async runAsWorker(): Promise<{ reason: string; taskCount: number; runtimeMs: number }> {
    if (!this.lock.isHeld()) {
      throw new Error('Cannot run as worker without holding the lock');
    }

    logger.info('Starting in-process worker...');

    this.worker = new InProcessWorker({
      ...this.workerOptions,
      onExit: (reason: string) => {
        logger.info(`Worker exiting: ${reason}`);
      },
    });

    try {
      return await this.worker.runUntilDone();
    } finally {
      await this.release();
    }
  }

  /**
   * Release the worker lock
   */
  async release(): Promise<void> {
    this.worker = null;
    await this.lock.release();
  }

  /**
   * Check if this instance holds the lock
   */
  isWorker(): boolean {
    return this.lock.isHeld();
  }
}

/**
 * Get the singleton worker lifecycle manager
 */
export function getWorkerLifecycleManager(options?: WorkerLifecycleOptions): WorkerLifecycleManager {
  if (!lifecycleManager) {
    lifecycleManager = new WorkerLifecycleManager(options);
  }
  return lifecycleManager;
}

/**
 * Try to transition to in-process worker mode
 *
 * This is the main entry point called from hooks after they complete their work.
 * If successful, this function will block until the worker exits.
 *
 * @returns true if transitioned to worker (and has now exited), false if not
 */
export async function maybeTransitionToWorker(): Promise<boolean> {
  const lifecycle = getWorkerLifecycleManager();

  // Check if we should try
  if (!(await lifecycle.shouldTryBecomeWorker())) {
    return false;
  }

  // Try to acquire the lock
  if (!(await lifecycle.tryAcquireLock())) {
    return false;
  }

  // We got the lock - become the worker
  // This blocks until the worker exits
  try {
    const result = await lifecycle.runAsWorker();
    logger.info(`Worker completed: ${result.taskCount} tasks in ${Math.round(result.runtimeMs / 1000)}s`);
    return true;
  } catch (error) {
    const err = error as Error;
    logger.error('Worker error:', { message: err.message });
    await lifecycle.release();
    return false;
  }
}

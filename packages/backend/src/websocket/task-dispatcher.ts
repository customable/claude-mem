/**
 * Task Dispatcher
 *
 * Matches pending tasks to available workers based on capabilities.
 * Handles task lifecycle: pending → assigned → processing → completed/failed
 */

import { createLogger } from '@claude-mem/shared';
import type { ITaskQueueRepository, Task, WorkerCapability } from '@claude-mem/types';
import type { WorkerHub } from './worker-hub.js';

const logger = createLogger('task-dispatcher');

export interface TaskDispatcherOptions {
  /** Interval to check for pending tasks (ms) */
  pollIntervalMs?: number;
  /** Max retries before marking task as failed */
  maxRetries?: number;
  /** Timeout for task completion (ms) */
  taskTimeoutMs?: number;
}

export class TaskDispatcher {
  private pollInterval: Timer | null = null;
  private isRunning = false;

  private readonly pollIntervalMs: number;
  private readonly maxRetries: number;
  private readonly taskTimeoutMs: number;

  constructor(
    private readonly hub: WorkerHub,
    private readonly taskQueue: ITaskQueueRepository,
    options: TaskDispatcherOptions = {}
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? 1000;
    this.maxRetries = options.maxRetries ?? 3;
    this.taskTimeoutMs = options.taskTimeoutMs ?? 300000; // 5 minutes

    // Wire up hub events
    this.hub.onTaskComplete = this.handleTaskComplete.bind(this);
    this.hub.onTaskError = this.handleTaskError.bind(this);
    this.hub.onWorkerConnected = this.handleWorkerConnected.bind(this);
    this.hub.onWorkerDisconnected = this.handleWorkerDisconnected.bind(this);
  }

  /**
   * Start the dispatcher
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.pollInterval = setInterval(() => {
      this.dispatchPendingTasks();
    }, this.pollIntervalMs);

    // Initial dispatch
    this.dispatchPendingTasks();

    logger.info('Task dispatcher started');
  }

  /**
   * Stop the dispatcher
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isRunning = false;
    logger.info('Task dispatcher stopped');
  }

  /**
   * Dispatch pending tasks to available workers
   */
  private async dispatchPendingTasks(): Promise<void> {
    if (!this.hub.hasWorkers()) return;

    try {
      // Get available workers' capabilities
      const workers = this.hub.getWorkers().filter(w => !w.currentTaskId);
      if (workers.length === 0) return;

      // Collect all capabilities
      const allCapabilities = new Set<WorkerCapability>();
      for (const worker of workers) {
        for (const cap of worker.capabilities) {
          allCapabilities.add(cap);
        }
      }

      // Find next pending task that matches available capabilities
      const task = await this.taskQueue.getNextPending(Array.from(allCapabilities));
      if (!task) return;

      // Find best worker for this task
      const worker = this.findBestWorker(task);
      if (!worker) return;

      // Assign the task
      const assigned = await this.taskQueue.assign(task.id, worker.id);
      if (!assigned) {
        logger.warn(`Failed to assign task ${task.id} in database`);
        return;
      }

      // Send to worker
      const success = this.hub.assignTask(
        worker.id,
        task.id,
        task.type,
        task.payload
      );

      if (!success) {
        // Worker became unavailable, reset task
        await this.taskQueue.updateStatus(task.id, 'pending');
        logger.warn(`Failed to send task ${task.id} to worker ${worker.id}`);
      } else {
        // Update status to processing
        await this.taskQueue.updateStatus(task.id, 'processing');
      }
    } catch (error) {
      const err = error as Error;
      logger.error('Error dispatching tasks:', { message: err.message, stack: err.stack });
    }
  }

  /**
   * Find the best worker for a task
   */
  private findBestWorker(task: Task) {
    // First, try to find worker with the required capability
    const primaryWorker = this.hub.findAvailableWorker(
      task.requiredCapability as WorkerCapability
    );
    if (primaryWorker) return primaryWorker;

    // If task has fallback capabilities, try those
    if (task.fallbackCapabilities?.length) {
      return this.hub.findAvailableWorkerForAny(
        task.fallbackCapabilities as WorkerCapability[]
      );
    }

    return null;
  }

  /**
   * Handle task completion from worker
   */
  private async handleTaskComplete(
    workerId: string,
    taskId: string,
    result: unknown
  ): Promise<void> {
    try {
      await this.taskQueue.updateStatus(taskId, 'completed', {
        result,
      } as Partial<Task>);
      logger.info(`Task ${taskId} completed by worker ${workerId}`);

      // Trigger another dispatch cycle
      this.dispatchPendingTasks();
    } catch (error) {
      const err = error as Error;
      logger.error(`Error completing task ${taskId}:`, { message: err.message });
    }
  }

  /**
   * Handle task error from worker
   */
  private async handleTaskError(
    workerId: string,
    taskId: string,
    error: string
  ): Promise<void> {
    try {
      const task = await this.taskQueue.findById(taskId);
      if (!task) {
        logger.warn(`Task ${taskId} not found for error handling`);
        return;
      }

      const newRetryCount = task.retryCount + 1;

      if (newRetryCount >= task.maxRetries) {
        // Max retries reached, mark as failed
        await this.taskQueue.updateStatus(taskId, 'failed', {
          error,
          retryCount: newRetryCount,
        });
        logger.error(`Task ${taskId} failed after ${newRetryCount} retries: ${error}`);
      } else {
        // Reset to pending for retry
        await this.taskQueue.updateStatus(taskId, 'pending', {
          error,
          retryCount: newRetryCount,
        });
        logger.warn(`Task ${taskId} failed (attempt ${newRetryCount}/${task.maxRetries}): ${error}`);
      }

      // Trigger another dispatch cycle
      this.dispatchPendingTasks();
    } catch (err) {
      const e = err as Error;
      logger.error(`Error handling task error for ${taskId}:`, { message: e.message });
    }
  }

  /**
   * Handle worker connection - dispatch any pending tasks
   */
  private handleWorkerConnected(): void {
    logger.debug('Worker connected, checking for pending tasks');
    this.dispatchPendingTasks();
  }

  /**
   * Handle worker disconnect - reassign their tasks
   */
  private async handleWorkerDisconnected(workerId: string): Promise<void> {
    try {
      // Find tasks assigned to this worker
      const tasks = await this.taskQueue.getByWorkerId(workerId);

      for (const task of tasks) {
        if (task.status === 'assigned' || task.status === 'processing') {
          // Reset to pending for reassignment
          await this.taskQueue.updateStatus(task.id, 'pending', {
            error: `Worker ${workerId} disconnected`,
          });
          logger.info(`Task ${task.id} reset to pending after worker disconnect`);
        }
      }

      // Trigger dispatch to reassign
      this.dispatchPendingTasks();
    } catch (error) {
      const err = error as Error;
      logger.error(`Error handling worker disconnect for ${workerId}:`, { message: err.message });
    }
  }

  /**
   * Check for timed-out tasks
   */
  async checkTimeouts(): Promise<void> {
    try {
      const tasks = await this.taskQueue.list(
        { status: ['assigned', 'processing'] },
        { limit: 100 }
      );

      const now = Date.now();
      for (const task of tasks) {
        if (task.assignedAt && now - task.assignedAt > this.taskTimeoutMs) {
          await this.taskQueue.updateStatus(task.id, 'timeout', {
            error: 'Task timed out',
          });
          logger.warn(`Task ${task.id} timed out`);
        }
      }
    } catch (error) {
      const err = error as Error;
      logger.error('Error checking task timeouts:', { message: err.message });
    }
  }
}

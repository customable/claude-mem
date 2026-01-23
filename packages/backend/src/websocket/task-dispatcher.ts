/**
 * Task Dispatcher
 *
 * Matches pending tasks to available workers based on capabilities.
 * Handles task lifecycle: pending → assigned → processing → completed/failed
 */

import { createLogger, getSettings } from '@claude-mem/shared';
import type { ITaskQueueRepository, IObservationRepository, ISessionRepository, ISummaryRepository, Task, WorkerCapability, ObservationTaskPayload, ObservationTask, SummarizeTaskPayload, SummarizeTask, ClaudeMdTaskPayload, ClaudeMdTask } from '@claude-mem/types';
import type { WorkerHub } from './worker-hub.js';
import type { SSEBroadcaster } from '../services/sse-broadcaster.js';
import type { TaskService } from '../services/task-service.js';
import type { SQLiteClaudeMdRepository } from '@claude-mem/database';

const logger = createLogger('task-dispatcher');

export interface TaskDispatcherOptions {
  /** Interval to check for pending tasks (ms) */
  pollIntervalMs?: number;
  /** Max retries before marking task as failed */
  maxRetries?: number;
  /** Timeout for task completion (ms) */
  taskTimeoutMs?: number;
  /** SSE broadcaster for real-time updates */
  sseBroadcaster?: SSEBroadcaster;
  /** Observation repository for storing results */
  observations?: IObservationRepository;
  /** Session repository for looking up memory session IDs */
  sessions?: ISessionRepository;
  /** Summary repository for storing summaries */
  summaries?: ISummaryRepository;
  /** Task service for queueing follow-up tasks */
  taskService?: TaskService;
  /** CLAUDE.md repository for storing generated content */
  claudemd?: SQLiteClaudeMdRepository;
}

export class TaskDispatcher {
  private pollInterval: Timer | null = null;
  private isRunning = false;

  private readonly pollIntervalMs: number;
  private readonly maxRetries: number;
  private readonly taskTimeoutMs: number;
  private readonly sseBroadcaster?: SSEBroadcaster;
  private readonly observations?: IObservationRepository;
  private readonly sessions?: ISessionRepository;
  private readonly summaries?: ISummaryRepository;
  private readonly taskService?: TaskService;
  private readonly claudemd?: SQLiteClaudeMdRepository;

  constructor(
    private readonly hub: WorkerHub,
    private readonly taskQueue: ITaskQueueRepository,
    options: TaskDispatcherOptions = {}
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? 1000;
    this.maxRetries = options.maxRetries ?? 3;
    this.taskTimeoutMs = options.taskTimeoutMs ?? 300000; // 5 minutes
    this.sseBroadcaster = options.sseBroadcaster;
    this.observations = options.observations;
    this.sessions = options.sessions;
    this.summaries = options.summaries;
    this.taskService = options.taskService;
    this.claudemd = options.claudemd;

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

        // Broadcast assignment event
        this.sseBroadcaster?.broadcastTaskAssigned(task.id, worker.id, task.type);
        logger.debug(`Task ${task.id} (${task.type}) assigned to worker ${worker.id}`);
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
      // Get the task first to know its type
      const task = await this.taskQueue.findById(taskId);

      await this.taskQueue.updateStatus(taskId, 'completed', {
        result,
      } as Partial<Task>);
      logger.info(`Task ${taskId} completed by worker ${workerId}`);

      // Broadcast completion event
      this.sseBroadcaster?.broadcastTaskCompleted(taskId);

      // Handle observation task: store result in database
      if (task?.type === 'observation' && this.observations && this.sessions) {
        const observationResult = result as ObservationTask['result'];
        const payload = task.payload as ObservationTaskPayload;

        if (observationResult?.title && observationResult?.text) {
          // Look up memory session ID from content session ID
          const session = await this.sessions.findByContentSessionId(payload.sessionId);
          const memorySessionId = session?.memory_session_id || payload.sessionId;

          // Store observation in database
          const observation = await this.observations.create({
            memorySessionId,
            project: payload.project,
            type: observationResult.type || 'discovery',
            title: observationResult.title,
            text: observationResult.text,
            discoveryTokens: observationResult.tokens || 0,
            promptNumber: payload.promptNumber,
          });

          logger.info(`Observation ${observation.id} created for session ${payload.sessionId}`);

          // Broadcast observation created event
          this.sseBroadcaster?.broadcastObservationCreated(
            observation.id,
            payload.sessionId
          );
        } else {
          logger.debug(`No observation content for task ${taskId}`);
        }
      }

      // Handle summarize task: store result in database
      if (task?.type === 'summarize' && this.summaries && this.sessions) {
        const summaryResult = result as SummarizeTask['result'];
        const payload = task.payload as SummarizeTaskPayload;

        if (summaryResult?.request) {
          // Look up memory session ID from content session ID
          const session = await this.sessions.findByContentSessionId(payload.sessionId);
          const memorySessionId = session?.memory_session_id || payload.sessionId;

          // Store summary in database
          const summary = await this.summaries.create({
            memorySessionId,
            project: payload.project,
            request: summaryResult.request,
            investigated: summaryResult.investigated,
            learned: summaryResult.learned,
            completed: summaryResult.completed,
            nextSteps: summaryResult.nextSteps,
            discoveryTokens: summaryResult.tokens || 0,
          });

          logger.info(`Summary ${summary.id} created for session ${payload.sessionId}`);

          // Queue CLAUDE.md generation if enabled
          const settings = getSettings();
          if (settings.get('CLAUDEMD_ENABLED') && this.taskService && session) {
            try {
              // Note: working_directory comes from session metadata or is empty
              // The SSE writer uses this to validate the target directory
              const workingDirectory = (session as { working_directory?: string }).working_directory;
              await this.taskService.queueClaudeMd({
                contentSessionId: payload.sessionId,
                memorySessionId,
                project: payload.project,
                workingDirectory: workingDirectory || undefined,
              });
              logger.debug(`Queued claude-md task for session ${payload.sessionId}`);
            } catch (err) {
              const e = err as Error;
              logger.warn(`Failed to queue claude-md task: ${e.message}`);
            }
          }
        } else {
          logger.debug(`No summary content for task ${taskId}`);
        }
      }

      // Handle claude-md task: store result in database and emit SSE event
      if (task?.type === 'claude-md' && this.claudemd) {
        const claudeMdResult = result as ClaudeMdTask['result'];
        const payload = task.payload as ClaudeMdTaskPayload;

        if (claudeMdResult?.content) {
          // Store in database
          await this.claudemd.upsert({
            project: payload.project,
            content: claudeMdResult.content,
            contentSessionId: payload.contentSessionId,
            memorySessionId: payload.memorySessionId,
            workingDirectory: payload.workingDirectory,
            tokens: claudeMdResult.tokens || 0,
          });

          logger.info(`CLAUDE.md content stored for project ${payload.project}`);

          // Emit SSE event for local SSE writer to pick up
          this.sseBroadcaster?.broadcastClaudeMdReady({
            project: payload.project,
            contentSessionId: payload.contentSessionId,
            workingDirectory: payload.workingDirectory || '',
            content: claudeMdResult.content,
          });
        } else {
          logger.debug(`No claude-md content for task ${taskId}`);
        }
      }

      // Trigger another dispatch cycle
      await this.dispatchPendingTasks();
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

        // Broadcast failure event
        this.sseBroadcaster?.broadcast({
          type: 'task:failed',
          data: { taskId, error, retries: newRetryCount },
        });
      } else {
        // Reset to pending for retry
        await this.taskQueue.updateStatus(taskId, 'pending', {
          error,
          retryCount: newRetryCount,
        });
        logger.warn(`Task ${taskId} failed (attempt ${newRetryCount}/${task.maxRetries}): ${error}`);
      }

      // Trigger another dispatch cycle
      await this.dispatchPendingTasks();
    } catch (err) {
      const e = err as Error;
      logger.error(`Error handling task error for ${taskId}:`, { message: e.message });
    }
  }

  /**
   * Handle worker connection - dispatch any pending tasks
   */
  private handleWorkerConnected(worker: { id: string; capabilities: string[] }): void {
    logger.debug('Worker connected, checking for pending tasks');
    // Broadcast SSE event
    this.sseBroadcaster?.broadcastWorkerConnected(worker.id, worker.capabilities);
    this.dispatchPendingTasks();
  }

  /**
   * Handle worker disconnect - reassign their tasks
   */
  private async handleWorkerDisconnected(workerId: string): Promise<void> {
    // Broadcast SSE event
    this.sseBroadcaster?.broadcastWorkerDisconnected(workerId);

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
      await this.dispatchPendingTasks();
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

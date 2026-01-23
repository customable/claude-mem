/**
 * Task Service
 *
 * Business logic for task management.
 * Creates tasks and manages the task queue.
 */

import { createLogger } from '@claude-mem/shared';
import type {
  ITaskQueueRepository,
  Task,
  TaskType,
  TaskStatus,
  ObservationTask,
  SummarizeTask,
  EmbeddingTask,
  ContextGenerateTask,
  WorkerCapability,
} from '@claude-mem/types';
import type { SSEBroadcaster } from './sse-broadcaster.js';

const logger = createLogger('task-service');

export interface TaskServiceOptions {
  defaultMaxRetries?: number;
  defaultPriority?: number;
}

export class TaskService {
  private readonly defaultMaxRetries: number;
  private readonly defaultPriority: number;

  constructor(
    private readonly taskQueue: ITaskQueueRepository,
    private readonly sseBroadcaster: SSEBroadcaster,
    options: TaskServiceOptions = {}
  ) {
    this.defaultMaxRetries = options.defaultMaxRetries ?? 3;
    this.defaultPriority = options.defaultPriority ?? 50;
  }

  /**
   * Queue an observation task
   */
  async queueObservation(params: {
    sessionId: string;
    project: string;
    toolName: string;
    toolInput: string;
    toolOutput: string;
    promptNumber?: number;
    preferredProvider?: string;
  }): Promise<ObservationTask> {
    const capability = this.resolveCapability('observation', params.preferredProvider);
    const fallbacks = this.getFallbackCapabilities('observation', capability);

    const task = await this.taskQueue.create<ObservationTask>({
      type: 'observation',
      requiredCapability: capability,
      fallbackCapabilities: fallbacks,
      priority: this.defaultPriority,
      maxRetries: this.defaultMaxRetries,
      payload: {
        sessionId: params.sessionId,
        project: params.project,
        toolName: params.toolName,
        toolInput: params.toolInput,
        toolOutput: params.toolOutput,
        promptNumber: params.promptNumber,
      },
    });

    this.sseBroadcaster.broadcastTaskQueued(task.id, 'observation');
    logger.info(`Queued observation task ${task.id} for session ${params.sessionId}`);

    return task;
  }

  /**
   * Queue a summarization task
   */
  async queueSummarize(params: {
    sessionId: string;
    project: string;
    preferredProvider?: string;
  }): Promise<SummarizeTask> {
    const capability = this.resolveCapability('summarize', params.preferredProvider);
    const fallbacks = this.getFallbackCapabilities('summarize', capability);

    const task = await this.taskQueue.create<SummarizeTask>({
      type: 'summarize',
      requiredCapability: capability,
      fallbackCapabilities: fallbacks,
      priority: this.defaultPriority - 10, // Slightly lower priority than observations
      maxRetries: this.defaultMaxRetries,
      payload: {
        sessionId: params.sessionId,
        project: params.project,
      },
    });

    this.sseBroadcaster.broadcastTaskQueued(task.id, 'summarize');
    logger.info(`Queued summarize task ${task.id} for session ${params.sessionId}`);

    return task;
  }

  /**
   * Queue an embedding task
   */
  async queueEmbedding(params: {
    observationIds: number[];
    preferredProvider?: string;
  }): Promise<EmbeddingTask> {
    const capability = this.resolveCapability('embedding', params.preferredProvider);
    const fallbacks = this.getFallbackCapabilities('embedding', capability);

    const task = await this.taskQueue.create<EmbeddingTask>({
      type: 'embedding',
      requiredCapability: capability,
      fallbackCapabilities: fallbacks,
      priority: this.defaultPriority - 20, // Lower priority
      maxRetries: this.defaultMaxRetries,
      payload: {
        observationIds: params.observationIds,
      },
    });

    this.sseBroadcaster.broadcastTaskQueued(task.id, 'embedding');
    logger.info(`Queued embedding task ${task.id} for ${params.observationIds.length} observations`);

    return task;
  }

  /**
   * Queue a context generation task
   */
  async queueContextGenerate(params: {
    project: string;
    query?: string;
  }): Promise<ContextGenerateTask> {
    const task = await this.taskQueue.create<ContextGenerateTask>({
      type: 'context-generate',
      requiredCapability: 'context:generate',
      priority: this.defaultPriority + 10, // Higher priority for context
      maxRetries: this.defaultMaxRetries,
      payload: {
        project: params.project,
        query: params.query,
      },
    });

    this.sseBroadcaster.broadcastTaskQueued(task.id, 'context:generate');
    logger.info(`Queued context generate task ${task.id} for project ${params.project}`);

    return task;
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    return this.taskQueue.findById(taskId);
  }

  /**
   * Get task queue status
   */
  async getQueueStatus(): Promise<Record<TaskStatus, number>> {
    return this.taskQueue.countByStatus();
  }

  /**
   * List tasks with filters
   */
  async listTasks(options: {
    status?: TaskStatus | TaskStatus[];
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<Task[]> {
    return this.taskQueue.list(
      {
        status: options.status,
        type: options.type as TaskType | undefined,
      },
      {
        limit: options.limit ?? 50,
        offset: options.offset,
      }
    );
  }

  /**
   * Cleanup old completed/failed tasks
   */
  async cleanup(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const deleted = await this.taskQueue.cleanup(olderThanMs);
    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} old tasks`);
    }
    return deleted;
  }

  /**
   * Resolve capability based on task type and provider preference
   */
  private resolveCapability(
    taskType: 'observation' | 'summarize' | 'embedding',
    preferredProvider?: string
  ): WorkerCapability {
    if (preferredProvider) {
      return `${taskType}:${preferredProvider}` as WorkerCapability;
    }

    // Default providers
    const defaults: Record<string, WorkerCapability> = {
      observation: 'observation:mistral',
      summarize: 'summarize:mistral',
      embedding: 'embedding:local',
    };

    return defaults[taskType];
  }

  /**
   * Get fallback capabilities for a task type
   */
  private getFallbackCapabilities(
    taskType: 'observation' | 'summarize' | 'embedding',
    primary: WorkerCapability
  ): WorkerCapability[] {
    const allProviders: Record<string, WorkerCapability[]> = {
      observation: [
        'observation:mistral',
        'observation:gemini',
        'observation:openrouter',
        'observation:openai',
        'observation:sdk',
      ],
      summarize: [
        'summarize:mistral',
        'summarize:gemini',
        'summarize:openrouter',
        'summarize:openai',
        'summarize:sdk',
      ],
      embedding: [
        'embedding:local',
        'embedding:openai',
        'embedding:voyage',
      ],
    };

    // Return all providers except the primary one
    return allProviders[taskType].filter(cap => cap !== primary);
  }
}

/**
 * Task Service
 *
 * Business logic for task management.
 * Creates tasks and manages the task queue.
 */

import { createLogger } from '@claude-mem/shared';
import type {
  ITaskQueueRepository,
  IObservationRepository,
  ISessionRepository,
  ISummaryRepository,
  Task,
  TaskType,
  TaskStatus,
  ObservationTask,
  SummarizeTask,
  EmbeddingTask,
  ContextGenerateTask,
  ClaudeMdTask,
  WorkerCapability,
  ObservationRecord,
  SessionSummaryRecord,
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
    private readonly observations?: IObservationRepository,
    private readonly sessions?: ISessionRepository,
    private readonly summaries?: ISummaryRepository,
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
    gitBranch?: string;
    cwd?: string;
    targetDirectory?: string;
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
        gitBranch: params.gitBranch,
        cwd: params.cwd,
        targetDirectory: params.targetDirectory,
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

    // Get session info for user prompt
    let userPrompt: string | undefined;
    if (this.sessions) {
      const session = await this.sessions.findByContentSessionId(params.sessionId);
      userPrompt = session?.user_prompt || undefined;
    }

    // Get observations for this session
    let observations: { id: number; type: string; title: string; text: string }[] = [];
    if (this.observations) {
      const sessionObs = await this.observations.getBySessionId(params.sessionId, { limit: 100 });
      observations = sessionObs.map(o => ({
        id: o.id,
        type: o.type,
        title: o.title || '',
        text: o.text || '',
      }));
    }

    const task = await this.taskQueue.create<SummarizeTask>({
      type: 'summarize',
      requiredCapability: capability,
      fallbackCapabilities: fallbacks,
      priority: this.defaultPriority - 10, // Slightly lower priority than observations
      maxRetries: this.defaultMaxRetries,
      payload: {
        sessionId: params.sessionId,
        project: params.project,
        userPrompt,
        observations,
      },
    });

    this.sseBroadcaster.broadcastTaskQueued(task.id, 'summarize');
    logger.info(`Queued summarize task ${task.id} for session ${params.sessionId} with ${observations.length} observations`);

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
    limit?: number;
  }): Promise<ContextGenerateTask> {
    // Load recent observations for the project
    let observations: Array<{
      title: string;
      text: string;
      type: string;
      createdAt: number;
    }> = [];

    if (this.observations) {
      const limit = params.limit ?? 50;
      const recentObs = await this.observations.list(
        { project: params.project },
        { limit, orderBy: 'created_at_epoch', order: 'desc' }
      );
      observations = recentObs.map((o: ObservationRecord) => ({
        title: o.title || 'Untitled',
        text: o.text || '',
        type: o.type as string,
        createdAt: typeof o.created_at === 'string' ? new Date(o.created_at).getTime() : o.created_at,
      }));
    }

    const task = await this.taskQueue.create<ContextGenerateTask>({
      type: 'context-generate',
      requiredCapability: 'context:generate',
      priority: this.defaultPriority + 10, // Higher priority for context
      maxRetries: this.defaultMaxRetries,
      payload: {
        project: params.project,
        query: params.query,
        observations,
      },
    });

    this.sseBroadcaster.broadcastTaskQueued(task.id, 'context:generate');
    logger.info(`Queued context generate task ${task.id} for project ${params.project} with ${observations.length} observations`);

    return task;
  }

  /**
   * Queue a CLAUDE.md generation task
   * @param params.targetDirectory If specified, filter observations to this subdirectory
   */
  async queueClaudeMd(params: {
    contentSessionId: string;
    memorySessionId: string;
    project: string;
    workingDirectory?: string;
    targetDirectory?: string;
  }): Promise<ClaudeMdTask> {
    // Load recent observations for the project
    // If targetDirectory is specified, filter to observations from that directory
    let observations: Array<{
      id: number;
      title: string;
      text: string;
      type: string;
      createdAt: number;
      tokens?: number;
    }> = [];

    if (this.observations) {
      const filters: { project: string; cwdPrefix?: string } = { project: params.project };

      // If targetDirectory specified, only include observations from that directory
      if (params.targetDirectory) {
        filters.cwdPrefix = params.targetDirectory;
      }

      const recentObs = await this.observations.list(
        filters,
        { limit: 30, orderBy: 'created_at_epoch', order: 'desc' }
      );
      observations = recentObs.map((o: ObservationRecord) => ({
        id: o.id,
        title: o.title || 'Untitled',
        text: o.text || '',
        type: o.type as string,
        createdAt: typeof o.created_at === 'string' ? new Date(o.created_at).getTime() : o.created_at,
        tokens: o.discovery_tokens || undefined,
      }));
    }

    // Load recent summaries for context
    let summaries: Array<{
      request?: string;
      investigated?: string;
      learned?: string;
      completed?: string;
      nextSteps?: string;
      createdAt: number;
    }> = [];

    if (this.summaries) {
      const recentSummaries = await this.summaries.list(
        { project: params.project },
        { limit: 5, orderBy: 'created_at_epoch', order: 'desc' }
      );
      summaries = recentSummaries.map((s: SessionSummaryRecord) => ({
        request: s.request || undefined,
        investigated: s.investigated || undefined,
        learned: s.learned || undefined,
        completed: s.completed || undefined,
        nextSteps: s.next_steps || undefined,
        createdAt: s.created_at_epoch,
      }));
    }

    // Use targetDirectory for the output path, fallback to workingDirectory
    const outputDirectory = params.targetDirectory || params.workingDirectory || '';

    const task = await this.taskQueue.create<ClaudeMdTask>({
      type: 'claude-md',
      requiredCapability: 'claudemd:generate',
      priority: this.defaultPriority - 20, // Lower priority than observations/summaries
      maxRetries: this.defaultMaxRetries,
      payload: {
        contentSessionId: params.contentSessionId,
        memorySessionId: params.memorySessionId,
        project: params.project,
        workingDirectory: outputDirectory,
        targetDirectory: params.targetDirectory,
        // Include data for the worker
        observations,
        summaries,
      } as ClaudeMdTask['payload'] & { observations: typeof observations; summaries: typeof summaries },
    });

    this.sseBroadcaster.broadcastTaskQueued(task.id, 'claude-md');
    const targetInfo = params.targetDirectory ? ` (target: ${params.targetDirectory})` : '';
    logger.info(`Queued claude-md task ${task.id} for project ${params.project}${targetInfo}`);

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

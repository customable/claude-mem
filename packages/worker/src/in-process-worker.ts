/**
 * In-Process Worker
 *
 * A lightweight worker that runs within the hook process.
 * Designed for the hook-to-worker lifecycle transition.
 *
 * Key differences from spawned WorkerService:
 * - No auto-reconnection (exits on disconnect)
 * - Idle timeout (exits after period of no tasks)
 * - Max runtime timeout (safety limit)
 * - Designed to block until exit conditions are met
 */

import { createLogger, loadSettings, VERSION } from '@claude-mem/shared';
import type {
  WorkerCapability,
  TaskType,
  QdrantSyncTaskPayload,
  SummarizeTaskPayload,
  EmbeddingTaskPayload,
  ClaudeMdTaskPayload,
  CompressionTaskPayload,
} from '@claude-mem/types';
import { WebSocketClient } from './connection/websocket-client.js';
import { getDefaultAgent, type Agent } from './agents/index.js';
import { handleObservationTask } from './handlers/observation-handler.js';
import { handleSummarizeTask } from './handlers/summarize-handler.js';
import { handleEmbeddingTask } from './handlers/embedding-handler.js';
import { handleContextTask } from './handlers/context-handler.js';
import { handleQdrantSyncTask } from './handlers/qdrant-handler.js';
import { handleClaudeMdTask } from './handlers/claudemd-handler.js';
import { handleCompressionTask } from './handlers/compression-handler.js';
import { getQdrantService } from './services/qdrant-service.js';

const logger = createLogger('in-process-worker');

/**
 * In-process worker options
 */
export interface InProcessWorkerOptions {
  /** Backend WebSocket URL */
  backendUrl?: string;
  /** Authentication token */
  authToken?: string;
  /** Capabilities to register */
  capabilities?: WorkerCapability[];
  /** Idle timeout in seconds (exit after no tasks for this duration) */
  idleTimeoutSec?: number;
  /** Max runtime in minutes (safety limit) */
  maxRuntimeMin?: number;
  /** Callback when worker is about to exit */
  onExit?: (reason: string) => void;
}

/**
 * In-Process Worker
 *
 * Runs within the calling process and blocks until exit conditions are met.
 */
export class InProcessWorker {
  private client: WebSocketClient;
  private readonly agent: Agent;
  private currentTaskId: string | null = null;
  private currentAbortController: AbortController | null = null;

  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private maxRuntimeTimer: ReturnType<typeof setTimeout> | null = null;
  private startTime = 0;
  private taskCount = 0;
  private exitReason: string | null = null;
  private exitResolve: (() => void) | null = null;

  private readonly idleTimeoutMs: number;
  private readonly maxRuntimeMs: number;
  private readonly onExit?: (reason: string) => void;

  constructor(options: InProcessWorkerOptions = {}) {
    const settings = loadSettings();

    this.idleTimeoutMs = (options.idleTimeoutSec ?? settings.IN_PROCESS_WORKER_IDLE_EXIT) * 1000;
    this.maxRuntimeMs = (options.maxRuntimeMin ?? settings.IN_PROCESS_WORKER_TIMEOUT) * 60 * 1000;
    this.onExit = options.onExit;

    // Initialize agent first (needed for detectCapabilities)
    this.agent = getDefaultAgent();

    // Determine capabilities using priority chain (Issue #265)
    const capabilities = this.resolveCapabilities(options, settings);

    // Build metadata
    const metadata: Record<string, unknown> = {
      version: VERSION,
      hostname: process.env.HOSTNAME || 'unknown',
      agent: this.agent.name,
      mode: 'in-process', // Identify as in-process worker
    };

    // Initialize WebSocket client with NO reconnection
    this.client = new WebSocketClient({
      backendUrl: options.backendUrl,
      authToken: options.authToken || settings.WORKER_AUTH_TOKEN,
      capabilities,
      metadata,
      maxReconnectAttempts: 0, // No reconnection for in-process worker
    });

    // Setup event handlers
    this.client.on({
      onConnected: this.handleConnected.bind(this),
      onDisconnected: this.handleDisconnected.bind(this),
      onTaskAssigned: this.handleTaskAssigned.bind(this),
      onTaskCancelled: this.handleTaskCancelled.bind(this),
      onError: this.handleError.bind(this),
    });
  }

  /**
   * Resolve capabilities using priority chain (Issue #265)
   *
   * Priority (highest first):
   * 1. Options argument (options.capabilities)
   * 2. Environment variable (WORKER_CAPABILITIES)
   * 3. Profile from settings (WORKER_PROFILE env var)
   * 4. Auto-detection (fallback)
   */
  private resolveCapabilities(
    options: InProcessWorkerOptions,
    settings: ReturnType<typeof loadSettings>
  ): WorkerCapability[] {
    // 1. Options argument (highest priority)
    if (options.capabilities?.length) {
      logger.info(`Using provided capabilities: ${options.capabilities.join(', ')}`);
      return options.capabilities;
    }

    // 2. Environment variable
    const envCaps = process.env.WORKER_CAPABILITIES;
    if (envCaps) {
      const caps = envCaps.split(',').map(c => c.trim()) as WorkerCapability[];
      logger.info(`Using env capabilities: ${caps.join(', ')}`);
      return caps;
    }

    // 3. Profile from settings (via WORKER_PROFILE env var)
    const profileName = process.env.WORKER_PROFILE;
    if (profileName && settings.WORKER_PROFILES) {
      try {
        const profiles = JSON.parse(settings.WORKER_PROFILES);
        if (Array.isArray(profiles)) {
          const profile = profiles.find(
            (p: { name?: string }) => p.name === profileName
          );
          if (profile?.capabilities?.length) {
            logger.info(`Using profile "${profileName}": ${profile.capabilities.join(', ')}`);
            return profile.capabilities as WorkerCapability[];
          }
        }
      } catch {
        logger.warn('Failed to parse WORKER_PROFILES setting');
      }
      logger.warn(`Profile "${profileName}" not found, using auto-detection`);
    }

    // 4. Auto-detection (fallback)
    logger.info('Using auto-detected capabilities');
    return this.detectCapabilities();
  }

  /**
   * Detect available capabilities based on configuration
   */
  private detectCapabilities(): WorkerCapability[] {
    const capabilities: WorkerCapability[] = [];
    const agentName = this.agent?.name || getDefaultAgent().name;

    switch (agentName) {
      case 'mistral':
        capabilities.push('observation:mistral');
        capabilities.push('summarize:mistral');
        capabilities.push('compression:mistral');
        break;
      case 'anthropic':
        capabilities.push('observation:sdk');
        capabilities.push('summarize:sdk');
        capabilities.push('compression:anthropic');
        break;
      default:
        capabilities.push('observation:sdk');
        capabilities.push('summarize:sdk');
        capabilities.push('compression:anthropic');
    }

    // Add qdrant capabilities only if vector DB is enabled
    const settings = loadSettings();
    if (settings.VECTOR_DB === 'qdrant') {
      capabilities.push('qdrant:sync');
      capabilities.push('semantic:search');
    }

    capabilities.push('context:generate');
    capabilities.push('claudemd:generate');

    return capabilities;
  }

  /**
   * Start the worker and block until exit conditions are met
   *
   * Returns a promise that resolves when the worker exits.
   */
  async runUntilDone(): Promise<{ reason: string; taskCount: number; runtimeMs: number }> {
    this.startTime = Date.now();
    logger.info(`Starting in-process worker v${VERSION}`);
    logger.info(`Using agent: ${this.agent.name}`);
    logger.info(`Idle timeout: ${this.idleTimeoutMs / 1000}s, Max runtime: ${this.maxRuntimeMs / 60000}min`);

    // Setup signal handlers
    this.setupSignalHandlers();

    // Start max runtime timer
    this.maxRuntimeTimer = setTimeout(() => {
      this.triggerExit('Maximum runtime exceeded');
    }, this.maxRuntimeMs);

    // Connect to backend
    this.client.connect();

    // Wait until exit is triggered
    await new Promise<void>((resolve) => {
      this.exitResolve = resolve;
    });

    // Cleanup
    this.cleanup();

    const runtimeMs = Date.now() - this.startTime;
    const reason = this.exitReason || 'Unknown';

    logger.info(`In-process worker exiting: ${reason}`);
    logger.info(`Processed ${this.taskCount} tasks in ${Math.round(runtimeMs / 1000)}s`);

    this.onExit?.(reason);

    return {
      reason,
      taskCount: this.taskCount,
      runtimeMs,
    };
  }

  /**
   * Check if the worker is connected
   */
  isConnected(): boolean {
    return this.client.getState() === 'connected';
  }

  /**
   * Trigger worker exit
   */
  private triggerExit(reason: string): void {
    if (this.exitReason) return; // Already exiting

    this.exitReason = reason;
    logger.info(`Triggering exit: ${reason}`);

    // Disconnect from backend
    this.client.disconnect(reason);

    // Resolve the exit promise
    this.exitResolve?.();
  }

  /**
   * Cleanup timers and handlers
   */
  private cleanup(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.maxRuntimeTimer) {
      clearTimeout(this.maxRuntimeTimer);
      this.maxRuntimeTimer = null;
    }
  }

  /**
   * Reset idle timer (called when task is received or completed)
   */
  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => {
      if (!this.currentTaskId) {
        this.triggerExit('Idle timeout');
      }
    }, this.idleTimeoutMs);
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const shutdown = (signal: string) => {
      logger.info(`Received ${signal}, shutting down...`);
      this.triggerExit(`Signal: ${signal}`);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  /**
   * Handle successful connection
   */
  private handleConnected(workerId: string): void {
    logger.info(`Connected as ${workerId}`);
    // Start idle timer
    this.resetIdleTimer();
  }

  /**
   * Handle disconnection
   */
  private handleDisconnected(reason: string): void {
    logger.warn(`Disconnected: ${reason}`);
    // In-process worker doesn't reconnect - trigger exit
    this.triggerExit(`Backend disconnected: ${reason}`);
  }

  /**
   * Handle task assignment
   */
  private async handleTaskAssigned(
    taskId: string,
    taskType: string,
    payload: unknown,
    _capability: WorkerCapability
  ): Promise<void> {
    if (this.currentTaskId) {
      logger.warn(`Already processing task ${this.currentTaskId}, rejecting ${taskId}`);
      this.client.sendTaskError(taskId, 'Worker busy', true);
      return;
    }

    this.currentTaskId = taskId;
    this.currentAbortController = new AbortController();
    this.taskCount++;
    const startTime = Date.now();

    // Clear idle timer while processing
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    try {
      logger.info(`Processing task ${taskId} (${taskType})`);

      const result = await this.processTask(taskType as TaskType, payload, this.currentAbortController.signal);

      if (this.currentAbortController.signal.aborted) {
        logger.info(`Task ${taskId} was cancelled during processing`);
        return;
      }

      const processingTime = Date.now() - startTime;
      this.client.sendTaskComplete(taskId, result, processingTime);
      logger.info(`Task ${taskId} completed in ${processingTime}ms`);
    } catch (error) {
      const err = error as Error;

      if (this.currentAbortController?.signal.aborted) {
        logger.info(`Task ${taskId} aborted: ${err.message}`);
        return;
      }

      logger.error(`Task ${taskId} failed:`, { message: err.message });
      const retryable = this.isRetryableError(err);
      this.client.sendTaskError(taskId, err.message, retryable);
    } finally {
      this.currentTaskId = null;
      this.currentAbortController = null;
      // Restart idle timer
      this.resetIdleTimer();
    }
  }

  /**
   * Process a task based on its type
   */
  private async processTask(taskType: TaskType, payload: unknown, signal?: AbortSignal): Promise<unknown> {
    if (signal?.aborted) {
      throw new Error('Task cancelled before processing');
    }

    switch (taskType) {
      case 'observation':
        return handleObservationTask(this.agent, payload as Parameters<typeof handleObservationTask>[1], signal);

      case 'summarize': {
        const summarizePayload = payload as SummarizeTaskPayload;
        const observations = summarizePayload.observations || [];
        return handleSummarizeTask(this.agent, summarizePayload, observations, signal);
      }

      case 'embedding':
        return handleEmbeddingTask(payload as EmbeddingTaskPayload, signal);

      case 'qdrant-sync':
        return handleQdrantSyncTask(getQdrantService(), payload as QdrantSyncTaskPayload, signal);

      case 'context-generate': {
        const contextPayload = payload as import('@claude-mem/types').ContextGenerateTaskPayload;
        return handleContextTask(this.agent, contextPayload, contextPayload.observations || [], signal);
      }

      case 'claude-md': {
        const claudeMdPayload = payload as ClaudeMdTaskPayload & {
          observations?: Array<{
            id: number;
            title: string;
            text: string;
            type: string;
            createdAt: number;
            tokens?: number;
          }>;
          summaries?: Array<{
            request?: string;
            investigated?: string;
            learned?: string;
            completed?: string;
            nextSteps?: string;
            createdAt: number;
          }>;
        };
        return handleClaudeMdTask(
          this.agent,
          claudeMdPayload,
          claudeMdPayload.observations || [],
          claudeMdPayload.summaries || [],
          signal
        );
      }

      case 'compression': {
        const compressionPayload = payload as CompressionTaskPayload & {
          archivedOutput: {
            id: number;
            toolName: string;
            toolInput: string;
            toolOutput: string;
            tokenCount?: number;
          };
        };
        return handleCompressionTask(
          this.agent,
          compressionPayload,
          compressionPayload.archivedOutput,
          signal
        );
      }

      default:
        throw new Error(`Unknown task type: ${taskType}`);
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    if (message.includes('rate limit') || message.includes('429')) {
      return true;
    }

    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return true;
    }

    return message.includes('timeout') || message.includes('timed out');
  }

  /**
   * Handle task cancellation
   */
  private handleTaskCancelled(taskId: string, reason?: string): void {
    if (this.currentTaskId === taskId) {
      logger.info(`Cancelling task ${taskId}: ${reason || 'No reason'}`);
      this.currentAbortController?.abort(reason || 'Task cancelled');
    }
  }

  /**
   * Handle connection error
   */
  private handleError(error: Error): void {
    logger.error('Connection error:', { message: error.message });
  }
}

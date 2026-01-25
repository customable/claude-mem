#!/usr/bin/env node
/**
 * Worker Service
 *
 * Main entry point for the worker process.
 * Connects to backend, processes tasks, and reports results.
 */

import { createLogger, loadSettings, VERSION } from '@claude-mem/shared';
import type { WorkerCapability, TaskType, QdrantSyncTaskPayload, SummarizeTaskPayload, EmbeddingTaskPayload, ClaudeMdTaskPayload, SemanticSearchTaskPayload, CompressionTaskPayload } from '@claude-mem/types';
import { WebSocketClient } from './connection/websocket-client.js';
import { getDefaultAgent, type Agent } from './agents/index.js';
import { handleObservationTask } from './handlers/observation-handler.js';
import { handleSummarizeTask } from './handlers/summarize-handler.js';
import { handleEmbeddingTask } from './handlers/embedding-handler.js';
import { handleContextTask } from './handlers/context-handler.js';
import { handleQdrantSyncTask } from './handlers/qdrant-handler.js';
import { handleSemanticSearchTask } from './handlers/semantic-search-handler.js';
import { handleClaudeMdTask } from './handlers/claudemd-handler.js';
import { handleCompressionTask } from './handlers/compression-handler.js';
import { getQdrantService } from './services/qdrant-service.js';

const logger = createLogger('worker-service');

/**
 * Worker service configuration
 */
export interface WorkerServiceConfig {
  /** Backend WebSocket URL */
  backendUrl?: string;
  /** Authentication token */
  authToken?: string;
  /** Capabilities to register */
  capabilities?: WorkerCapability[];
}

/**
 * Worker Service
 *
 * Orchestrates task processing using AI agents.
 */
export class WorkerService {
  private client: WebSocketClient;
  private readonly agent: Agent;
  private isRunning = false;
  private currentTaskId: string | null = null;
  private currentAbortController: AbortController | null = null;

  constructor(config: WorkerServiceConfig = {}) {
    const settings = loadSettings();

    // Determine capabilities
    const capabilities = config.capabilities || this.detectCapabilities();

    // Initialize agent
    this.agent = getDefaultAgent();

    // Build metadata, including spawnedId if this worker was spawned by backend
    const metadata: Record<string, unknown> = {
      version: VERSION,
      hostname: process.env.HOSTNAME || 'unknown',
      agent: this.agent.name,
    };

    // Include spawnedId if this worker was spawned by the backend
    if (process.env.CLAUDE_MEM_SPAWNED_ID) {
      metadata.spawnedId = process.env.CLAUDE_MEM_SPAWNED_ID;
    }

    // Initialize WebSocket client
    this.client = new WebSocketClient({
      backendUrl: config.backendUrl,
      authToken: config.authToken || settings.WORKER_AUTH_TOKEN,
      capabilities,
      metadata,
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
   * Detect available capabilities based on configuration
   */
  private detectCapabilities(): WorkerCapability[] {
    const capabilities: WorkerCapability[] = [];
    const agentName = this.agent?.name || getDefaultAgent().name;

    // Add observation capability based on agent
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

    // Context generation capability
    capabilities.push('context:generate');

    // CLAUDE.md generation capability
    capabilities.push('claudemd:generate');

    return capabilities;
  }

  /**
   * Start the worker service
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Worker service is already running');
      return;
    }

    this.isRunning = true;
    logger.info(`Starting worker service v${VERSION}`);
    logger.info(`Using agent: ${this.agent.name}`);

    // Setup signal handlers
    this.setupSignalHandlers();

    // Connect to backend
    this.client.connect();
  }

  /**
   * Stop the worker service
   */
  stop(): void {
    if (!this.isRunning) return;

    logger.info('Stopping worker service...');
    this.isRunning = false;
    this.client.disconnect('Worker shutdown');
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const shutdown = () => {
      this.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  /**
   * Handle successful connection
   */
  private handleConnected(workerId: string): void {
    logger.info(`Connected as ${workerId}`);
  }

  /**
   * Handle disconnection
   */
  private handleDisconnected(reason: string): void {
    logger.warn(`Disconnected: ${reason}`);

    if (!this.isRunning) return;

    // Client will auto-reconnect
    logger.info('Will attempt to reconnect...');
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
    const startTime = Date.now();

    try {
      logger.info(`Processing task ${taskId} (${taskType})`);

      const result = await this.processTask(taskType as TaskType, payload, this.currentAbortController.signal);

      // Check if task was cancelled during processing
      if (this.currentAbortController.signal.aborted) {
        logger.info(`Task ${taskId} was cancelled during processing`);
        return;
      }

      const processingTime = Date.now() - startTime;
      this.client.sendTaskComplete(taskId, result, processingTime);

      logger.info(`Task ${taskId} completed in ${processingTime}ms`);
    } catch (error) {
      const err = error as Error;

      // Don't report error if task was cancelled
      if (this.currentAbortController?.signal.aborted) {
        logger.info(`Task ${taskId} aborted: ${err.message}`);
        return;
      }

      logger.error(`Task ${taskId} failed:`, { message: err.message });

      // Determine if error is retryable
      const retryable = this.isRetryableError(err);
      this.client.sendTaskError(taskId, err.message, retryable);
    } finally {
      this.currentTaskId = null;
      this.currentAbortController = null;
    }
  }

  /**
   * Process a task based on its type
   */
  private async processTask(taskType: TaskType, payload: unknown, signal?: AbortSignal): Promise<unknown> {
    // Check for cancellation before starting
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

      case 'semantic-search':
        return handleSemanticSearchTask(getQdrantService(), payload as SemanticSearchTaskPayload, signal);

      case 'context-generate': {
        const contextPayload = payload as import('@claude-mem/types').ContextGenerateTaskPayload;
        return handleContextTask(
          this.agent,
          contextPayload,
          contextPayload.observations || [],
          signal
        );
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
        // Compression tasks include archived output data in the payload
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

    // Rate limit errors are retryable
    if (message.includes('rate limit') || message.includes('429')) {
      return true;
    }

    // Temporary server errors are retryable
    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return true;
    }

    // Timeout errors are retryable
    return message.includes('timeout') || message.includes('timed out');
  }

  /**
   * Handle task cancellation
   */
  private handleTaskCancelled(taskId: string, reason?: string): void {
    if (this.currentTaskId === taskId) {
      logger.info(`Cancelling task ${taskId}: ${reason || 'No reason'}`);

      // Abort the current task
      if (this.currentAbortController) {
        this.currentAbortController.abort(reason || 'Task cancelled');
      }

      // Note: currentTaskId and currentAbortController will be cleaned up
      // in the finally block of handleTaskAssigned
    }
  }

  /**
   * Handle connection error
   */
  private handleError(error: Error): void {
    logger.error('Connection error:', { message: error.message });
  }
}

// CLI entry point
// Check if running directly (works in both ESM and bundled CJS)
const isMain = (() => {
  try {
    // ESM check
    if (typeof import.meta?.url === 'string' && process.argv[1]) {
      return import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
    }
  } catch {
    // import.meta not available in CJS
  }
  // CJS/bundled check - look for specific CLI arguments
  return process.argv.includes('--daemon') || process.argv.includes('start');
})();

if (isMain) {
  const worker = new WorkerService();
  worker.start();
}

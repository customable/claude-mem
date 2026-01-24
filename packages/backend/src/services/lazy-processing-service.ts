/**
 * Lazy Processing Service
 *
 * Handles on-demand and batch processing of raw messages in Lazy Mode.
 */

import { createLogger, loadSettings } from '@claude-mem/shared';
import type { IUnitOfWork, RawMessageRecord } from '@claude-mem/types';

const logger = createLogger('lazy-processing');

export interface LazyProcessingStatus {
  mode: 'normal' | 'lazy' | 'hybrid';
  unprocessedCount: number;
  oldestUnprocessed: number | null;
  lastProcessed: number | null;
  nextBatchAt: number | null;
}

export interface ProcessBatchResult {
  processed: number;
  failed: number;
  observations: number[];
}

export interface LazyProcessingServiceDeps {
  uow: IUnitOfWork;
  processMessage?: (message: RawMessageRecord) => Promise<number | null>;
}

/**
 * Lazy Processing Service
 *
 * Manages raw message storage and batch processing for token efficiency.
 */
export class LazyProcessingService {
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(private deps: LazyProcessingServiceDeps) {}

  /**
   * Check if lazy mode is active
   */
  isLazyMode(): boolean {
    const settings = loadSettings();
    return settings.PROCESSING_MODE === 'lazy' || settings.PROCESSING_MODE === 'hybrid';
  }

  /**
   * Check if a message type should be processed in hybrid mode
   */
  shouldProcessInHybridMode(type: string): boolean {
    const settings = loadSettings();
    if (settings.PROCESSING_MODE !== 'hybrid') return false;

    const hybridTypes = settings.LAZY_HYBRID_TYPES
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    return hybridTypes.includes(type.toLowerCase());
  }

  /**
   * Store a raw message (for lazy mode)
   */
  async storeRawMessage(params: {
    sessionId: string;
    project: string;
    promptNumber?: number;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolCalls?: string;
    toolName?: string;
    toolInput?: string;
    toolOutput?: string;
  }): Promise<RawMessageRecord> {
    return this.deps.uow.rawMessages.create({
      sessionId: params.sessionId,
      project: params.project,
      promptNumber: params.promptNumber,
      role: params.role,
      content: params.content,
      toolCalls: params.toolCalls,
      toolName: params.toolName,
      toolInput: params.toolInput,
      toolOutput: params.toolOutput,
    });
  }

  /**
   * Get processing status
   */
  async getStatus(): Promise<LazyProcessingStatus> {
    const settings = loadSettings();
    const status = await this.deps.uow.rawMessages.getStatus();

    let nextBatchAt: number | null = null;
    if (settings.LAZY_BATCH_INTERVAL > 0 && status.lastProcessed) {
      nextBatchAt = status.lastProcessed + settings.LAZY_BATCH_INTERVAL * 1000;
    }

    return {
      mode: settings.PROCESSING_MODE,
      unprocessedCount: status.unprocessedCount,
      oldestUnprocessed: status.oldestUnprocessed,
      lastProcessed: status.lastProcessed,
      nextBatchAt,
    };
  }

  /**
   * Process a batch of messages manually
   */
  async processBatch(options?: {
    sessionId?: string;
    limit?: number;
  }): Promise<ProcessBatchResult> {
    if (this.isProcessing) {
      logger.warn('Batch processing already in progress');
      return { processed: 0, failed: 0, observations: [] };
    }

    this.isProcessing = true;
    const result: ProcessBatchResult = {
      processed: 0,
      failed: 0,
      observations: [],
    };

    try {
      const limit = options?.limit ?? 50;

      // Get unprocessed messages
      let messages: RawMessageRecord[];
      if (options?.sessionId) {
        messages = await this.deps.uow.rawMessages.list(
          { sessionId: options.sessionId, processed: false },
          { limit, orderBy: 'created_at_epoch', order: 'asc' }
        );
      } else {
        messages = await this.deps.uow.rawMessages.getUnprocessed(limit);
      }

      logger.info(`Processing ${messages.length} raw messages`);

      // Process each message
      for (const message of messages) {
        try {
          // Call the processing function if provided
          let observationId: number | null = null;
          if (this.deps.processMessage) {
            observationId = await this.deps.processMessage(message);
            if (observationId) {
              result.observations.push(observationId);
            }
          }

          // Mark as processed
          await this.deps.uow.rawMessages.markProcessed(
            [message.id],
            observationId ?? undefined
          );
          result.processed++;
        } catch (error) {
          logger.error(`Failed to process message ${message.id}:`, { error: String(error) });
          result.failed++;
        }
      }

      logger.info(`Batch complete: ${result.processed} processed, ${result.failed} failed`);
      return result;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process messages matching a search query (for on-demand processing)
   */
  async processForSearch(query: string, project?: string): Promise<RawMessageRecord[]> {
    const settings = loadSettings();
    if (!settings.LAZY_PROCESS_ON_SEARCH) {
      return [];
    }

    // Search for matching unprocessed messages
    const messages = await this.deps.uow.rawMessages.search(
      query,
      { project, processed: false },
      { limit: 20 }
    );

    if (messages.length === 0) {
      return [];
    }

    // Process matching messages
    const processedIds: number[] = [];
    for (const message of messages) {
      try {
        let observationId: number | null = null;
        if (this.deps.processMessage) {
          observationId = await this.deps.processMessage(message);
        }
        await this.deps.uow.rawMessages.markProcessed(
          [message.id],
          observationId ?? undefined
        );
        processedIds.push(message.id);
      } catch (error) {
        logger.error(`Failed to process message ${message.id} for search:`, { error: String(error) });
      }
    }

    logger.info(`Processed ${processedIds.length} messages for search query`);
    return messages.filter(m => processedIds.includes(m.id));
  }

  /**
   * Start scheduled batch processing
   */
  startScheduledProcessing(): void {
    const settings = loadSettings();
    if (settings.LAZY_BATCH_INTERVAL <= 0) {
      logger.debug('Batch processing disabled (interval = 0)');
      return;
    }

    // Clear existing timer
    this.stopScheduledProcessing();

    // Start new timer
    const intervalMs = settings.LAZY_BATCH_INTERVAL * 1000;
    this.batchTimer = setInterval(async () => {
      try {
        await this.processBatch();
      } catch (error) {
        logger.error('Scheduled batch processing failed:', { error: String(error) });
      }
    }, intervalMs);

    logger.info(`Batch processing scheduled every ${settings.LAZY_BATCH_INTERVAL}s`);
  }

  /**
   * Stop scheduled batch processing
   */
  stopScheduledProcessing(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
      logger.debug('Batch processing stopped');
    }
  }

  /**
   * Cleanup old processed messages
   */
  async cleanup(olderThanDays = 30): Promise<number> {
    const deleted = await this.deps.uow.rawMessages.cleanupProcessed(olderThanDays);
    logger.info(`Cleaned up ${deleted} old processed messages`);
    return deleted;
  }
}

/**
 * Create lazy processing service
 */
export function createLazyProcessingService(
  deps: LazyProcessingServiceDeps
): LazyProcessingService {
  return new LazyProcessingService(deps);
}

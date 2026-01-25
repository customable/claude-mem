/**
 * Offline Queue (Issue #253)
 *
 * Queues events when backend is unreachable for later synchronization.
 * Uses atomic file operations to prevent corruption.
 */

import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DATA_DIR, ensureDir } from './paths.js';
import { createLogger } from './logger.js';

const logger = createLogger('offline-queue');

/**
 * Queue entry structure
 */
export interface QueueEntry {
  id: string;
  timestamp: string;
  type: string;
  payload: unknown;
  retries: number;
}

/**
 * Queue file structure
 */
interface QueueFile {
  version: number;
  entries: QueueEntry[];
}

/**
 * Offline queue configuration
 */
export interface OfflineQueueConfig {
  /** Maximum entries in queue (default: 1000) */
  maxEntries?: number;
  /** Queue file path (default: ~/.claude-mem/offline-queue.json) */
  queuePath?: string;
  /** Max retries per entry before discarding (default: 5) */
  maxRetries?: number;
}

/**
 * Offline Queue for graceful degradation when backend is unavailable
 */
export class OfflineQueue {
  private readonly queuePath: string;
  private readonly maxEntries: number;
  private readonly maxRetries: number;
  private readonly lockPath: string;

  constructor(config: OfflineQueueConfig = {}) {
    ensureDir(DATA_DIR);
    this.queuePath = config.queuePath ?? join(DATA_DIR, 'offline-queue.json');
    this.lockPath = `${this.queuePath}.lock`;
    this.maxEntries = config.maxEntries ?? 1000;
    this.maxRetries = config.maxRetries ?? 5;
  }

  /**
   * Add an entry to the queue
   */
  enqueue(type: string, payload: unknown): string {
    const entry: QueueEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      payload,
      retries: 0,
    };

    const queue = this.load();
    queue.entries.push(entry);

    // Enforce max entries (remove oldest)
    if (queue.entries.length > this.maxEntries) {
      const removed = queue.entries.length - this.maxEntries;
      queue.entries = queue.entries.slice(removed);
      logger.warn(`Queue overflow, removed ${removed} oldest entries`);
    }

    this.save(queue);
    logger.debug(`Queued event: ${type}`, { id: entry.id });

    return entry.id;
  }

  /**
   * Get all pending entries (oldest first)
   */
  peek(limit?: number): QueueEntry[] {
    const queue = this.load();
    return limit ? queue.entries.slice(0, limit) : queue.entries;
  }

  /**
   * Remove successfully processed entries
   */
  remove(ids: string[]): void {
    if (ids.length === 0) return;

    const queue = this.load();
    const idSet = new Set(ids);
    queue.entries = queue.entries.filter(e => !idSet.has(e.id));
    this.save(queue);

    logger.debug(`Removed ${ids.length} entries from queue`);
  }

  /**
   * Increment retry count for failed entries
   * Returns entries that exceeded max retries (for logging/alerting)
   */
  markRetried(ids: string[]): QueueEntry[] {
    if (ids.length === 0) return [];

    const queue = this.load();
    const idSet = new Set(ids);
    const exceeded: QueueEntry[] = [];

    queue.entries = queue.entries.filter(entry => {
      if (!idSet.has(entry.id)) return true;

      entry.retries++;
      if (entry.retries > this.maxRetries) {
        exceeded.push(entry);
        logger.warn(`Discarding entry after ${this.maxRetries} retries`, {
          id: entry.id,
          type: entry.type,
        });
        return false;
      }
      return true;
    });

    this.save(queue);
    return exceeded;
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.load().entries.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.size() === 0;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.save({ version: 1, entries: [] });
    logger.info('Queue cleared');
  }

  /**
   * Load queue from disk
   */
  private load(): QueueFile {
    try {
      if (!existsSync(this.queuePath)) {
        return { version: 1, entries: [] };
      }

      const content = readFileSync(this.queuePath, 'utf-8');
      const data = JSON.parse(content) as QueueFile;

      // Validate structure
      if (!data.version || !Array.isArray(data.entries)) {
        logger.warn('Invalid queue file, resetting');
        return { version: 1, entries: [] };
      }

      return data;
    } catch (error) {
      logger.error('Failed to load queue', {}, error as Error);
      return { version: 1, entries: [] };
    }
  }

  /**
   * Save queue to disk atomically
   */
  private save(queue: QueueFile): void {
    try {
      const tempPath = `${this.queuePath}.tmp`;
      const content = JSON.stringify(queue, null, 2);

      // Write to temp file first
      writeFileSync(tempPath, content, 'utf-8');

      // Atomic rename
      renameSync(tempPath, this.queuePath);
    } catch (error) {
      logger.error('Failed to save queue', {}, error as Error);
    }
  }
}

/**
 * Global queue instance
 */
let globalQueue: OfflineQueue | null = null;

/**
 * Get or create the global offline queue
 */
export function getOfflineQueue(config?: OfflineQueueConfig): OfflineQueue {
  if (!globalQueue) {
    globalQueue = new OfflineQueue(config);
  }
  return globalQueue;
}

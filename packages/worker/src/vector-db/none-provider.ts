/**
 * None Vector Database Provider (Issue #112)
 *
 * A no-op provider for installations that don't need vector search.
 * All operations are no-ops; search always returns empty results.
 * Use FTS5 (SQLite full-text search) as the fallback.
 */

import { createLogger } from '@claude-mem/shared';
import type {
  VectorDatabase,
  VectorDbConfig,
  VectorDocument,
  VectorSearchResult,
  VectorSearchOptions,
  VectorDbStats,
} from './types.js';

const logger = createLogger('vector-db:none');

/**
 * None Vector Database Provider
 *
 * Provides a no-op implementation when vector search is disabled.
 * This allows claude-mem to run without Qdrant or other vector databases.
 */
export class NoneVectorDb implements VectorDatabase {
  readonly name = 'none';
  private _initialized = false;

  constructor(_config?: VectorDbConfig) {
    logger.debug('None vector database provider created (vector search disabled)');
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;
    logger.info('None vector database initialized (vector search disabled, use FTS5 fallback)');
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  async isAvailable(): Promise<boolean> {
    // Always available since it doesn't require external services
    return true;
  }

  async upsert(_documents: VectorDocument[]): Promise<void> {
    // No-op: Documents are not stored in vector format
    logger.debug('Upsert skipped (vector search disabled)');
  }

  async search(_query: string, _options?: VectorSearchOptions): Promise<VectorSearchResult[]> {
    // Always returns empty - caller should use FTS5 fallback
    logger.debug('Search returns empty (vector search disabled, use FTS5)');
    return [];
  }

  async delete(_ids: string[]): Promise<void> {
    // No-op: Nothing to delete
    logger.debug('Delete skipped (vector search disabled)');
  }

  async deleteByFilter(_filter: { type?: string; project?: string }): Promise<void> {
    // No-op: Nothing to delete
    logger.debug('DeleteByFilter skipped (vector search disabled)');
  }

  async getStats(): Promise<VectorDbStats> {
    return {
      totalDocuments: 0,
      indexedDocuments: 0,
    };
  }

  async close(): Promise<void> {
    this._initialized = false;
    logger.debug('None vector database closed');
  }
}

/**
 * Factory function for creating the none provider
 */
export function createNoneProvider(config?: VectorDbConfig): VectorDatabase {
  return new NoneVectorDb(config);
}

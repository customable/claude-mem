/**
 * Qdrant Vector Database Provider (Issue #112)
 *
 * Wraps the QdrantService as a VectorDatabase provider.
 * Enables Qdrant to be used through the provider-agnostic interface.
 */

import { createLogger } from '@claude-mem/shared';
import { QdrantService, type QdrantServiceConfig } from '../services/qdrant-service.js';
import type {
  VectorDatabase,
  VectorDbConfig,
  VectorDocument,
  VectorSearchResult,
  VectorSearchOptions,
  VectorDbStats,
} from './types.js';

const logger = createLogger('vector-db:qdrant');

/**
 * Qdrant Vector Database Provider
 *
 * Uses the existing QdrantService implementation through the
 * provider-agnostic VectorDatabase interface.
 */
export class QdrantVectorDb implements VectorDatabase {
  readonly name = 'qdrant';
  private service: QdrantService;
  private _initialized = false;

  constructor(config?: VectorDbConfig) {
    const serviceConfig: QdrantServiceConfig = {
      url: config?.url,
      apiKey: config?.apiKey,
      collectionName: config?.collectionName,
    };
    this.service = new QdrantService(serviceConfig);
    logger.debug('Qdrant vector database provider created');
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;

    await this.service.initialize();
    this._initialized = true;
    logger.info('Qdrant vector database initialized');
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  async isAvailable(): Promise<boolean> {
    return this.service.isAvailable();
  }

  async upsert(documents: VectorDocument[]): Promise<void> {
    if (!this._initialized) {
      await this.initialize();
    }
    await this.service.upsert(documents);
  }

  async search(query: string, options?: VectorSearchOptions): Promise<VectorSearchResult[]> {
    if (!this._initialized) {
      await this.initialize();
    }
    return this.service.search(query, {
      limit: options?.limit,
      filter: options?.filter,
      scoreThreshold: options?.scoreThreshold,
    });
  }

  async delete(ids: string[]): Promise<void> {
    await this.service.delete(ids);
  }

  async deleteByFilter(filter: { type?: string; project?: string }): Promise<void> {
    await this.service.deleteByFilter(filter);
  }

  async getStats(): Promise<VectorDbStats> {
    return this.service.getStats();
  }

  async close(): Promise<void> {
    await this.service.close();
    this._initialized = false;
    logger.debug('Qdrant vector database closed');
  }
}

/**
 * Factory function for creating the Qdrant provider
 */
export function createQdrantProvider(config?: VectorDbConfig): VectorDatabase {
  return new QdrantVectorDb(config);
}

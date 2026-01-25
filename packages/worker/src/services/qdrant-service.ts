/**
 * Qdrant Vector Database Service
 *
 * Handles embedding generation and vector storage/retrieval.
 * Uses pluggable embedding providers via the embedding registry (Issue #112).
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { createLogger, loadSettings } from '@claude-mem/shared';
import { getEmbeddingProvider, type EmbeddingProvider } from '../embeddings/index.js';

const logger = createLogger('qdrant');

/**
 * Document to be embedded and stored
 */
export interface VectorDocument {
  id: string;
  text: string;
  metadata: {
    type: 'observation' | 'summary' | 'prompt';
    project: string;
    sessionId?: string;
    observationId?: number;
    summaryId?: number;
    promptId?: number;
    createdAt: string;
    [key: string]: unknown;
  };
}

/**
 * Search result from vector similarity search
 */
export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: VectorDocument['metadata'];
}

/**
 * Qdrant service configuration
 */
export interface QdrantServiceConfig {
  url?: string;
  apiKey?: string;
  collectionName?: string;
  embeddingModel?: string;
}

/**
 * Qdrant Vector Database Service
 *
 * Uses the embedding provider registry for flexible embedding generation.
 */
export class QdrantService {
  private client: QdrantClient | null = null;
  private embeddingProvider: EmbeddingProvider | null = null;
  private readonly collectionName: string;
  private embeddingDimension: number = 384; // Default, updated after provider init
  private initialized = false;

  constructor(config: QdrantServiceConfig = {}) {
    this.collectionName = config.collectionName || 'claude-mem';

    const url = config.url || process.env.QDRANT_URL || 'http://localhost:6333';
    const apiKey = config.apiKey || process.env.QDRANT_API_KEY;

    this.client = new QdrantClient({
      url,
      apiKey,
    });
  }

  /**
   * Initialize the service (load embedding provider, ensure collection exists)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Initializing Qdrant service...');

    try {
      // Get embedding provider from registry
      this.embeddingProvider = getEmbeddingProvider();
      await this.embeddingProvider.initialize();
      this.embeddingDimension = this.embeddingProvider.dimension;

      logger.info('Embedding provider initialized', {
        provider: this.embeddingProvider.name,
        dimension: this.embeddingDimension,
      });

      // Ensure collection exists
      await this.ensureCollection();

      this.initialized = true;
      logger.info('Qdrant service initialized');
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to initialize Qdrant service', { error: err.message });
      throw error;
    }
  }

  /**
   * Ensure the collection exists with correct schema
   */
  private async ensureCollection(): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(c => c.name === this.collectionName);

      if (!exists) {
        logger.info('Creating collection', { name: this.collectionName });
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.embeddingDimension,
            distance: 'Cosine',
          },
        });

        // Create payload indices for filtering
        await this.client.createPayloadIndex(this.collectionName, {
          field_name: 'type',
          field_schema: 'keyword',
        });
        await this.client.createPayloadIndex(this.collectionName, {
          field_name: 'project',
          field_schema: 'keyword',
        });

        logger.info('Collection created with indices');
      }
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to ensure collection', { error: err.message });
      throw error;
    }
  }

  /**
   * Generate embeddings for texts using the configured provider
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (!this.embeddingProvider) {
      throw new Error('Embedding provider not initialized');
    }

    return this.embeddingProvider.embed(texts);
  }

  /**
   * Upsert documents into the vector store
   */
  async upsert(documents: VectorDocument[]): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');
    if (!this.initialized) await this.initialize();

    if (documents.length === 0) return;

    logger.debug('Upserting documents', { count: documents.length });

    // Generate embeddings
    const texts = documents.map(d => d.text);
    const embeddings = await this.embed(texts);

    // Prepare points for Qdrant
    const points = documents.map((doc, i) => ({
      id: doc.id,
      vector: embeddings[i],
      payload: {
        text: doc.text.slice(0, 1000), // Store truncated text for display
        ...doc.metadata,
      },
    }));

    // Upsert in batches
    const batchSize = 100;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: batch,
      });
    }

    logger.info('Documents upserted', { count: documents.length });
  }

  /**
   * Search for similar documents
   */
  async search(
    query: string,
    options: {
      limit?: number;
      filter?: {
        type?: string;
        project?: string;
      };
      scoreThreshold?: number;
    } = {}
  ): Promise<VectorSearchResult[]> {
    if (!this.client) throw new Error('Client not initialized');
    if (!this.initialized) await this.initialize();

    const { limit = 10, filter, scoreThreshold = 0.5 } = options;

    // Generate query embedding
    const [queryEmbedding] = await this.embed([query]);

    // Build filter
    const qdrantFilter: Record<string, unknown> = {};
    if (filter) {
      const must: Array<Record<string, unknown>> = [];
      if (filter.type) {
        must.push({ key: 'type', match: { value: filter.type } });
      }
      if (filter.project) {
        must.push({ key: 'project', match: { value: filter.project } });
      }
      if (must.length > 0) {
        qdrantFilter.must = must;
      }
    }

    // Search
    const results = await this.client.search(this.collectionName, {
      vector: queryEmbedding,
      limit,
      filter: Object.keys(qdrantFilter).length > 0 ? qdrantFilter : undefined,
      score_threshold: scoreThreshold,
      with_payload: true,
    });

    return results.map(r => ({
      id: r.id as string,
      score: r.score,
      metadata: r.payload as VectorDocument['metadata'],
    }));
  }

  /**
   * Delete documents by IDs
   */
  async delete(ids: string[]): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');
    if (ids.length === 0) return;

    await this.client.delete(this.collectionName, {
      wait: true,
      points: ids,
    });

    logger.debug('Documents deleted', { count: ids.length });
  }

  /**
   * Delete documents by filter
   */
  async deleteByFilter(filter: { type?: string; project?: string }): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    const must: Array<Record<string, unknown>> = [];
    if (filter.type) {
      must.push({ key: 'type', match: { value: filter.type } });
    }
    if (filter.project) {
      must.push({ key: 'project', match: { value: filter.project } });
    }

    if (must.length === 0) return;

    await this.client.delete(this.collectionName, {
      wait: true,
      filter: { must },
    });

    logger.info('Documents deleted by filter', { filter });
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{
    totalDocuments: number;
    indexedDocuments: number;
  }> {
    if (!this.client) throw new Error('Client not initialized');

    try {
      const info = await this.client.getCollection(this.collectionName);
      return {
        totalDocuments: info.points_count || 0,
        indexedDocuments: info.indexed_vectors_count || 0,
      };
    } catch {
      return { totalDocuments: 0, indexedDocuments: 0 };
    }
  }

  /**
   * Check if service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!this.client) return false;
      await this.client.getCollections();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Close the service
   */
  async close(): Promise<void> {
    if (this.embeddingProvider) {
      await this.embeddingProvider.close();
    }
    this.client = null;
    this.embeddingProvider = null;
    this.initialized = false;
  }
}

// Singleton instance
let instance: QdrantService | null = null;

/**
 * Get or create the Qdrant service instance
 */
export function getQdrantService(config?: QdrantServiceConfig): QdrantService {
  if (!instance) {
    instance = new QdrantService(config);
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetQdrantService(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}

/**
 * Qdrant Vector Database Service
 *
 * Handles embedding generation and vector storage/retrieval.
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { pipeline, env } from '@xenova/transformers';
import { createLogger, loadSettings } from '@claude-mem/shared';
import path from 'path';
import os from 'os';

const logger = createLogger('qdrant');

// Configure transformers.js cache
env.cacheDir = path.join(os.homedir(), '.claude-mem', 'models');
env.allowLocalModels = true;

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
 */
// Feature extraction pipeline type from transformers.js
type FeatureExtractionPipeline = (text: string, options?: { pooling?: string; normalize?: boolean }) => Promise<{ data: Float32Array }>;

export class QdrantService {
  private client: QdrantClient | null = null;
  private embedder: FeatureExtractionPipeline | null = null;
  private readonly collectionName: string;
  private readonly embeddingModel: string;
  private readonly embeddingDimension = 384; // MiniLM-L6-v2 dimension
  private initialized = false;

  constructor(config: QdrantServiceConfig = {}) {
    const settings = loadSettings();

    this.collectionName = config.collectionName || 'claude-mem';
    this.embeddingModel = config.embeddingModel || settings.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';

    const url = config.url || process.env.QDRANT_URL || 'http://localhost:6333';
    const apiKey = config.apiKey || process.env.QDRANT_API_KEY;

    this.client = new QdrantClient({
      url,
      apiKey,
    });
  }

  /**
   * Initialize the service (load model, ensure collection exists)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Initializing Qdrant service...', { model: this.embeddingModel });

    try {
      // Load embedding model
      logger.debug('Loading embedding model...');
      this.embedder = await pipeline('feature-extraction', this.embeddingModel, {
        quantized: true, // Use quantized model for speed
      }) as unknown as FeatureExtractionPipeline;
      logger.info('Embedding model loaded');

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
   * Generate embeddings for texts
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }

    const embeddings: number[][] = [];

    for (const text of texts) {
      // Truncate long texts (model has max token limit)
      const truncated = text.slice(0, 8000);

      const output = await this.embedder(truncated, {
        pooling: 'mean',
        normalize: true,
      });

      // Convert to regular array
      embeddings.push(Array.from(output.data as Float32Array));
    }

    return embeddings;
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
    this.client = null;
    this.embedder = null;
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

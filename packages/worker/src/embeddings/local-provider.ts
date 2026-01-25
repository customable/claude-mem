/**
 * Local Embedding Provider (Issue #112)
 *
 * Uses Xenova/transformers.js for local embedding generation.
 * Default provider - runs entirely locally without API keys.
 */

import { pipeline, env } from '@xenova/transformers';
import { join } from 'path';
import { homedir } from 'os';
import { createLogger } from '@claude-mem/shared';
import type { EmbeddingProvider, EmbeddingProviderConfig } from './types.js';

const logger = createLogger('embedding:local');

// Configure transformers.js cache
env.cacheDir = join(homedir(), '.claude-mem', 'models');
env.allowLocalModels = true;

// Feature extraction pipeline type from transformers.js
type FeatureExtractionPipeline = (
  text: string,
  options?: { pooling?: string; normalize?: boolean }
) => Promise<{ data: Float32Array }>;

/**
 * Default model configurations
 */
const MODEL_CONFIGS: Record<string, { dimension: number }> = {
  'Xenova/all-MiniLM-L6-v2': { dimension: 384 },
  'Xenova/all-MiniLM-L12-v2': { dimension: 384 },
  'Xenova/gte-small': { dimension: 384 },
  'Xenova/bge-small-en-v1.5': { dimension: 384 },
};

const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';

/**
 * Local Embedding Provider
 *
 * Runs Xenova models locally using transformers.js.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'local';
  readonly dimension: number;

  private readonly model: string;
  private embedder: FeatureExtractionPipeline | null = null;
  private initialized = false;

  constructor(config: EmbeddingProviderConfig = {}) {
    this.model = config.model || DEFAULT_MODEL;
    this.dimension = MODEL_CONFIGS[this.model]?.dimension || 384;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Loading local embedding model...', { model: this.model });

    try {
      this.embedder = (await pipeline('feature-extraction', this.model, {
        quantized: true, // Use quantized model for speed
      })) as unknown as FeatureExtractionPipeline;

      this.initialized = true;
      logger.info('Local embedding model loaded', {
        model: this.model,
        dimension: this.dimension,
      });
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to load embedding model', { error: err.message });
      throw error;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.embedder) {
      throw new Error('Embedding provider not initialized');
    }

    const embeddings: number[][] = [];

    for (const text of texts) {
      // Truncate long texts (model has max token limit)
      const truncated = text.slice(0, 8000);

      const output = await this.embedder(truncated, {
        pooling: 'mean',
        normalize: true,
      });

      // Convert Float32Array to regular array
      embeddings.push(Array.from(output.data as Float32Array));
    }

    return embeddings;
  }

  async embedSingle(text: string): Promise<number[]> {
    const [embedding] = await this.embed([text]);
    return embedding;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async close(): Promise<void> {
    this.embedder = null;
    this.initialized = false;
    logger.debug('Local embedding provider closed');
  }
}

/**
 * Create a local embedding provider
 */
export function createLocalProvider(config?: EmbeddingProviderConfig): EmbeddingProvider {
  return new LocalEmbeddingProvider(config);
}

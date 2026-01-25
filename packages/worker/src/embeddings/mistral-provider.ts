/**
 * Mistral Embedding Provider (Issue #112)
 *
 * Uses Mistral AI's embedding API for text embeddings.
 * Can share API key with AI provider when AI_PROVIDER is 'mistral'.
 */

import { Mistral } from '@mistralai/mistralai';
import { createLogger, loadSettings } from '@claude-mem/shared';
import type { EmbeddingProvider, EmbeddingProviderConfig } from './types.js';

const logger = createLogger('embedding:mistral');

/**
 * Mistral embedding model configurations
 */
const MODEL_CONFIGS: Record<string, { dimension: number }> = {
  'mistral-embed': { dimension: 1024 },
  'codestral-embed': { dimension: 1024 }, // Code-optimized embeddings
};

const DEFAULT_MODEL = 'mistral-embed';

/**
 * Mistral Embedding Provider
 *
 * Uses Mistral AI's embedding API for generating text embeddings.
 */
export class MistralEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'mistral';
  readonly dimension: number;

  private readonly model: string;
  private readonly apiKey: string;
  private client: Mistral | null = null;
  private initialized = false;

  constructor(config: EmbeddingProviderConfig = {}) {
    const settings = loadSettings();

    this.model = config.model || settings.MISTRAL_EMBEDDING_MODEL || DEFAULT_MODEL;
    this.dimension = MODEL_CONFIGS[this.model]?.dimension || 1024;

    // Use provided API key, or fall back to MISTRAL_API_KEY setting
    this.apiKey = config.apiKey || settings.MISTRAL_API_KEY;

    if (!this.apiKey) {
      throw new Error(
        'Mistral API key required. Set MISTRAL_API_KEY in settings or provide apiKey in config.'
      );
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Initializing Mistral embedding provider...', { model: this.model });

    try {
      this.client = new Mistral({ apiKey: this.apiKey });

      // Verify connection by making a small test request
      await this.client.embeddings.create({
        model: this.model,
        inputs: ['test'],
      });

      this.initialized = true;
      logger.info('Mistral embedding provider initialized', {
        model: this.model,
        dimension: this.dimension,
      });
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to initialize Mistral embedding provider', {
        error: err.message,
      });
      throw error;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.client) {
      throw new Error('Mistral embedding provider not initialized');
    }

    if (texts.length === 0) {
      return [];
    }

    // Mistral supports batch embedding
    const response = await this.client.embeddings.create({
      model: this.model,
      inputs: texts,
    });

    // Extract embeddings from response (filter out any undefined embeddings)
    return response.data
      .map((item) => item.embedding)
      .filter((embedding): embedding is number[] => embedding !== undefined);
  }

  async embedSingle(text: string): Promise<number[]> {
    const [embedding] = await this.embed([text]);
    return embedding;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async close(): Promise<void> {
    this.client = null;
    this.initialized = false;
    logger.debug('Mistral embedding provider closed');
  }
}

/**
 * Create a Mistral embedding provider
 */
export function createMistralProvider(config?: EmbeddingProviderConfig): EmbeddingProvider {
  return new MistralEmbeddingProvider(config);
}

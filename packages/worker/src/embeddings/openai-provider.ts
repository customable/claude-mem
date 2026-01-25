/**
 * OpenAI Embedding Provider (Issue #112)
 *
 * Uses OpenAI's embedding API for text embeddings.
 * Supports both OpenAI and OpenAI-compatible APIs (via base URL).
 */

import { createLogger, loadSettings } from '@claude-mem/shared';
import type { EmbeddingProvider, EmbeddingProviderConfig } from './types.js';

const logger = createLogger('embedding:openai');

/**
 * OpenAI embedding model configurations
 */
const MODEL_CONFIGS: Record<string, { dimension: number }> = {
  'text-embedding-3-small': { dimension: 1536 },
  'text-embedding-3-large': { dimension: 3072 },
  'text-embedding-ada-002': { dimension: 1536 },
};

const DEFAULT_MODEL = 'text-embedding-3-small';

/**
 * OpenAI Embedding Provider
 *
 * Uses OpenAI's embedding API for generating text embeddings.
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai';
  readonly dimension: number;

  private readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private initialized = false;

  constructor(config: EmbeddingProviderConfig = {}) {
    const settings = loadSettings();

    this.model = config.model || settings.OPENAI_EMBEDDING_MODEL || DEFAULT_MODEL;
    this.dimension = MODEL_CONFIGS[this.model]?.dimension || 1536;

    // Use provided API key, or fall back to OPENAI_API_KEY setting
    this.apiKey = config.apiKey || settings.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
    this.baseUrl = config.baseUrl || settings.OPENAI_BASE_URL || 'https://api.openai.com/v1';

    if (!this.apiKey) {
      throw new Error(
        'OpenAI API key required. Set OPENAI_API_KEY in settings or provide apiKey in config.'
      );
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Initializing OpenAI embedding provider...', { model: this.model });

    try {
      // Verify connection by making a small test request
      await this.embedSingle('test');

      this.initialized = true;
      logger.info('OpenAI embedding provider initialized', {
        model: this.model,
        dimension: this.dimension,
      });
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to initialize OpenAI embedding provider', {
        error: err.message,
      });
      throw error;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const url = `${this.baseUrl.replace(/\/$/, '')}/embeddings`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI Embeddings API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json() as {
      data: Array<{
        embedding: number[];
        index: number;
      }>;
      model: string;
      usage: {
        prompt_tokens: number;
        total_tokens: number;
      };
    };

    // Sort by index to ensure correct order
    const sorted = data.data.sort((a, b) => a.index - b.index);
    return sorted.map((item) => item.embedding);
  }

  async embedSingle(text: string): Promise<number[]> {
    const [embedding] = await this.embed([text]);
    return embedding;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async close(): Promise<void> {
    this.initialized = false;
    logger.debug('OpenAI embedding provider closed');
  }
}

/**
 * Create an OpenAI embedding provider
 */
export function createOpenAIProvider(config?: EmbeddingProviderConfig): EmbeddingProvider {
  return new OpenAIEmbeddingProvider(config);
}

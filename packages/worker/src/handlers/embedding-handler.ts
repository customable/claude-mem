/**
 * Embedding Handler
 *
 * Processes text embedding tasks.
 * Generates vector embeddings for texts using the configured embedding provider.
 * Supports multiple providers via the embedding registry (Issue #112).
 */

import { createLogger } from '@claude-mem/shared';
import type { EmbeddingTaskPayload, EmbeddingTask } from '@claude-mem/types';
import { getEmbeddingProvider } from '../embeddings/index.js';

const logger = createLogger('embedding-handler');

/**
 * Handle an embedding task
 */
export async function handleEmbeddingTask(
  payload: EmbeddingTaskPayload,
  signal?: AbortSignal
): Promise<EmbeddingTask['result']> {
  // Check for cancellation
  if (signal?.aborted) {
    throw new Error('Task cancelled');
  }

  const texts = payload.texts || [];

  if (texts.length === 0) {
    logger.debug('No texts to embed');
    return {
      embeddings: [],
      model: 'none',
      tokens: 0,
    };
  }

  logger.debug(`Embedding ${texts.length} texts`);

  // Get embedding provider from registry
  const provider = getEmbeddingProvider();
  await provider.initialize();

  // Generate embeddings using the configured provider
  const embeddings = await provider.embed(texts);

  // Rough token estimate: ~4 chars per token
  const totalTokens = texts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);

  logger.info(`Generated ${embeddings.length} embeddings`, {
    provider: provider.name,
    dimension: provider.dimension,
  });

  return {
    embeddings,
    model: provider.name,
    tokens: totalTokens,
  };
}

/**
 * Embedding Handler
 *
 * Processes text embedding tasks.
 * Generates vector embeddings for texts using the configured embedding model.
 */

import { createLogger } from '@claude-mem/shared';
import type { EmbeddingTaskPayload, EmbeddingTask } from '@claude-mem/types';
import { getQdrantService } from '../services/qdrant-service.js';

const logger = createLogger('embedding-handler');

/**
 * Handle an embedding task
 */
export async function handleEmbeddingTask(
  payload: EmbeddingTaskPayload
): Promise<EmbeddingTask['result']> {
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

  const qdrantService = getQdrantService();
  await qdrantService.initialize();

  // Generate embeddings using the Qdrant service's embedding model
  const embeddings = await qdrantService.embed(texts);

  // Rough token estimate: ~4 chars per token
  const totalTokens = texts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);

  logger.info(`Generated ${embeddings.length} embeddings`);

  return {
    embeddings,
    model: 'Xenova/all-MiniLM-L6-v2',
    tokens: totalTokens,
  };
}

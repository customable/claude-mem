/**
 * Semantic Search Handler (Issue #112)
 *
 * Processes semantic search tasks using the vector database.
 * Returns similar observations/summaries based on embedding similarity.
 * Uses the provider-agnostic VectorDatabase interface.
 */

import { createLogger } from '@claude-mem/shared';
import type { SemanticSearchTaskPayload, SemanticSearchTask } from '@claude-mem/types';
import type { VectorDatabase } from '../vector-db/index.js';

const logger = createLogger('semantic-search-handler');

/**
 * Result of semantic search operation
 */
export type SemanticSearchResult = NonNullable<SemanticSearchTask['result']>;

/**
 * Handle a semantic search task
 *
 * Uses the provider-agnostic VectorDatabase interface to support
 * multiple backends (Qdrant, sqlite-vec, etc.) via Issue #112.
 */
export async function handleSemanticSearchTask(
  vectorDb: VectorDatabase,
  payload: SemanticSearchTaskPayload,
  signal?: AbortSignal
): Promise<SemanticSearchResult> {
  // Check for cancellation
  if (signal?.aborted) {
    throw new Error('Task cancelled');
  }

  const startTime = Date.now();

  logger.info('Processing semantic search', {
    query: payload.query.slice(0, 100),
    project: payload.project,
    limit: payload.limit,
  });

  // Initialize vector database (loads embedding model, ensures collection)
  await vectorDb.initialize();

  // Build filter for search
  const filter: { type?: string; project?: string } = {};
  if (payload.project) {
    filter.project = payload.project;
  }
  // Note: Qdrant filter supports single type, for multiple types we'd need OR logic
  // For now, if types are specified, we use the first one (can be enhanced later)
  if (payload.types && payload.types.length > 0) {
    filter.type = payload.types[0];
  }

  // Perform vector similarity search
  const searchResults = await vectorDb.search(payload.query, {
    limit: payload.limit || 20,
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    scoreThreshold: payload.minScore || 0.5,
  });

  // Transform results to task result format
  const results = searchResults.map(r => {
    // Parse ID to get observation/summary ID
    const idParts = r.id.split('-');
    const docType = idParts[0]; // 'observation' or 'summary'
    const docId = parseInt(idParts[1], 10);

    // Get text from metadata (text field is added during upsert)
    const metadataText = r.metadata['text'] as string | undefined;
    const text = metadataText || '';

    return {
      id: docId,
      type: docType,
      title: text.split('\n')[0] || 'Untitled', // First line as title
      text,
      score: r.score,
      project: r.metadata.project,
      createdAt: r.metadata.createdAt ? new Date(r.metadata.createdAt).getTime() : Date.now(),
    };
  });

  const durationMs = Date.now() - startTime;

  logger.info('Semantic search completed', {
    query: payload.query.slice(0, 50),
    resultsFound: results.length,
    durationMs,
  });

  return {
    results,
    query: payload.query,
    totalFound: results.length,
    durationMs,
  };
}

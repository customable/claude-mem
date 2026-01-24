/**
 * Qdrant Sync Handler
 *
 * Processes Qdrant vector database synchronization tasks.
 * Syncs observations and summaries to the vector store for semantic search.
 */

import { createLogger } from '@claude-mem/shared';
import type { QdrantSyncTaskPayload, QdrantSyncTask } from '@claude-mem/types';
import { QdrantService, type VectorDocument } from '../services/qdrant-service.js';

const logger = createLogger('qdrant-handler');

/**
 * Result of Qdrant sync operation
 */
export type QdrantSyncResult = NonNullable<QdrantSyncTask['result']>;

/**
 * Data provider interface for fetching observations/summaries
 */
export interface DataProvider {
  fetchObservations(ids: number[]): Promise<Array<{
    id: number;
    title: string;
    text: string;
    type: string;
    project: string;
    sessionId: string;
    createdAt: string;
  }>>;
  fetchSummaries(ids: number[]): Promise<Array<{
    id: number;
    request: string;
    learned: string;
    project: string;
    sessionId: string;
    createdAt: string;
  }>>;
  fetchAllObservations(project?: string): Promise<Array<{
    id: number;
    title: string;
    text: string;
    type: string;
    project: string;
    sessionId: string;
    createdAt: string;
  }>>;
  fetchAllSummaries(project?: string): Promise<Array<{
    id: number;
    request: string;
    learned: string;
    project: string;
    sessionId: string;
    createdAt: string;
  }>>;
}

/**
 * Handle a Qdrant sync task
 */
export async function handleQdrantSyncTask(
  qdrantService: QdrantService,
  payload: QdrantSyncTaskPayload,
  signal?: AbortSignal,
  dataProvider?: DataProvider
): Promise<QdrantSyncResult> {
  // Check for cancellation
  if (signal?.aborted) {
    throw new Error('Task cancelled');
  }

  const startTime = Date.now();

  // Initialize Qdrant service (loads embedding model, ensures collection)
  await qdrantService.initialize();

  let documentsProcessed = 0;
  let documentsAdded = 0;
  let documentsUpdated = 0;
  let documentsDeleted = 0;

  if (payload.mode === 'full') {
    // Full sync: Clear existing documents for project and re-sync
    if (payload.project) {
      await qdrantService.deleteByFilter({ project: payload.project });
      logger.info('Cleared existing documents for project', { project: payload.project });
      documentsDeleted++; // Approximate - could be many
    }

    if (dataProvider) {
      // Fetch and sync all observations
      const observations = await dataProvider.fetchAllObservations(payload.project);
      if (observations.length > 0) {
        const observationDocs = observations.map(obs => observationToDocument(obs));
        await qdrantService.upsert(observationDocs);
        documentsAdded += observations.length;
        documentsProcessed += observations.length;
        logger.info('Synced observations', { count: observations.length });
      }

      // Fetch and sync all summaries
      const summaries = await dataProvider.fetchAllSummaries(payload.project);
      if (summaries.length > 0) {
        const summaryDocs = summaries.map(sum => summaryToDocument(sum));
        await qdrantService.upsert(summaryDocs);
        documentsAdded += summaries.length;
        documentsProcessed += summaries.length;
        logger.info('Synced summaries', { count: summaries.length });
      }
    } else {
      logger.warn('Full sync requires data provider - not available');
    }

  } else if (payload.mode === 'incremental') {
    // Incremental sync: Only sync specified IDs
    if (dataProvider) {
      if (payload.observationIds && payload.observationIds.length > 0) {
        const observations = await dataProvider.fetchObservations(payload.observationIds);
        if (observations.length > 0) {
          const docs = observations.map(obs => observationToDocument(obs));
          await qdrantService.upsert(docs);
          documentsUpdated += observations.length;
          documentsProcessed += observations.length;
          logger.info('Synced observations', { count: observations.length });
        }
      }

      if (payload.summaryIds && payload.summaryIds.length > 0) {
        const summaries = await dataProvider.fetchSummaries(payload.summaryIds);
        if (summaries.length > 0) {
          const docs = summaries.map(sum => summaryToDocument(sum));
          await qdrantService.upsert(docs);
          documentsUpdated += summaries.length;
          documentsProcessed += summaries.length;
          logger.info('Synced summaries', { count: summaries.length });
        }
      }
    } else {
      logger.warn('Incremental sync requires data provider - not available');
    }
  }

  const durationMs = Date.now() - startTime;

  logger.info('Qdrant sync completed', {
    mode: payload.mode,
    project: payload.project,
    documentsProcessed,
    durationMs,
  });

  return {
    documentsProcessed,
    documentsAdded,
    documentsUpdated,
    documentsDeleted,
    durationMs,
  };
}

/**
 * Convert an observation to a vector document
 */
function observationToDocument(obs: {
  id: number;
  title: string;
  text: string;
  type: string;
  project: string;
  sessionId: string;
  createdAt: string;
}): VectorDocument {
  // Combine title and text for better embedding
  const text = `${obs.title}\n\n${obs.text}`;

  return {
    id: `observation-${obs.id}`,
    text,
    metadata: {
      type: 'observation',
      project: obs.project,
      sessionId: obs.sessionId,
      observationId: obs.id,
      createdAt: obs.createdAt,
      observationType: obs.type,
    },
  };
}

/**
 * Convert a summary to a vector document
 */
function summaryToDocument(sum: {
  id: number;
  request: string;
  learned: string;
  project: string;
  sessionId: string;
  createdAt: string;
}): VectorDocument {
  // Combine request and learned for better embedding
  const text = `Request: ${sum.request}\n\nLearned: ${sum.learned}`;

  return {
    id: `summary-${sum.id}`,
    text,
    metadata: {
      type: 'summary',
      project: sum.project,
      sessionId: sum.sessionId,
      summaryId: sum.id,
      createdAt: sum.createdAt,
    },
  };
}

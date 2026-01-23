/**
 * Stop Hook Handler
 *
 * Called when session stops.
 * Triggers session summarization.
 */

import { createLogger } from '@claude-mem/shared';
import { getBackendClient } from '../client.js';
import type { HookInput, HookResult } from '../types.js';
import { success, skip } from '../types.js';

const logger = createLogger('hook:stop');

/**
 * Summarize response from backend
 */
interface SummarizeResponse {
  queued: boolean;
  taskId?: string;
}

/**
 * Handle stop
 */
export async function handleStop(input: HookInput): Promise<HookResult> {
  const client = getBackendClient();

  // Check if backend is available
  const ready = await client.isCoreReady();
  if (!ready) {
    logger.debug('Backend not ready, skipping summarization');
    return skip();
  }

  try {
    // Request summarization
    const response = await client.post<SummarizeResponse>('/api/hooks/summarize', {
      sessionId: input.sessionId,
      project: input.project,
    });

    if (response.queued) {
      logger.debug(`Summarization queued: ${response.taskId}`);
    }

    return success();
  } catch (err) {
    const error = err as Error;
    logger.warn('Failed to request summarization:', { message: error.message });
    return skip();
  }
}

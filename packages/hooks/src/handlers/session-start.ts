/**
 * SessionStart Hook Handler
 *
 * Called when a new Claude Code session starts.
 * Injects relevant context from previous sessions.
 */

import { createLogger } from '@claude-mem/shared';
import { getBackendClient } from '../client.js';
import type { HookInput, HookResult } from '../types.js';
import { success, skip } from '../types.js';

const logger = createLogger('hook:session-start');

/**
 * Context response from backend
 */
interface ContextResponse {
  context: string;
  observationCount: number;
  tokens: number;
}

/**
 * Handle session start
 */
export async function handleSessionStart(input: HookInput): Promise<HookResult> {
  const client = getBackendClient();

  // Check if backend is available (non-blocking)
  const ready = await client.isCoreReady();
  if (!ready) {
    logger.debug('Backend not ready, skipping context injection');
    return skip();
  }

  try {
    // Get context for this project
    const response = await client.get<ContextResponse>('/api/hooks/context', {
      project: input.project,
    });

    if (!response.context || response.observationCount === 0) {
      logger.debug('No context available for project');
      return skip();
    }

    logger.info(`Injecting context: ${response.observationCount} observations, ${response.tokens} tokens`);

    return success(response.context);
  } catch (err) {
    const error = err as Error;
    logger.warn('Failed to get context:', { message: error.message });
    return skip(); // Don't block session start
  }
}

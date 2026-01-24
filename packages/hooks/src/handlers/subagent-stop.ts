/**
 * Subagent Stop Hook Handler
 *
 * Called when a subagent (Task tool agent) stops.
 * Records subagent completion for context tracking.
 */

import { createLogger } from '@claude-mem/shared';
import { getBackendClient } from '../client.js';
import type { HookInput, HookResult } from '../types.js';
import { success, skip } from '../types.js';

const logger = createLogger('hook:subagent-stop');

/**
 * Subagent stop response from backend
 */
interface SubagentStopResponse {
  success: boolean;
}

/**
 * Handle subagent stop
 */
export async function handleSubagentStop(input: HookInput): Promise<HookResult> {
  const client = getBackendClient();

  // Check if backend is available
  const ready = await client.isCoreReady();
  if (!ready) {
    logger.debug('Backend not ready, skipping subagent completion');
    return skip();
  }

  try {
    // Record subagent stop
    await client.post<SubagentStopResponse>('/api/hooks/subagent/stop', {
      sessionId: input.sessionId,
      subagentId: input.subagentId,
      subagentType: input.subagentType,
    });

    logger.info(`Subagent ${input.subagentId} stopped (type: ${input.subagentType})`);
    return success();
  } catch (err) {
    const error = err as Error;
    logger.warn('Failed to record subagent stop:', { message: error.message });
    // Fail-open: don't block subagent completion
    return skip();
  }
}

/**
 * Subagent Start Hook Handler
 *
 * Called when a subagent (Task tool agent) starts.
 * Records subagent lifecycle for context tracking.
 */

import { createLogger } from '@claude-mem/shared';
import { getBackendClient } from '../client.js';
import type { HookInput, HookResult } from '../types.js';
import { success, skip } from '../types.js';

const logger = createLogger('hook:subagent-start');

/**
 * Subagent start response from backend
 */
interface SubagentStartResponse {
  success: boolean;
  subagentId?: string;
}

/**
 * Handle subagent start
 */
export async function handleSubagentStart(input: HookInput): Promise<HookResult> {
  const client = getBackendClient();

  // Check if backend is available
  const ready = await client.isCoreReady();
  if (!ready) {
    logger.debug('Backend not ready, skipping subagent tracking');
    return skip();
  }

  try {
    // Record subagent start
    await client.post<SubagentStartResponse>('/api/hooks/subagent/start', {
      sessionId: input.sessionId,
      subagentId: input.subagentId,
      subagentType: input.subagentType,
      parentSessionId: input.parentSessionId || input.sessionId,
      cwd: input.cwd,
    });

    logger.info(`Subagent ${input.subagentId} started (type: ${input.subagentType})`);
    return success();
  } catch (err) {
    const error = err as Error;
    logger.warn('Failed to record subagent start:', { message: error.message });
    // Fail-open: don't block subagent creation
    return skip();
  }
}

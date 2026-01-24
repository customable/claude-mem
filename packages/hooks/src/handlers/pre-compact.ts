/**
 * Pre-Compact Hook Handler
 *
 * Called before Claude Code's automatic context compaction.
 * Preserves context by extracting unprocessed observations
 * and storing compaction events.
 *
 * Exit codes:
 * - 0: Allow compaction to proceed
 * - 2: Block compaction (e.g., critical context not yet processed)
 */

import { createLogger } from '@claude-mem/shared';
import { getBackendClient } from '../client.js';
import type { HookInput, HookResult } from '../types.js';
import { success, skip, error } from '../types.js';

const logger = createLogger('hook:pre-compact');

/**
 * Pre-compact response from backend
 */
interface PreCompactResponse {
  success: boolean;
  /** Number of observations extracted before compaction */
  observationsExtracted?: number;
  /** Whether compaction should be blocked */
  blockCompaction?: boolean;
  /** Reason for blocking (if blocked) */
  blockReason?: string;
}

/**
 * Handle pre-compact event
 *
 * This hook is called before Claude Code compacts the context.
 * It preserves important context by:
 * 1. Extracting any pending observations from the transcript
 * 2. Recording the compaction event
 * 3. Optionally blocking compaction if critical context hasn't been processed
 */
export async function handlePreCompact(input: HookInput): Promise<HookResult> {
  const client = getBackendClient();

  // Check if backend is available
  const ready = await client.isCoreReady();
  if (!ready) {
    logger.debug('Backend not ready, allowing compaction');
    return skip();
  }

  try {
    // Notify backend of pre-compact event
    const response = await client.post<PreCompactResponse>('/api/hooks/pre-compact', {
      sessionId: input.sessionId,
      transcriptPath: input.transcriptPath,
    });

    if (response.observationsExtracted) {
      logger.debug(`Extracted ${response.observationsExtracted} observations before compaction`);
    }

    // Check if backend wants to block compaction
    if (response.blockCompaction) {
      logger.info(`Blocking compaction: ${response.blockReason || 'Critical context not processed'}`);
      // Exit code 2 blocks the action in Claude Code hooks
      return error(response.blockReason || 'Compaction blocked - critical context pending');
    }

    logger.debug(`Pre-compact completed for session ${input.sessionId}`);
    return success();
  } catch (err) {
    const e = err as Error;
    logger.warn('Pre-compact hook failed:', { message: e.message });
    // On error, allow compaction to proceed (fail-open)
    return skip();
  }
}

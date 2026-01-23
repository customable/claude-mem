/**
 * Stop Hook Handler
 *
 * Called when session stops.
 * Triggers session summarization and cleans up SSE writer.
 */

import * as fs from 'fs';
import { createLogger } from '@claude-mem/shared';
import { getBackendClient } from '../client.js';
import { getSseWriterPidPath } from './session-start.js';
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
 * Clean up stale PID file for SSE writer (if process already exited)
 * Note: We don't kill the SSE writer here because it needs to stay alive
 * to receive the claudemd:ready event after summarization completes.
 * The SSE writer exits on its own after writing CLAUDE.md or after timeout.
 */
function cleanupStalePidFile(sessionId: string): void {
  const pidPath = getSseWriterPidPath(sessionId);

  if (!fs.existsSync(pidPath)) {
    return;
  }

  try {
    const pid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim(), 10);

    if (isNaN(pid)) {
      // Invalid PID file, clean it up
      fs.unlinkSync(pidPath);
      return;
    }

    // Check if process is still running
    try {
      // Sending signal 0 checks if process exists without killing it
      process.kill(pid, 0);
      // Process is still running - that's expected, don't clean up
      logger.debug(`SSE writer (PID: ${pid}) is still running, will self-exit after task completes`);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'ESRCH') {
        // Process not found - clean up stale PID file
        fs.unlinkSync(pidPath);
        logger.debug('Cleaned up stale SSE writer PID file');
      }
    }
  } catch (err) {
    const error = err as Error;
    logger.warn('Error checking SSE writer status:', { message: error.message });
  }
}

/**
 * Handle stop
 */
export async function handleStop(input: HookInput): Promise<HookResult> {
  const client = getBackendClient();

  // Clean up stale PID file if process already exited
  // Note: We don't kill the SSE writer - it needs to wait for claudemd:ready
  cleanupStalePidFile(input.sessionId);

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

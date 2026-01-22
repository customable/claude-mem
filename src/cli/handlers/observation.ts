/**
 * Observation Handler - PostToolUse
 *
 * Extracted from save-hook.ts - sends tool usage to worker for storage.
 */

import type { EventHandler, NormalizedHookInput, HookResult } from '../types.js';
import { tryEnsureWorkerRunning, getWorkerBaseUrl } from '../../shared/worker-utils.js';
import { fetchWithRetry } from '../../shared/fetch-utils.js';
import { isProjectExcluded, isMemoryDisabledByProjectConfig } from '../../shared/project-exclusion.js';
import { getProjectName } from '../../utils/project-name.js';
import { logger } from '../../utils/logger.js';

export const observationHandler: EventHandler = {
  async execute(input: NormalizedHookInput): Promise<HookResult> {
    // Try to ensure worker is running with a short timeout (2 seconds)
    // Observations are non-critical - if worker is not ready, skip silently
    const workerStatus = await tryEnsureWorkerRunning(2000);
    if (!workerStatus.ready) {
      logger.debug('HOOK', 'observation: Worker not ready, skipping observation', {
        waited: workerStatus.waited
      });
      return { continue: true, suppressOutput: true };
    }

    const { sessionId, cwd, toolName, toolInput, toolResponse } = input;

    if (!toolName) {
      throw new Error('observationHandler requires toolName');
    }

    // Check if memory is disabled via project-level .claude-mem.json (highest priority)
    if (isMemoryDisabledByProjectConfig(cwd)) {
      logger.debug('HOOK', 'observation: Memory disabled by .claude-mem.json', { cwd });
      return { continue: true, suppressOutput: true };
    }

    // Check if project is excluded by glob pattern (global setting)
    const project = getProjectName(cwd);
    if (isProjectExcluded(project)) {
      logger.debug('HOOK', 'observation: Project excluded by CLAUDE_MEM_EXCLUDE_PROJECTS', { project });
      return { continue: true, suppressOutput: true };
    }

    const baseUrl = getWorkerBaseUrl();

    const toolStr = logger.formatTool(toolName, toolInput);

    logger.dataIn('HOOK', `PostToolUse: ${toolStr}`, {
      workerUrl: baseUrl
    });

    // Validate required fields before sending to worker
    if (!cwd) {
      throw new Error(`Missing cwd in PostToolUse hook input for session ${sessionId}, tool ${toolName}`);
    }

    // Send to worker - worker handles privacy check and database operations
    const response = await fetchWithRetry(`${baseUrl}/api/sessions/observations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentSessionId: sessionId,
        tool_name: toolName,
        tool_input: toolInput,
        tool_response: toolResponse,
        cwd
      })
      // Note: Removed signal to avoid Windows Bun cleanup issue (libuv assertion)
    });

    if (!response.ok) {
      throw new Error(`Observation storage failed: ${response.status}`);
    }

    logger.debug('HOOK', 'Observation sent successfully', { toolName });

    return { continue: true, suppressOutput: true };
  }
};

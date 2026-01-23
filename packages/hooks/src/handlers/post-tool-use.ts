/**
 * PostToolUse Hook Handler
 *
 * Called after each tool use.
 * Sends tool usage to backend for observation extraction.
 */

import { execSync } from 'child_process';
import { createLogger } from '@claude-mem/shared';
import { getBackendClient } from '../client.js';
import type { HookInput, HookResult } from '../types.js';
import { success, skip } from '../types.js';

const logger = createLogger('hook:post-tool-use');

/**
 * Tools to ignore (pure routing/introspection, no actionable content)
 */
const IGNORED_TOOLS = new Set([
  'ListMcpResourcesTool', // MCP introspection only
  'SlashCommand',         // Command routing only
  'Skill',                // Skill routing only
  'AskFollowupQuestion',  // Internal tool
]);

/**
 * Claude-mem's own MCP tool prefix (exclude to avoid circular observations)
 */
const CLAUDE_MEM_MCP_PREFIX = 'mcp__plugin_claude-mem_';

/**
 * Check if a tool should be captured
 */
function shouldCaptureToolUse(toolName: string): boolean {
  // Skip meta-tools
  if (IGNORED_TOOLS.has(toolName)) {
    return false;
  }

  // Skip claude-mem's own MCP tools (avoid circular observations)
  if (toolName.startsWith(CLAUDE_MEM_MCP_PREFIX)) {
    return false;
  }

  // Capture everything else (native tools + external MCP tools)
  return true;
}

/**
 * Observation response from backend
 */
interface ObservationResponse {
  queued: boolean;
  taskId?: string;
}

/**
 * Get current git branch for a directory
 */
function getGitBranch(cwd: string): string | undefined {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd,
      encoding: 'utf-8',
      timeout: 1000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return branch || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Handle post tool use
 */
export async function handlePostToolUse(input: HookInput): Promise<HookResult> {
  // Skip tools that shouldn't be captured
  if (!input.toolName || !shouldCaptureToolUse(input.toolName)) {
    return skip();
  }

  const client = getBackendClient();

  // Check if backend is available (short timeout - don't slow down tool flow)
  const ready = await client.isCoreReady();
  if (!ready) {
    logger.debug('Backend not ready, skipping observation');
    return skip();
  }

  try {
    // Get git branch for context
    const gitBranch = getGitBranch(input.cwd);

    // Send observation
    const response = await client.post<ObservationResponse>('/api/hooks/observation', {
      sessionId: input.sessionId,
      project: input.project,
      toolName: input.toolName,
      toolInput: input.toolInput || '',
      toolOutput: input.toolOutput || '',
      gitBranch,
    });

    if (response.queued) {
      logger.debug(`Observation queued: ${response.taskId}`);
    }

    return success();
  } catch (err) {
    const error = err as Error;
    logger.warn('Failed to send observation:', { message: error.message });
    return skip(); // Don't block tool flow
  }
}

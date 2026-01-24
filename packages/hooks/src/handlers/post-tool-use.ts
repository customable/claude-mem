/**
 * PostToolUse Hook Handler
 *
 * Called after each tool use.
 * Sends tool usage to backend for observation extraction.
 */

import { execSync } from 'child_process';
import * as path from 'path';
import {
  createLogger,
  loadSettings,
  processSecrets,
  createSecretsSummary,
  type SecretDetectorConfig,
} from '@claude-mem/shared';
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
 * Extract target directory from tool input.
 * Returns the directory where the tool operated (not the cwd).
 */
function extractTargetDirectory(toolInput: string): string | undefined {
  try {
    const input = JSON.parse(toolInput);

    // File-based tools: Read, Write, Edit, NotebookEdit
    if (input.file_path) {
      return path.dirname(input.file_path);
    }

    // Path-based tools: Glob, Grep
    if (input.path) {
      return input.path;
    }

    // Notebook tools
    if (input.notebook_path) {
      return path.dirname(input.notebook_path);
    }

    return undefined;
  } catch {
    return undefined;
  }
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

    // Extract target directory from tool input (for subdirectory CLAUDE.md)
    const targetDirectory = extractTargetDirectory(input.toolInput || '');

    // Process tool input and output for secrets
    const settings = loadSettings();
    const secretConfig: SecretDetectorConfig = {
      enabled: settings.SECRET_DETECTION_ENABLED,
      mode: settings.SECRET_DETECTION_MODE,
    };

    let toolInput = input.toolInput || '';
    let toolOutput = input.toolOutput || '';

    if (secretConfig.enabled) {
      const inputResult = processSecrets(toolInput, secretConfig);
      const outputResult = processSecrets(toolOutput, secretConfig);

      // Log if secrets were detected
      if (inputResult.secretsFound) {
        logger.warn(`Secrets detected in tool input: ${createSecretsSummary(inputResult.matches)}`);
      }
      if (outputResult.secretsFound) {
        logger.warn(`Secrets detected in tool output: ${createSecretsSummary(outputResult.matches)}`);
      }

      // Handle based on mode
      if (secretConfig.mode === 'skip' && (inputResult.secretsFound || outputResult.secretsFound)) {
        logger.info('Skipping observation due to detected secrets');
        return skip();
      }

      // Use processed (potentially redacted) text
      toolInput = inputResult.text;
      toolOutput = outputResult.text;
    }

    // Send observation
    const response = await client.post<ObservationResponse>('/api/hooks/observation', {
      sessionId: input.sessionId,
      project: input.project,
      toolName: input.toolName,
      toolInput,
      toolOutput,
      gitBranch,
      cwd: input.cwd,
      targetDirectory,
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

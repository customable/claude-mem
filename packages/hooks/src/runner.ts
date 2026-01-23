/**
 * Hook Runner
 *
 * Executes hook handlers based on input.
 * Handles stdin parsing, project detection, and output formatting.
 */

import { basename } from 'path';
import { createLogger } from '@claude-mem/shared';
import type { HookEvent, HookInput, HookResult } from './types.js';
import { skip, error } from './types.js';
import { getHandler } from './handlers/index.js';

const logger = createLogger('hook-runner');

/**
 * Claude Code hook input (from stdin)
 */
interface ClaudeCodeInput {
  session_id?: string;
  sessionId?: string;
  cwd?: string;
  prompt?: string;
  tool_name?: string;
  toolName?: string;
  tool_input?: unknown;
  toolInput?: unknown;
  tool_response?: unknown;
  toolResponse?: unknown;
  transcript_path?: string;
  transcriptPath?: string;
}

/**
 * Detect project name from working directory
 */
function detectProject(cwd: string): string {
  // Use directory name as project
  return basename(cwd) || 'unknown';
}

/**
 * Stringify value for tool input/output
 */
function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Parse input from stdin
 */
export function parseInput(event: HookEvent, raw: unknown): HookInput {
  const input = (raw || {}) as ClaudeCodeInput;

  const cwd = input.cwd || process.cwd();
  const sessionId = input.session_id || input.sessionId || 'unknown';

  return {
    event,
    sessionId,
    cwd,
    project: detectProject(cwd),
    prompt: input.prompt,
    toolName: input.tool_name || input.toolName,
    toolInput: stringify(input.tool_input || input.toolInput),
    toolOutput: stringify(input.tool_response || input.toolResponse),
    transcriptPath: input.transcript_path || input.transcriptPath,
    raw,
  };
}

/**
 * Read JSON from stdin
 */
export async function readStdin(): Promise<unknown> {
  return new Promise((resolve) => {
    let data = '';
    let resolved = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const safeResolve = (value: unknown) => {
      if (resolved) return;
      resolved = true;
      if (timeoutId) clearTimeout(timeoutId);
      resolve(value);
    };

    // Handle case where stdin is not available (session-start)
    if (process.stdin.isTTY) {
      safeResolve({});
      return;
    }

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
      // Cancel timeout once we start receiving data
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    });
    process.stdin.on('end', () => {
      if (!data.trim()) {
        safeResolve({});
        return;
      }
      try {
        safeResolve(JSON.parse(data));
      } catch {
        logger.warn('Failed to parse stdin as JSON');
        safeResolve({});
      }
    });
    process.stdin.on('error', () => {
      safeResolve({});
    });

    // Timeout for stdin (session-start may not provide any)
    // This only fires if no data arrives within 100ms
    timeoutId = setTimeout(() => {
      safeResolve({});
    }, 100);
  });
}

/**
 * Run a hook
 */
export async function runHook(event: HookEvent, rawInput?: unknown): Promise<HookResult> {
  // Read from stdin if no input provided
  const raw = rawInput ?? await readStdin();

  // Parse input
  const input = parseInput(event, raw);

  logger.debug(`Running hook: ${event} for session ${input.sessionId}`);

  // Get handler
  const handler = getHandler(event);
  if (!handler) {
    logger.warn(`No handler for event: ${event}`);
    return skip();
  }

  try {
    // Run handler
    const result = await handler(input);

    // Output
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    return result;
  } catch (err) {
    const e = err as Error;
    logger.error('Hook handler error:', { message: e.message, stack: e.stack });
    return error(`Hook error: ${e.message}`);
  }
}

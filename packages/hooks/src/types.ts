/**
 * Hook Types
 *
 * Common types for the hook system.
 * Designed for easy extension to new platforms and events.
 */

/**
 * Supported hook events
 */
export type HookEvent =
  | 'session-start'
  | 'user-prompt-submit'
  | 'post-tool-use'
  | 'stop'
  | 'session-end';

/**
 * Normalized hook input (platform-agnostic)
 */
export interface HookInput {
  /** Event type */
  event: HookEvent;
  /** Session ID */
  sessionId: string;
  /** Working directory */
  cwd: string;
  /** Project name (derived from cwd) */
  project: string;
  /** User prompt (session-start, user-prompt-submit) */
  prompt?: string;
  /** Tool name (post-tool-use) */
  toolName?: string;
  /** Tool input (post-tool-use) */
  toolInput?: string;
  /** Tool output (post-tool-use) */
  toolOutput?: string;
  /** Transcript path (stop, session-end) */
  transcriptPath?: string;
  /** Raw platform-specific data */
  raw?: unknown;
}

/**
 * Hook result
 */
export interface HookResult {
  /** Exit code (0=success, 1=warning, 2=error) */
  exitCode: number;
  /** Output to stdout (injected into Claude context) */
  stdout?: string;
  /** Output to stderr (shown to user) */
  stderr?: string;
  /** Should continue processing */
  continue?: boolean;
}

/**
 * Hook handler function
 */
export type HookHandler = (input: HookInput) => Promise<HookResult>;

/**
 * Hook handler registry
 */
export type HookHandlerRegistry = Partial<Record<HookEvent, HookHandler>>;

/**
 * Success result helper
 */
export function success(stdout?: string): HookResult {
  return { exitCode: 0, stdout, continue: true };
}

/**
 * Warning result helper
 */
export function warning(message: string): HookResult {
  return { exitCode: 1, stderr: message, continue: true };
}

/**
 * Error result helper
 */
export function error(message: string): HookResult {
  return { exitCode: 2, stderr: message, continue: false };
}

/**
 * Skip result (no action needed)
 */
export function skip(): HookResult {
  return { exitCode: 0, continue: true };
}

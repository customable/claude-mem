/**
 * @claude-mem/hooks
 *
 * Claude Code hooks for claude-mem.
 */

// Types
export * from './types.js';

// Client
export { BackendClient, getBackendClient, resetBackendClient } from './client.js';

// Runner
export { runHook, parseInput, readStdin } from './runner.js';

// Handlers
export {
  getHandler,
  registerHandler,
  getRegisteredEvents,
  handleSessionStart,
  handleUserPromptSubmit,
  handlePostToolUse,
  handleStop,
} from './handlers/index.js';

/**
 * Hook Handlers
 *
 * Central registry for all hook handlers.
 * Easy to extend with new events.
 */

import type { HookEvent, HookHandler, HookHandlerRegistry } from '../types.js';
import { handleSessionStart } from './session-start.js';
import { handleUserPromptSubmit } from './user-prompt-submit.js';
import { handlePostToolUse } from './post-tool-use.js';
import { handleStop } from './stop.js';

/**
 * Default handler registry
 */
const defaultHandlers: HookHandlerRegistry = {
  'session-start': handleSessionStart,
  'user-prompt-submit': handleUserPromptSubmit,
  'post-tool-use': handlePostToolUse,
  'stop': handleStop,
  // session-end can use the same as stop, or be customized
  'session-end': handleStop,
};

/**
 * Custom handlers (for extension)
 */
const customHandlers: HookHandlerRegistry = {};

/**
 * Get handler for an event
 */
export function getHandler(event: HookEvent): HookHandler | undefined {
  return customHandlers[event] || defaultHandlers[event];
}

/**
 * Register a custom handler (for extension)
 */
export function registerHandler(event: HookEvent, handler: HookHandler): void {
  customHandlers[event] = handler;
}

/**
 * Get all registered events
 */
export function getRegisteredEvents(): HookEvent[] {
  const events = new Set([
    ...Object.keys(defaultHandlers),
    ...Object.keys(customHandlers),
  ]) as Set<HookEvent>;
  return Array.from(events);
}

// Re-export individual handlers
export { handleSessionStart } from './session-start.js';
export { handleUserPromptSubmit } from './user-prompt-submit.js';
export { handlePostToolUse } from './post-tool-use.js';
export { handleStop } from './stop.js';

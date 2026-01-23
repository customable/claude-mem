#!/usr/bin/env node
/**
 * Plugin Entry Point
 *
 * Compatibility layer for plugin hooks.json format.
 * Maps fork-style commands to monorepo hooks.
 *
 * Commands:
 *   start                      - Ensure backend is running
 *   hook claude-code <event>   - Run hook event
 *
 * Event mapping:
 *   context      -> session-start
 *   user-message -> user-prompt-submit
 *   session-init -> user-prompt-submit
 *   observation  -> post-tool-use
 *   summarize    -> stop
 */

import type { HookEvent } from './types.js';
import { runHook } from './runner.js';
import { getBackendClient } from './client.js';

// Version injected at build time
declare const __PLUGIN_VERSION__: string;
const version = typeof __PLUGIN_VERSION__ !== 'undefined' ? __PLUGIN_VERSION__ : '0.0.0-dev';

/**
 * Map fork-style events to monorepo events
 */
const EVENT_MAP: Record<string, HookEvent> = {
  'context': 'session-start',
  'user-message': 'user-prompt-submit',
  'session-init': 'user-prompt-submit',
  'observation': 'post-tool-use',
  'summarize': 'stop',
};

/**
 * Start/health check the backend
 */
async function ensureBackend(): Promise<void> {
  try {
    const client = getBackendClient();
    const isReady = await client.isCoreReady();
    if (isReady) {
      // Backend is running and healthy
      return;
    }
    console.error('Backend not ready. Please start the backend service.');
  } catch {
    // Backend not responding - try to start it
    console.error('Backend not available. Please start the backend service.');
    // For now, just exit - TODO: implement daemon spawning
  }
}

/**
 * Handle hook command
 */
async function handleHook(args: string[]): Promise<number> {
  // Expected: hook claude-code <event>
  if (args.length < 2) {
    console.error('Usage: hook claude-code <event>');
    return 1;
  }

  const adapter = args[0]; // e.g., 'claude-code'
  const forkEvent = args[1]; // e.g., 'context', 'observation'

  // Map event
  const event = EVENT_MAP[forkEvent];
  if (!event) {
    console.error(`Unknown event: ${forkEvent}`);
    console.error(`Valid events: ${Object.keys(EVENT_MAP).join(', ')}`);
    return 1;
  }

  // Run hook
  const result = await runHook(event);
  return result.exitCode;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  // Version
  if (args.includes('--version') || args.includes('-v')) {
    console.log(`claude-mem plugin v${version}`);
    process.exit(0);
  }

  // Help
  if (args.includes('--help') || args.includes('-h') || !command) {
    printHelp();
    process.exit(0);
  }

  let exitCode = 0;

  switch (command) {
    case 'start':
      await ensureBackend();
      break;

    case 'hook':
      exitCode = await handleHook(args.slice(1));
      break;

    case 'version':
      console.log(version);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      exitCode = 1;
  }

  process.exit(exitCode);
}

/**
 * Print help
 */
function printHelp(): void {
  console.log(`
claude-mem plugin v${version}

Usage:
  worker-service.cjs start                    Ensure backend is running
  worker-service.cjs hook claude-code <event> Run a hook event
  worker-service.cjs --version                Show version

Events:
  context      Session start context injection
  user-message User prompt submitted
  session-init Session initialization
  observation  Tool use observation
  summarize    Session summary/stop

Examples:
  bun worker-service.cjs start
  bun worker-service.cjs hook claude-code context
  bun worker-service.cjs hook claude-code observation
`);
}

// Run
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

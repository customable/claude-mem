#!/usr/bin/env node
/**
 * Hook CLI
 *
 * Entry point for running hooks from command line.
 * Usage: claude-mem-hook <event>
 */

import type { HookEvent } from './types.js';
import { runHook } from './runner.js';
import { getRegisteredEvents } from './handlers/index.js';

/**
 * Valid events
 */
const VALID_EVENTS: HookEvent[] = [
  'session-start',
  'user-prompt-submit',
  'post-tool-use',
  'stop',
  'session-end',
];

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Help
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  // List events
  if (args.includes('--list')) {
    console.log('Registered events:');
    for (const event of getRegisteredEvents()) {
      console.log(`  - ${event}`);
    }
    process.exit(0);
  }

  // Get event
  const event = args[0] as HookEvent;
  if (!event) {
    console.error('Error: Event argument required');
    printHelp();
    process.exit(1);
  }

  if (!VALID_EVENTS.includes(event)) {
    console.error(`Error: Unknown event '${event}'`);
    console.error(`Valid events: ${VALID_EVENTS.join(', ')}`);
    process.exit(1);
  }

  // Run hook
  const result = await runHook(event);
  process.exit(result.exitCode);
}

/**
 * Print help
 */
function printHelp(): void {
  console.log(`
claude-mem-hook - Claude Code hook runner

Usage:
  claude-mem-hook <event>
  claude-mem-hook --help
  claude-mem-hook --list

Events:
  session-start       Called when session starts
  user-prompt-submit  Called when user submits prompt
  post-tool-use       Called after each tool use
  stop                Called when session stops
  session-end         Called when session ends

Input is read from stdin as JSON.
Output goes to stdout (context injection) and stderr (user messages).
Exit code indicates success (0), warning (1), or error (2).
`);
}

// Run
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

/**
 * SSE Writer
 *
 * Standalone Node.js process that listens to backend SSE events
 * and writes CLAUDE.md files to the local filesystem.
 *
 * This process is spawned by the plugin for each session and handles
 * the local file writing that the remote backend/worker cannot do.
 *
 * Security:
 * - Only writes to the working directory specified at spawn time
 * - Only processes events matching the session ID
 * - Only processes events matching the project name
 * - Validates all data before writing
 */

// @ts-ignore - eventsource types are installed in devDependencies
import { EventSource } from 'eventsource';
import * as fs from 'fs';
import * as path from 'path';

// Type definitions for eventsource events
interface MessageEvent {
  data: string;
  type: string;
  lastEventId: string;
}

// Parse command line arguments
interface Args {
  backend: string;
  token: string;
  session: string;
  project: string;
  dir: string;
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = {};

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2) as keyof Args;
      const value = argv[++i];
      if (value) {
        args[key] = value;
      }
    }
  }

  // Validate required arguments (token not needed - SSE endpoint is open, filtered by session)
  const required: (keyof Args)[] = ['backend', 'session', 'project', 'dir'];
  for (const key of required) {
    if (!args[key]) {
      console.error(`[sse-writer] Missing required argument: --${key}`);
      process.exit(1);
    }
  }
  args.token = args.token || '';

  return args as Args;
}

/**
 * Write or update CLAUDE.md file
 * Preserves user content outside of <claude-mem-context> tags
 */
function writeClaudeMd(dir: string, content: string): void {
  const filePath = path.join(dir, 'CLAUDE.md');

  try {
    if (fs.existsSync(filePath)) {
      // Read existing content
      const existing = fs.readFileSync(filePath, 'utf-8');
      const updated = replaceContextSection(existing, content);
      fs.writeFileSync(filePath, updated);
    } else {
      // Create new file
      fs.writeFileSync(filePath, content);
    }
  } catch (error) {
    const err = error as Error;
    console.error(`[sse-writer] Failed to write CLAUDE.md: ${err.message}`);
  }
}

/**
 * Replace or append the <claude-mem-context> section in existing content
 */
function replaceContextSection(existing: string, newContent: string): string {
  const startTag = '<claude-mem-context>';
  const endTag = '</claude-mem-context>';

  const startIdx = existing.indexOf(startTag);
  const endIdx = existing.indexOf(endTag);

  if (startIdx === -1 || endIdx === -1) {
    // No existing section, append with newlines
    return existing.trimEnd() + '\n\n' + newContent + '\n';
  }

  // Replace existing section (include the end tag in replacement)
  return (
    existing.slice(0, startIdx) +
    newContent +
    existing.slice(endIdx + endTag.length)
  );
}

/**
 * Main entry point
 */
function main(): void {
  const args = parseArgs(process.argv);

  console.log(`[sse-writer] Starting for session ${args.session}`);
  console.log(`[sse-writer] Project: ${args.project}`);
  console.log(`[sse-writer] Directory: ${args.dir}`);

  // Validate directory exists
  if (!fs.existsSync(args.dir)) {
    console.error(`[sse-writer] Directory does not exist: ${args.dir}`);
    process.exit(1);
  }

  // Build SSE URL with auth token as query parameter
  // (EventSource doesn't support custom headers in browser API)
  const sseUrl = `${args.backend}/api/stream?token=${encodeURIComponent(args.token)}`;
  console.log(`[sse-writer] Connecting to ${args.backend}/api/stream`);

  // Create EventSource
  const es = new EventSource(sseUrl);

  // Track connection state
  let connected = false;

  es.onopen = () => {
    connected = true;
    console.log('[sse-writer] Connected to SSE stream');
  };

  es.onerror = (_event: Event) => {
    if (!connected) {
      console.error('[sse-writer] Failed to connect to SSE stream');
      // Don't exit - will retry automatically
    } else {
      console.warn('[sse-writer] SSE connection error, reconnecting...');
    }
  };

  // Handle all SSE messages
  es.onmessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      // Handle claudemd:ready event
      if (data.type === 'claudemd:ready' && data.data) {
        const payload = data.data as {
          project: string;
          contentSessionId: string;
          workingDirectory: string;
          content: string;
        };

        // Validate session ID
        if (payload.contentSessionId !== args.session) {
          return; // Not for this session
        }

        // Validate project
        if (payload.project !== args.project) {
          console.warn(
            `[sse-writer] Project mismatch: expected ${args.project}, got ${payload.project}`
          );
          return;
        }

        // Validate working directory
        if (payload.workingDirectory !== args.dir) {
          console.warn(
            `[sse-writer] Directory mismatch: expected ${args.dir}, got ${payload.workingDirectory}`
          );
          return;
        }

        // Write CLAUDE.md
        console.log(`[sse-writer] Writing CLAUDE.md to ${args.dir}`);
        writeClaudeMd(args.dir, payload.content);
        console.log('[sse-writer] CLAUDE.md written successfully');

        // Exit after writing - our job is done for this session
        console.log('[sse-writer] Task complete, shutting down');
        es.close();
        process.exit(0);
      }

      // Handle session:ended event
      if (data.type === 'session:ended' && data.data) {
        const payload = data.data as { sessionId: string };

        if (payload.sessionId === args.session) {
          console.log('[sse-writer] Session ended, shutting down');
          es.close();
          process.exit(0);
        }
      }
    } catch (error) {
      const err = error as Error;
      console.error(`[sse-writer] Error processing event: ${err.message}`);
    }
  };

  // Graceful shutdown handlers
  const shutdown = (signal: string) => {
    console.log(`[sse-writer] Received ${signal}, shutting down`);
    es.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Safety timeout - exit after 10 minutes if no claudemd:ready received
  // This prevents zombie processes if something goes wrong
  const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  setTimeout(() => {
    console.log('[sse-writer] Timeout reached, shutting down');
    es.close();
    process.exit(0);
  }, TIMEOUT_MS);

  // Keep process running
  console.log('[sse-writer] Waiting for events...');
}

// Run main
main();

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
import { normalizeToDirectory } from './utils/path-utils.js';

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
 *
 * @returns true if write succeeded, false otherwise
 */
function writeClaudeMd(dir: string, content: string): boolean {
  // Normalize directory path in case a file path was passed (Issue #297)
  const normalizedDir = normalizeToDirectory(dir);

  // Log if path was normalized (Issue #297)
  if (normalizedDir !== dir) {
    console.log(`[sse-writer] Normalized file path to directory: ${dir} → ${normalizedDir}`);
  }

  // Validate the path is actually a directory
  try {
    const stat = fs.statSync(normalizedDir);
    if (!stat.isDirectory()) {
      console.error(`[sse-writer] Path is not a directory: ${normalizedDir}`);
      return false;
    }
  } catch {
    // Directory doesn't exist - that's OK, we might create CLAUDE.md anyway if parent exists
    const parentDir = path.dirname(normalizedDir);
    if (!fs.existsSync(parentDir)) {
      console.error(`[sse-writer] Parent directory does not exist: ${parentDir}`);
      return false;
    }
    // Create the target directory
    try {
      fs.mkdirSync(normalizedDir, { recursive: true });
    } catch (mkdirError) {
      const err = mkdirError as Error;
      console.error(`[sse-writer] Failed to create directory ${normalizedDir}: ${err.message}`);
      return false;
    }
  }

  const filePath = path.join(normalizedDir, 'CLAUDE.md');
  const startTag = '<claude-mem-context>';

  // Validate content has required tags (Issue #291)
  if (!content.includes(startTag)) {
    console.error(`[sse-writer] Received content without claude-mem-context tags, skipping`);
    return false;
  }

  try {
    if (fs.existsSync(filePath)) {
      // Read existing content
      const existing = fs.readFileSync(filePath, 'utf-8');
      const updated = replaceContextSection(existing, content);
      fs.writeFileSync(filePath, updated);
    } else {
      // Create new file
      console.log(`[sse-writer] Creating new CLAUDE.md in ${normalizedDir}`);
      fs.writeFileSync(filePath, content);
    }
    return true;
  } catch (error) {
    const err = error as Error;
    console.error(`[sse-writer] Failed to write CLAUDE.md: ${err.message}`);
    return false;
  }
}

/**
 * Replace or append the <claude-mem-context> section in existing content
 */
function replaceContextSection(existing: string, newContent: string): string {
  const startTag = '<claude-mem-context>';
  const endTag = '</claude-mem-context>';

  // Validate that newContent has the required tags (Issue #291)
  if (!newContent.includes(startTag) || !newContent.includes(endTag)) {
    console.error('[sse-writer] Invalid content: missing claude-mem-context tags');
    // Wrap content in tags as fallback
    newContent = `${startTag}\n${newContent}\n${endTag}`;
  }

  const startIdx = existing.indexOf(startTag);
  const endIdx = existing.indexOf(endTag);

  if (startIdx === -1 || endIdx === -1) {
    // No existing section, append with newlines
    console.log('[sse-writer] No existing claude-mem-context section, appending');
    return existing.trimEnd() + '\n\n' + newContent + '\n';
  }

  // Replace existing section (include the end tag in replacement)
  console.log(`[sse-writer] Updating existing claude-mem-context section`);
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

  // Track collected CLAUDE.md content for multiple directories
  // Key: directory path, Value: content to write
  const pendingWrites = new Map<string, string>();

  // Track if session has ended
  let sessionEnded = false;
  let sessionEndTimeout: NodeJS.Timeout | null = null;

  // Track if writing is paused during git operations (Issue #288)
  let writerPaused = false;

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

  /**
   * Write all collected CLAUDE.md files and exit
   */
  const writeAllAndExit = () => {
    if (pendingWrites.size === 0) {
      console.log('[sse-writer] No CLAUDE.md content to write');
    } else {
      console.log(`[sse-writer] Writing ${pendingWrites.size} CLAUDE.md file(s)...`);
      for (const [dir, content] of pendingWrites) {
        console.log(`[sse-writer] Writing CLAUDE.md to ${dir}`);
        const success = writeClaudeMd(dir, content);
        if (success) {
          console.log(`[sse-writer] CLAUDE.md written to ${dir}`);
        }
        // Error already logged in writeClaudeMd if failed (Issue #297)
      }
    }

    console.log('[sse-writer] All tasks complete, shutting down');
    es.close();
    process.exit(0);
  };

  // Handle all SSE messages
  es.onmessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      // Handle writer:pause event (Issue #288)
      if (data.type === 'writer:pause' && data.data) {
        const payload = data.data as { sessionId: string; reason?: string };
        if (payload.sessionId === args.session) {
          writerPaused = true;
          console.log(`[sse-writer] Writing paused: ${payload.reason || 'unknown reason'}`);
        }
      }

      // Handle writer:resume event (Issue #288)
      if (data.type === 'writer:resume' && data.data) {
        const payload = data.data as { sessionId: string };
        if (payload.sessionId === args.session) {
          writerPaused = false;
          console.log('[sse-writer] Writing resumed');
          // Write any pending content that was queued during pause
          if (pendingWrites.size > 0) {
            console.log(`[sse-writer] Writing ${pendingWrites.size} queued file(s)...`);
            for (const [dir, content] of pendingWrites) {
              console.log(`[sse-writer] Writing queued CLAUDE.md to ${dir}`);
              const success = writeClaudeMd(dir, content);
              if (success) {
                console.log(`[sse-writer] CLAUDE.md written to ${dir}`);
              }
            }
            pendingWrites.clear();
          }
        }
      }

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

        // Validate working directory is within our root directory
        // Accept exact match OR subdirectories
        if (payload.workingDirectory !== args.dir && !payload.workingDirectory.startsWith(args.dir + '/')) {
          console.warn(
            `[sse-writer] Directory mismatch: ${payload.workingDirectory} is not within ${args.dir}`
          );
          return;
        }

        // Check if writing is paused (Issue #288: git operations in progress)
        if (writerPaused) {
          console.log(`[sse-writer] Queueing write (paused): ${payload.workingDirectory}`);
          pendingWrites.set(payload.workingDirectory, payload.content);
          return;
        }

        // Write immediately to the target directory
        console.log(`[sse-writer] Received CLAUDE.md content for ${payload.workingDirectory}`);
        console.log(`[sse-writer] Writing CLAUDE.md to ${payload.workingDirectory}`);
        const success = writeClaudeMd(payload.workingDirectory, payload.content);
        if (success) {
          console.log('[sse-writer] CLAUDE.md written successfully');
        }
        // Error already logged in writeClaudeMd if failed (Issue #297)
      }

      // Handle session:started event (reactivation after completion)
      if (data.type === 'session:started' && data.data) {
        const payload = data.data as { sessionId: string };

        if (payload.sessionId === args.session && sessionEnded) {
          sessionEnded = false;
          console.log('[sse-writer] Session reactivated');

          // Clear the session end timeout
          if (sessionEndTimeout) {
            clearTimeout(sessionEndTimeout);
            sessionEndTimeout = null;
          }
        }
      }

      // Handle session:ended event
      // Don't exit immediately - wait for claudemd:ready events which come after session end
      if (data.type === 'session:ended' && data.data) {
        const payload = data.data as { sessionId: string };

        if (payload.sessionId === args.session && !sessionEnded) {
          sessionEnded = true;
          console.log('[sse-writer] Session ended, waiting for claudemd:ready events...');

          // Set a shorter timeout now that session has ended
          // Multiple claudemd tasks should complete within 5 minutes (worker may be busy)
          sessionEndTimeout = setTimeout(() => {
            console.log('[sse-writer] Timeout waiting for claudemd:ready after session end');
            writeAllAndExit();
          }, 5 * 60 * 1000);
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
    if (sessionEndTimeout) {
      clearTimeout(sessionEndTimeout);
    }
    writeAllAndExit();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Safety timeout - exit after 10 minutes if no claudemd:ready received
  // This prevents zombie processes if something goes wrong
  const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  setTimeout(() => {
    console.log('[sse-writer] Timeout reached, shutting down');
    if (sessionEndTimeout) {
      clearTimeout(sessionEndTimeout);
    }
    writeAllAndExit();
  }, TIMEOUT_MS);

  // Keep process running
  console.log('[sse-writer] Waiting for events...');
}

// Run main
main();

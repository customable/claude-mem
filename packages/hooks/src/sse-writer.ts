/**
 * SSE Writer
 *
 * Standalone Node.js process that listens to backend WebSocket events
 * and writes CLAUDE.md files to the local filesystem.
 *
 * This process is spawned by the plugin for each session and handles
 * the local file writing that the remote backend/worker cannot do.
 *
 * Issue #264: Migrated from EventSource (SSE) to WebSocket for unified
 * channel-based communication with server-side filtering.
 *
 * Security:
 * - Only writes to the working directory specified at spawn time
 * - Only processes events matching the session ID (server-side filtered)
 * - Only processes events matching the project name (server-side filtered)
 * - Validates all data before writing
 */

import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import { normalizeToDirectory } from './utils/path-utils.js';

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

  // Build WebSocket URL (Issue #264)
  const wsUrl = args.backend.replace(/^http/, 'ws') + '/ws';
  console.log(`[sse-writer] Connecting to ${wsUrl}`);

  // Track collected CLAUDE.md content for multiple directories
  // Key: directory path, Value: content to write
  const pendingWrites = new Map<string, string>();

  // Track if session has ended
  let sessionEnded = false;
  let sessionEndTimeout: NodeJS.Timeout | null = null;

  // Track if writing is paused during git operations (Issue #288)
  let writerPaused = false;

  // Reconnection settings
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;
  const reconnectDelay = 5000;

  /**
   * Write all collected CLAUDE.md files and exit
   */
  const writeAllAndExit = (ws: WebSocket | null) => {
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
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    process.exit(0);
  };

  /**
   * Handle incoming channel event
   */
  const handleEvent = (channel: string, data: unknown) => {
    const payload = data as Record<string, unknown>;

    // Handle writer:pause event (Issue #288)
    if (channel === 'writer:pause') {
      // Server-side filtering ensures this is for our session
      writerPaused = true;
      console.log(`[sse-writer] Writing paused: ${(payload.reason as string) || 'unknown reason'}`);
    }

    // Handle writer:resume event (Issue #288)
    if (channel === 'writer:resume') {
      // Server-side filtering ensures this is for our session
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

    // Handle claudemd:ready event
    if (channel === 'claudemd:ready') {
      const claudemdPayload = payload as {
        project: string;
        contentSessionId: string;
        workingDirectory: string;
        content: string;
      };

      // Server-side filtering handles session/project validation (Issue #264)
      // We only need to validate working directory is within our root

      // Validate working directory is within our root directory
      // Accept exact match OR subdirectories
      if (claudemdPayload.workingDirectory !== args.dir &&
          !claudemdPayload.workingDirectory.startsWith(args.dir + '/')) {
        console.warn(
          `[sse-writer] Directory mismatch: ${claudemdPayload.workingDirectory} is not within ${args.dir}`
        );
        return;
      }

      // Check if writing is paused (Issue #288: git operations in progress)
      if (writerPaused) {
        console.log(`[sse-writer] Queueing write (paused): ${claudemdPayload.workingDirectory}`);
        pendingWrites.set(claudemdPayload.workingDirectory, claudemdPayload.content);
        return;
      }

      // Write immediately to the target directory
      console.log(`[sse-writer] Received CLAUDE.md content for ${claudemdPayload.workingDirectory}`);
      console.log(`[sse-writer] Writing CLAUDE.md to ${claudemdPayload.workingDirectory}`);
      const success = writeClaudeMd(claudemdPayload.workingDirectory, claudemdPayload.content);
      if (success) {
        console.log('[sse-writer] CLAUDE.md written successfully');
      }
      // Error already logged in writeClaudeMd if failed (Issue #297)
    }

    // Handle session:started event (reactivation after completion)
    if (channel === 'session:started') {
      // Server-side filtering ensures this is for our session
      if (sessionEnded) {
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
    if (channel === 'session:ended') {
      // Server-side filtering ensures this is for our session
      if (!sessionEnded) {
        sessionEnded = true;
        console.log('[sse-writer] Session ended, waiting for claudemd:ready events...');

        // Set a shorter timeout now that session has ended
        // Multiple claudemd tasks should complete within 5 minutes (worker may be busy)
        sessionEndTimeout = setTimeout(() => {
          console.log('[sse-writer] Timeout waiting for claudemd:ready after session end');
          writeAllAndExit(ws);
        }, 5 * 60 * 1000);
      }
    }
  };

  /**
   * Connect to WebSocket and handle messages
   */
  let ws: WebSocket;

  const connect = () => {
    ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      console.log('[sse-writer] WebSocket connected, authenticating...');
      reconnectAttempts = 0;

      // Send SSE-Writer authentication message (Issue #264)
      ws.send(JSON.stringify({
        type: 'auth',
        clientType: 'sse-writer',
        sessionId: args.session,
        project: args.project,
        workingDirectory: args.dir,
      }));
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle ping -> pong for heartbeat
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        // Handle auth:success
        if (message.type === 'auth:success') {
          console.log(`[sse-writer] Authenticated as ${message.clientId}`);
          return;
        }

        // Handle subscribed confirmation
        if (message.type === 'subscribed') {
          console.log(`[sse-writer] Subscribed to channels: ${message.channels.join(', ')}`);
          return;
        }

        // Handle channel events
        if (message.type === 'event') {
          handleEvent(message.channel, message.data);
          return;
        }

        // Handle errors
        if (message.type === 'error' || message.type === 'auth:failed') {
          console.error(`[sse-writer] Server error: ${message.message || message.reason}`);
          return;
        }
      } catch (error) {
        const err = error as Error;
        console.error(`[sse-writer] Error processing message: ${err.message}`);
      }
    });

    ws.on('close', (code: number, reason: Buffer) => {
      console.log(`[sse-writer] WebSocket closed: ${code} - ${reason.toString()}`);

      // Attempt reconnection unless we're shutting down
      if (code !== 1000 && code !== 1001 && reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(`[sse-writer] Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
        setTimeout(connect, reconnectDelay);
      } else if (reconnectAttempts >= maxReconnectAttempts) {
        console.error('[sse-writer] Max reconnection attempts reached, shutting down');
        writeAllAndExit(null);
      }
    });

    ws.on('error', (error: Error) => {
      console.error(`[sse-writer] WebSocket error: ${error.message}`);
    });
  };

  // Initial connection
  connect();

  // Graceful shutdown handlers
  const shutdown = (signal: string) => {
    console.log(`[sse-writer] Received ${signal}, shutting down`);
    if (sessionEndTimeout) {
      clearTimeout(sessionEndTimeout);
    }
    writeAllAndExit(ws);
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
    writeAllAndExit(ws);
  }, TIMEOUT_MS);

  // Keep process running
  console.log('[sse-writer] Waiting for events...');
}

// Run main
main();

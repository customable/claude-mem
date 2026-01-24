/**
 * SessionStart Hook Handler
 *
 * Called when a new Claude Code session starts.
 * Injects relevant context from previous sessions.
 * Optionally spawns SSE writer for CLAUDE.md updates.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createLogger, loadSettings, HOOK_TIMEOUTS, getTimeout, getRepoInfo } from '@claude-mem/shared';
import type { RepoInfo } from '@claude-mem/shared';
import { getBackendClient } from '../client.js';
import type { HookInput, HookResult } from '../types.js';
import { success, skip } from '../types.js';

const logger = createLogger('hook:session-start');

/**
 * Context response from backend
 */
interface ContextResponse {
  context: string;
  observationCount: number;
  tokens: number;
}

/**
 * Get the PID file path for a session's SSE writer
 */
export function getSseWriterPidPath(sessionId: string): string {
  const claudeMemDir = path.join(os.homedir(), '.claude-mem');
  if (!fs.existsSync(claudeMemDir)) {
    fs.mkdirSync(claudeMemDir, { recursive: true });
  }
  return path.join(claudeMemDir, `sse-writer-${sessionId}.pid`);
}

/**
 * Clean up stale SSE writer PID files from previous sessions
 */
function cleanupStalePidFiles(): void {
  try {
    const claudeMemDir = path.join(os.homedir(), '.claude-mem');
    if (!fs.existsSync(claudeMemDir)) return;

    const files = fs.readdirSync(claudeMemDir);
    for (const file of files) {
      if (!file.startsWith('sse-writer-') || !file.endsWith('.pid')) continue;

      const pidPath = path.join(claudeMemDir, file);
      try {
        const pid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim(), 10);

        if (isNaN(pid)) {
          fs.unlinkSync(pidPath);
          continue;
        }

        // Check if process is running
        try {
          process.kill(pid, 0);
          // Process running - might be from current session or zombie
          // For safety, kill old writers when starting new session
          try {
            process.kill(pid, 'SIGTERM');
            logger.debug(`Killed stale SSE writer (PID: ${pid})`);
          } catch {
            // Ignore kill errors
          }
        } catch {
          // Process not running - just a stale file
        }
        fs.unlinkSync(pidPath);
      } catch {
        // Ignore individual file errors
      }
    }
  } catch (err) {
    // Non-critical, just log
    const error = err as Error;
    logger.debug('Error cleaning up stale PID files:', { message: error.message });
  }
}

/**
 * Get repository information for the working directory
 */
function getRepoInfoSafe(cwd: string | undefined): RepoInfo | null {
  if (!cwd) return null;
  try {
    return getRepoInfo(cwd);
  } catch (err) {
    const error = err as Error;
    logger.debug('Failed to get repo info:', { message: error.message });
    return null;
  }
}

/**
 * Spawn the SSE writer process for CLAUDE.md updates
 */
function spawnSseWriter(input: HookInput, repoInfo: RepoInfo | null): void {
  const settings = loadSettings();

  // Clean up any stale PID files first
  cleanupStalePidFiles();

  // Skip if CLAUDEMD not enabled
  if (!settings.CLAUDEMD_ENABLED) {
    logger.debug('CLAUDEMD_ENABLED is false, skipping SSE writer spawn');
    return;
  }

  // Need working directory to write CLAUDE.md
  if (!input.cwd) {
    logger.debug('No working directory, skipping SSE writer spawn');
    return;
  }

  // Build backend URL
  let backendUrl: string;
  if (settings.REMOTE_MODE && settings.REMOTE_URL) {
    backendUrl = settings.REMOTE_URL;
  } else {
    const host = settings.BACKEND_HOST || '127.0.0.1';
    const port = settings.BACKEND_PORT || 37777;
    backendUrl = `http://${host}:${port}`;
  }

  // Get auth token
  const authToken = settings.WORKER_AUTH_TOKEN || settings.REMOTE_TOKEN || '';

  // Find SSE writer script
  // In plugin mode, it's bundled alongside
  // Use try-catch because import.meta.url is undefined in CJS bundles
  let scriptDir: string;
  try {
    scriptDir = path.dirname(new URL(import.meta.url).pathname);
  } catch {
    // CJS bundle - derive from process.argv[1] (the script path)
    scriptDir = path.dirname(process.argv[1] || process.cwd());
  }
  const possiblePaths = [
    path.join(scriptDir, 'sse-writer.cjs'),       // Plugin bundle (same dir)
    path.join(scriptDir, '..', 'sse-writer.cjs'), // Plugin bundle (parent dir)
    path.join(scriptDir, 'sse-writer.js'),        // Development (same dir)
    path.join(scriptDir, '..', 'sse-writer.js'),  // Development (parent dir - handlers/)
  ];

  let writerScript: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      writerScript = p;
      break;
    }
  }

  if (!writerScript) {
    logger.warn('SSE writer script not found, skipping CLAUDE.md updates');
    return;
  }

  try {
    // Spawn the SSE writer process
    // Write logs to file so we can debug issues
    const logPath = path.join(os.homedir(), '.claude-mem', `sse-writer-${input.sessionId}.log`);
    const logFd = fs.openSync(logPath, 'a');

    const writer = spawn('node', [
      writerScript,
      '--backend', backendUrl,
      '--token', authToken,
      '--session', input.sessionId,
      '--project', input.project,
      '--dir', input.cwd,
      ...(repoInfo ? ['--repo-path', repoInfo.repoPath] : []),
      ...(repoInfo ? ['--branch', repoInfo.branch] : []),
    ], {
      detached: true,
      stdio: ['ignore', logFd, logFd],
      windowsHide: true,
    });

    // Close file descriptor in parent - child keeps it open
    fs.closeSync(logFd);

    // Store PID for cleanup
    const pidPath = getSseWriterPidPath(input.sessionId);
    fs.writeFileSync(pidPath, String(writer.pid));

    // Unref so parent can exit
    writer.unref();

    logger.info(`SSE writer spawned (PID: ${writer.pid}) for session ${input.sessionId}`);
  } catch (err) {
    const error = err as Error;
    logger.warn('Failed to spawn SSE writer:', { message: error.message });
  }
}

/**
 * Handle session start
 */
export async function handleSessionStart(input: HookInput): Promise<HookResult> {
  const client = getBackendClient();

  // Get repository info for worktree support
  const repoInfo = getRepoInfoSafe(input.cwd);
  if (repoInfo) {
    logger.debug('Detected git repository:', {
      repoPath: repoInfo.repoPath,
      isWorktree: repoInfo.isWorktree,
      branch: repoInfo.branch,
    });
  }

  // Quick check if backend is available - use short timeout to not block Claude
  const quickTimeout = getTimeout(HOOK_TIMEOUTS.QUICK_CHECK);
  const ready = await client.isCoreReady(quickTimeout);
  if (!ready) {
    logger.debug('Backend not ready, skipping context injection');
    return skip();
  }

  // Spawn SSE writer for CLAUDE.md updates (non-blocking)
  spawnSseWriter(input, repoInfo);

  try {
    // Determine project identifier - use repo path for consistent grouping across worktrees
    const projectId = repoInfo?.repoPath ?? input.project;

    // Build query params - only include defined values
    const queryParams: Record<string, string> = { project: projectId };
    if (repoInfo?.repoPath) queryParams.repoPath = repoInfo.repoPath;
    if (repoInfo?.branch) queryParams.branch = repoInfo.branch;
    if (repoInfo?.isWorktree !== undefined) queryParams.isWorktree = String(repoInfo.isWorktree);

    // Get context for this project
    const response = await client.get<ContextResponse>('/api/hooks/context', queryParams);

    if (!response.context || response.observationCount === 0) {
      logger.debug('No context available for project');
      return skip();
    }

    logger.info(`Injecting context: ${response.observationCount} observations, ${response.tokens} tokens`);

    return success(response.context);
  } catch (err) {
    const error = err as Error;
    logger.warn('Failed to get context:', { message: error.message });
    return skip(); // Don't block session start
  }
}

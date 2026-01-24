/**
 * UserPromptSubmit Hook Handler
 *
 * Called when user submits a prompt.
 * Initializes the session in the backend.
 */

import {
  createLogger,
  getRepoInfo,
  loadSettings,
  processSecrets,
  createSecretsSummary,
  type SecretDetectorConfig,
} from '@claude-mem/shared';
import { getBackendClient } from '../client.js';
import type { HookInput, HookResult } from '../types.js';
import { success, skip } from '../types.js';

const logger = createLogger('hook:user-prompt-submit');

/**
 * Session init response from backend
 */
interface SessionInitResponse {
  sessionId: string;
  created: boolean;
}

/**
 * Handle user prompt submit
 */
export async function handleUserPromptSubmit(input: HookInput): Promise<HookResult> {
  const client = getBackendClient();

  // Check if backend is available
  const ready = await client.isCoreReady();
  if (!ready) {
    logger.debug('Backend not ready, skipping session init');
    return skip();
  }

  try {
    // Get repository info for worktree support
    let repoInfo = null;
    if (input.cwd) {
      try {
        repoInfo = getRepoInfo(input.cwd);
      } catch {
        // Not a git repo or git not available - that's fine
      }
    }

    // Process prompt for secrets
    const settings = loadSettings();
    const secretConfig: SecretDetectorConfig = {
      enabled: settings.SECRET_DETECTION_ENABLED,
      mode: settings.SECRET_DETECTION_MODE,
    };

    let prompt = input.prompt;

    if (secretConfig.enabled && prompt) {
      const result = processSecrets(prompt, secretConfig);

      if (result.secretsFound) {
        logger.warn(`Secrets detected in user prompt: ${createSecretsSummary(result.matches)}`);

        // Skip if configured to not store prompts with secrets
        if (secretConfig.mode === 'skip') {
          logger.info('Skipping prompt storage due to detected secrets');
          // Still init session, just without the prompt
          prompt = undefined;
        } else {
          // Use processed (potentially redacted) text
          prompt = result.text;
        }
      }
    }

    // Initialize session with repo info
    const response = await client.post<SessionInitResponse>('/api/hooks/session-init', {
      sessionId: input.sessionId,
      project: input.project,
      cwd: input.cwd,
      prompt,
      // Git worktree info
      repoPath: repoInfo?.repoPath,
      isWorktree: repoInfo?.isWorktree,
      branch: repoInfo?.branch,
    });

    logger.info(`Session initialized: ${response.sessionId} (created: ${response.created})`);

    return success();
  } catch (err) {
    const error = err as Error;
    logger.warn('Failed to init session:', { message: error.message });
    return skip(); // Don't block prompt submission
  }
}

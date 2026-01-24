/**
 * Context Generation Handler
 *
 * Generates context for new sessions based on past observations.
 * Selects and summarizes relevant observations.
 */

import { createLogger } from '@claude-mem/shared';
import type { ContextGenerateTaskPayload, ContextGenerateTask } from '@claude-mem/types';
import type { Agent } from '../agents/types.js';
import { CONTEXT_SYSTEM_PROMPT, buildContextPrompt } from './prompts.js';

const logger = createLogger('context-handler');

/**
 * Observation data with timestamp
 */
export interface TimestampedObservation {
  title: string;
  text: string;
  type: string;
  createdAt: number;
}

/**
 * Handle a context generation task
 */
export async function handleContextTask(
  agent: Agent,
  payload: ContextGenerateTaskPayload,
  observations: TimestampedObservation[],
  signal?: AbortSignal
): Promise<ContextGenerateTask['result']> {
  // Check for cancellation
  if (signal?.aborted) {
    throw new Error('Task cancelled');
  }

  logger.debug(`Generating context for ${payload.project} with ${observations.length} observations`);

  if (observations.length === 0) {
    return {
      context: 'No previous observations found for this project.',
      observationCount: 0,
      tokens: 0,
    };
  }

  // Build the prompt
  const userPrompt = buildContextPrompt(observations, payload.project, payload.query);

  // Query the agent
  const response = await agent.query({
    system: CONTEXT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 2048,
    temperature: 0.3,
    signal,
  });

  return {
    context: response.content,
    observationCount: observations.length,
    tokens: response.inputTokens + response.outputTokens,
  };
}

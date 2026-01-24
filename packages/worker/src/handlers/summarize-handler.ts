/**
 * Summarize Handler
 *
 * Processes session summarization tasks.
 * Takes session observations and generates a summary.
 */

import { createLogger } from '@claude-mem/shared';
import type { SummarizeTaskPayload, SummarizeTask } from '@claude-mem/types';
import type { Agent } from '../agents/types.js';
import { parseSummary } from './xml-parser.js';
import { SUMMARIZE_SYSTEM_PROMPT, buildSummarizePrompt } from './prompts.js';

const logger = createLogger('summarize-handler');

/**
 * Observation data for summarization
 */
export interface ObservationData {
  title: string;
  text: string;
  type: string;
}

/**
 * Handle a summarize task
 */
export async function handleSummarizeTask(
  agent: Agent,
  payload: SummarizeTaskPayload,
  observations: ObservationData[],
  signal?: AbortSignal
): Promise<SummarizeTask['result']> {
  // Check for cancellation
  if (signal?.aborted) {
    throw new Error('Task cancelled');
  }

  logger.debug(`Summarizing session ${payload.sessionId} with ${observations.length} observations`);

  if (observations.length === 0) {
    return {
      summaryId: 0,
      request: 'No observations to summarize',
      investigated: '',
      learned: '',
      completed: '',
      nextSteps: '',
      tokens: 0,
    };
  }

  // Build the prompt
  const userPrompt = buildSummarizePrompt(observations, payload.project);

  // Query the agent
  const response = await agent.query({
    system: SUMMARIZE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 1024,
    temperature: 0.3,
    signal,
  });

  // Parse the response
  const summary = parseSummary(response.content);

  if (!summary) {
    logger.warn('No summary extracted from response');
    return {
      summaryId: 0,
      request: 'Summary extraction failed',
      investigated: '',
      learned: '',
      completed: '',
      nextSteps: '',
      tokens: response.inputTokens + response.outputTokens,
    };
  }

  return {
    summaryId: 0, // Will be set by backend when stored
    request: summary.request,
    investigated: summary.investigated,
    learned: summary.learned,
    completed: summary.completed,
    nextSteps: summary.nextSteps,
    tokens: response.inputTokens + response.outputTokens,
  };
}

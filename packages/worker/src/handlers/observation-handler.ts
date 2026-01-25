/**
 * Observation Handler
 *
 * Processes observation extraction tasks.
 * Takes tool input/output and extracts meaningful observations using an AI agent.
 */

import { createLogger } from '@claude-mem/shared';
import type { ObservationTaskPayload, ObservationTask } from '@claude-mem/types';
import type { Agent, AgentResponse } from '../agents/types.js';
import { parseAgentResponse } from './xml-parser.js';
import { OBSERVATION_SYSTEM_PROMPT } from './prompts.js';

const logger = createLogger('observation-handler');

/**
 * Result of observation extraction
 */
export interface ObservationResult {
  observationId?: number;
  title: string;
  text: string;
  type: string;
  tokens: number;
  // Optional extracted fields
  subtitle?: string;
  narrative?: string;
  facts?: string[];
  concepts?: string[];
  filesRead?: string[];
  filesModified?: string[];
}

/**
 * Handle an observation task
 */
export async function handleObservationTask(
  agent: Agent,
  payload: ObservationTaskPayload,
  signal?: AbortSignal
): Promise<ObservationTask['result']> {
  // Check for cancellation
  if (signal?.aborted) {
    throw new Error('Task cancelled');
  }

  logger.debug(`Processing observation for session ${payload.sessionId}, tool: ${payload.toolName}`);

  // Build the prompt
  const userPrompt = buildObservationPrompt(payload);

  // Query the agent
  const response = await agent.query({
    system: OBSERVATION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 2048,
    temperature: 0.3,
    signal,
  });

  // Parse the response
  const parsed = parseAgentResponse(response.content);

  // Get the first observation (primary one)
  const observation = parsed.observations[0];

  if (!observation) {
    logger.warn('No observation extracted from response');
    return {
      observationId: 0,
      title: 'No observation extracted',
      text: '',
      type: 'discovery',
      tokens: response.inputTokens + response.outputTokens,
    };
  }

  return {
    observationId: 0, // Will be set by backend when stored
    title: observation.title,
    text: observation.text,
    type: observation.type,
    tokens: response.inputTokens + response.outputTokens,
    // Pass through extracted optional fields
    subtitle: observation.subtitle,
    narrative: observation.narrative,
    facts: observation.facts?.length ? observation.facts : undefined,
    concepts: observation.concepts?.length ? observation.concepts : undefined,
    filesRead: observation.filesRead?.length ? observation.filesRead : undefined,
    filesModified: observation.filesModified?.length ? observation.filesModified : undefined,
  };
}

/**
 * Build the observation extraction prompt
 */
function buildObservationPrompt(payload: ObservationTaskPayload): string {
  const parts: string[] = [];

  parts.push(`Project: ${payload.project}`);
  parts.push(`Session: ${payload.sessionId}`);
  if (payload.promptNumber) {
    parts.push(`Prompt Number: ${payload.promptNumber}`);
  }
  parts.push('');
  parts.push(`Tool: ${payload.toolName}`);
  parts.push('');
  parts.push('Input:');
  parts.push('```');
  parts.push(truncateIfNeeded(payload.toolInput, 8000));
  parts.push('```');
  parts.push('');
  parts.push('Output:');
  parts.push('```');
  parts.push(truncateIfNeeded(payload.toolOutput, 16000));
  parts.push('```');

  return parts.join('\n');
}

/**
 * Truncate text if it exceeds max length
 */
function truncateIfNeeded(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, maxLength);
  return truncated + '\n\n[... truncated ...]';
}

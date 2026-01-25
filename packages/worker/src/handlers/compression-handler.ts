/**
 * Compression Handler (Endless Mode - Issue #109)
 *
 * Compresses archived tool outputs into observations with ~95% token reduction.
 * Part of the dual-memory architecture for extended coding sessions.
 */

import { createLogger } from '@claude-mem/shared';
import type { CompressionTaskPayload, CompressionTask } from '@claude-mem/types';
import type { Agent } from '../agents/types.js';
import { parseAgentResponse } from './xml-parser.js';
import { COMPRESSION_SYSTEM_PROMPT } from './prompts.js';

const logger = createLogger('compression-handler');

/**
 * Archived output data for compression
 */
export interface ArchivedOutputData {
  id: number;
  toolName: string;
  toolInput: string;
  toolOutput: string;
  tokenCount?: number;
}

/**
 * Handle a compression task
 *
 * Takes archived tool output and compresses it into a concise observation.
 * Target: ~95% token reduction (e.g., 10k tokens -> 500 tokens)
 */
export async function handleCompressionTask(
  agent: Agent,
  payload: CompressionTaskPayload,
  archivedOutput: ArchivedOutputData,
  signal?: AbortSignal
): Promise<CompressionTask['result']> {
  // Check for cancellation
  if (signal?.aborted) {
    throw new Error('Task cancelled');
  }

  const originalTokens = archivedOutput.tokenCount ?? estimateTokenCount(archivedOutput.toolOutput);

  logger.debug(
    `Compressing archived output ${archivedOutput.id} for session ${payload.sessionId}, ` +
    `tool: ${archivedOutput.toolName}, ~${originalTokens} tokens`
  );

  // Build the compression prompt
  const userPrompt = buildCompressionPrompt(archivedOutput, payload.project);

  // Query the agent
  const response = await agent.query({
    system: COMPRESSION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 1024, // Compressed output should be small
    temperature: 0.2, // Low temperature for consistent compression
    signal,
  });

  // Parse the response
  const parsed = parseAgentResponse(response.content);

  // Get the first observation (compressed result)
  const observation = parsed.observations[0];

  if (!observation) {
    logger.warn('No observation extracted from compression response');
    throw new Error('Failed to compress output: no observation generated');
  }

  const compressedTokens = response.outputTokens;
  const compressionRatio = originalTokens > 0 ? (1 - compressedTokens / originalTokens) * 100 : 0;

  logger.info(
    `Compressed ${originalTokens} -> ${compressedTokens} tokens ` +
    `(${compressionRatio.toFixed(1)}% reduction) for output ${archivedOutput.id}`
  );

  return {
    observationId: 0, // Will be set by backend when stored
    originalTokens,
    compressedTokens,
    compressionRatio,
  };
}

/**
 * Build the compression prompt
 */
function buildCompressionPrompt(output: ArchivedOutputData, project: string): string {
  const parts: string[] = [];

  parts.push(`Project: ${project}`);
  parts.push(`Tool: ${output.toolName}`);
  parts.push('');
  parts.push('Input:');
  parts.push('```');
  parts.push(truncateIfNeeded(output.toolInput, 4000));
  parts.push('```');
  parts.push('');
  parts.push('Output:');
  parts.push('```');
  parts.push(truncateIfNeeded(output.toolOutput, 16000));
  parts.push('```');
  parts.push('');
  parts.push('Compress this tool output into a concise observation.');

  return parts.join('\n');
}

/**
 * Estimate token count for text (rough approximation)
 */
function estimateTokenCount(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
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

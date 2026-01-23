/**
 * XML Parser for Agent Responses
 *
 * Parses XML responses from agents to extract observations and summaries.
 * Uses regex-based parsing (no external XML library needed).
 */

import type { ParsedObservation, ParsedSummary } from '../agents/types.js';

/**
 * Valid observation types
 */
const VALID_TYPES = ['bugfix', 'feature', 'refactor', 'change', 'discovery', 'decision', 'session-request'] as const;
type ObservationType = typeof VALID_TYPES[number];

/**
 * Extract content between XML tags
 */
function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extract all instances of a tag
 */
function extractAllTags(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'gi');
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

/**
 * Parse a list of items (newline or comma separated)
 */
function parseList(content: string | null): string[] {
  if (!content) return [];
  return content
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Validate and normalize observation type
 */
function normalizeType(type: string | null): ObservationType {
  if (!type) return 'discovery';
  const normalized = type.toLowerCase().trim();
  if (VALID_TYPES.includes(normalized as ObservationType)) {
    return normalized as ObservationType;
  }
  return 'discovery';
}

/**
 * Parse a single observation block
 */
function parseObservation(xml: string): ParsedObservation | null {
  const type = extractTag(xml, 'type');
  const title = extractTag(xml, 'title');
  const text = extractTag(xml, 'text');

  // Title and text are required
  if (!title && !text) {
    return null;
  }

  return {
    type: normalizeType(type),
    title: title || 'Untitled observation',
    text: text || '',
    subtitle: extractTag(xml, 'subtitle') || undefined,
    narrative: extractTag(xml, 'narrative') || undefined,
    facts: parseList(extractTag(xml, 'facts')),
    concepts: parseList(extractTag(xml, 'concepts')),
    filesRead: parseList(extractTag(xml, 'files_read')),
    filesModified: parseList(extractTag(xml, 'files_modified')),
  };
}

/**
 * Parse observations from agent response
 */
export function parseObservations(response: string): ParsedObservation[] {
  const observations: ParsedObservation[] = [];

  // Try to find <observations> wrapper first
  const observationsBlock = extractTag(response, 'observations');
  const content = observationsBlock || response;

  // Extract all <observation> blocks
  const observationBlocks = extractAllTags(content, 'observation');

  for (const block of observationBlocks) {
    const observation = parseObservation(block);
    if (observation) {
      observations.push(observation);
    }
  }

  return observations;
}

/**
 * Parse summary from agent response
 */
export function parseSummary(response: string): ParsedSummary | null {
  const summaryBlock = extractTag(response, 'summary');
  if (!summaryBlock) {
    return null;
  }

  const request = extractTag(summaryBlock, 'request');
  const investigated = extractTag(summaryBlock, 'investigated');
  const learned = extractTag(summaryBlock, 'learned');
  const completed = extractTag(summaryBlock, 'completed');
  const nextSteps = extractTag(summaryBlock, 'next_steps') || extractTag(summaryBlock, 'nextsteps');

  // At least one field should be present
  if (!request && !investigated && !learned && !completed && !nextSteps) {
    return null;
  }

  return {
    request: request || '',
    investigated: investigated || '',
    learned: learned || '',
    completed: completed || '',
    nextSteps: nextSteps || '',
  };
}

/**
 * Extract session ID from response (if present)
 */
export function parseSessionId(response: string): string | null {
  return extractTag(response, 'memory_session_id') || extractTag(response, 'session_id');
}

/**
 * Parse complete agent response
 */
export interface ParsedAgentResponse {
  observations: ParsedObservation[];
  summary: ParsedSummary | null;
  sessionId: string | null;
  raw: string;
}

export function parseAgentResponse(response: string): ParsedAgentResponse {
  return {
    observations: parseObservations(response),
    summary: parseSummary(response),
    sessionId: parseSessionId(response),
    raw: response,
  };
}

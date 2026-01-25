/**
 * Type Mapper for Legacy Migration (Issue #198)
 *
 * Maps observation types from thedotmack/claude-mem to customable/claude-mem.
 */

import type { ObservationType } from '@claude-mem/types';

/**
 * Mapping from legacy types to current ObservationType
 */
export const LEGACY_TYPE_MAP: Record<string, ObservationType> = {
  // Knowledge types
  memory: 'discovery',
  insight: 'discovery',
  learning: 'discovery',
  discovery: 'discovery',
  research: 'research',

  // Decision types
  decision: 'decision',
  architectural_decision: 'decision',

  // Work types
  bug: 'bugfix',
  bugfix: 'bugfix',
  fix: 'bugfix',
  feature: 'feature',
  refactor: 'refactor',
  change: 'change',

  // Documentation
  docs: 'docs',
  documentation: 'docs',

  // Configuration
  config: 'config',
  configuration: 'config',

  // Testing
  test: 'test',
  testing: 'test',

  // Notes
  note: 'note',
  bookmark: 'note',

  // Tasks
  task: 'task',
  todo: 'task',
  plan: 'plan',
};

/**
 * Default type for unknown legacy types
 */
export const DEFAULT_TYPE: ObservationType = 'note';

/**
 * Map a legacy type to current ObservationType
 */
export function mapLegacyType(legacyType: string | null | undefined): ObservationType {
  if (!legacyType) {
    return DEFAULT_TYPE;
  }

  const normalized = legacyType.toLowerCase().trim();
  return LEGACY_TYPE_MAP[normalized] ?? DEFAULT_TYPE;
}

/**
 * Check if a legacy type is known
 */
export function isKnownLegacyType(legacyType: string): boolean {
  const normalized = legacyType.toLowerCase().trim();
  return normalized in LEGACY_TYPE_MAP;
}

/**
 * Get all known legacy types
 */
export function getKnownLegacyTypes(): string[] {
  return Object.keys(LEGACY_TYPE_MAP);
}

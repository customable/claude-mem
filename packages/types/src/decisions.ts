/**
 * Decision Types
 *
 * Types for conflict detection and decision tracking.
 */

/**
 * Categories for architectural decisions
 */
export type DecisionCategory =
  | 'architecture'   // System design, patterns
  | 'technology'     // Library/framework choices
  | 'convention'     // Code style, naming
  | 'security'       // Security policies
  | 'performance'    // Performance decisions
  | 'api'            // API design choices
  | 'database';      // Schema decisions

/**
 * Type of conflict between decisions
 */
export type ConflictType = 'contradicts' | 'supersedes' | 'related';

/**
 * A potentially conflicting decision
 */
export interface ConflictingDecision {
  observationId: number;
  title: string;
  text: string;
  category: DecisionCategory;
  similarity: number;
  conflictType: ConflictType;
  explanation: string;
  createdAt: string;
}

/**
 * Result of conflict check
 */
export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingDecisions: ConflictingDecision[];
}

/**
 * Input for conflict check
 */
export interface ConflictCheckInput {
  content: string;
  category?: DecisionCategory;
  project: string;
}

/**
 * Input for superseding a decision
 */
export interface SupersedeInput {
  observationId: number;
  supersededBy: number;
  reason?: string;
}

/**
 * Decision with tracking info
 */
export interface DecisionRecord {
  id: number;
  title: string;
  text: string;
  category: DecisionCategory;
  project: string;
  createdAt: string;
  supersededBy?: number;
  supersedes?: number;
  supersededAt?: string;
  isActive: boolean;
}

/**
 * Decision history for a project
 */
export interface DecisionHistory {
  project: string;
  category?: DecisionCategory;
  activeDecisions: DecisionRecord[];
  supersededDecisions: DecisionRecord[];
  unresolvedConflicts: ConflictCheckResult[];
}

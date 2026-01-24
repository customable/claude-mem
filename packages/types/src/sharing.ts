/**
 * Memory Sharing Types
 *
 * Types for memory sharing and collaboration features.
 */

import type { ObservationType, ObservationRecord, SessionSummaryRecord, SdkSessionRecord } from './database.js';

/**
 * Share privacy level
 */
export type SharePrivacyLevel = 'full' | 'redacted' | 'anonymous';

/**
 * Share scope options
 */
export interface ShareScope {
  /** Filter by project(s) */
  projects?: string[];
  /** Filter by observation types */
  types?: ObservationType[];
  /** Filter by date range */
  dateRange?: {
    start?: string;
    end?: string;
  };
  /** Filter by tags/concepts */
  tags?: string[];
  /** Include session summaries */
  includeSummaries?: boolean;
  /** Include session metadata */
  includeSessions?: boolean;
  /** Maximum observations to include */
  limit?: number;
}

/**
 * Share metadata
 */
export interface ShareMetadata {
  /** Unique share identifier */
  shareId: string;
  /** Human-readable title */
  title?: string;
  /** Description of shared content */
  description?: string;
  /** Who created the share */
  createdBy?: string;
  /** When the share was created */
  createdAt: string;
  /** Version of share format */
  formatVersion: string;
  /** Privacy level applied */
  privacyLevel: SharePrivacyLevel;
  /** Scope used to filter content */
  scope: ShareScope;
  /** Content statistics */
  stats: ShareStats;
  /** Custom metadata */
  customMetadata?: Record<string, unknown>;
}

/**
 * Statistics about shared content
 */
export interface ShareStats {
  observationCount: number;
  summaryCount: number;
  sessionCount: number;
  projectCount: number;
  typeBreakdown: Record<string, number>;
  dateRange: {
    oldest?: string;
    newest?: string;
  };
  redactedCount?: number;
}

/**
 * Complete share bundle
 */
export interface ShareBundle {
  /** Share metadata */
  metadata: ShareMetadata;
  /** Shared observations */
  observations: ShareableObservation[];
  /** Shared summaries (if included) */
  summaries?: ShareableSummary[];
  /** Shared sessions (if included) */
  sessions?: ShareableSession[];
  /** Checksum for integrity verification */
  checksum: string;
}

/**
 * Observation modified for sharing
 */
export interface ShareableObservation {
  /** Original ID (for import tracking) */
  originalId: number;
  /** Session ID (may be anonymized) */
  memorySessionId: string;
  /** Project name */
  project: string;
  /** Observation text (may be redacted) */
  text: string;
  /** Observation type */
  type: ObservationType;
  /** Title */
  title?: string;
  /** Subtitle */
  subtitle?: string;
  /** Concepts (JSON string) */
  concepts?: string;
  /** Facts (JSON string) */
  facts?: string;
  /** Narrative */
  narrative?: string;
  /** Files read (may be redacted) */
  filesRead?: string;
  /** Files modified (may be redacted) */
  filesModified?: string;
  /** Prompt number */
  promptNumber?: number;
  /** Discovery tokens */
  discoveryTokens?: number;
  /** Git branch */
  gitBranch?: string;
  /** Created timestamp */
  createdAt: string;
  /** Memory tier */
  memoryTier?: string;
  /** Importance boost */
  importanceBoost?: number;
  /** Whether pinned */
  pinned?: boolean;
}

/**
 * Summary modified for sharing
 */
export interface ShareableSummary {
  /** Original ID */
  originalId: number;
  /** Session ID */
  memorySessionId: string;
  /** Project name */
  project: string;
  /** Request summary */
  request?: string;
  /** What was investigated */
  investigated?: string;
  /** What was learned */
  learned?: string;
  /** What was completed */
  completed?: string;
  /** Next steps */
  nextSteps?: string;
  /** Prompt number */
  promptNumber?: number;
  /** Discovery tokens */
  discoveryTokens?: number;
  /** Created timestamp */
  createdAt: string;
}

/**
 * Session modified for sharing
 */
export interface ShareableSession {
  /** Original content session ID */
  originalContentSessionId: string;
  /** Memory session ID */
  memorySessionId: string;
  /** Project name */
  project: string;
  /** User prompt (may be redacted) */
  userPrompt?: string;
  /** Session status */
  status?: string;
  /** Working directory (may be anonymized) */
  workingDirectory?: string;
  /** Created timestamp */
  createdAt: string;
}

/**
 * Options for creating a share
 */
export interface CreateShareOptions {
  /** Share title */
  title?: string;
  /** Share description */
  description?: string;
  /** Creator identifier */
  createdBy?: string;
  /** Privacy level */
  privacyLevel?: SharePrivacyLevel;
  /** Content scope */
  scope: ShareScope;
  /** Custom metadata */
  customMetadata?: Record<string, unknown>;
}

/**
 * Import options
 */
export interface ImportShareOptions {
  /** Skip existing records with same original ID */
  skipExisting?: boolean;
  /** Prefix to add to project names */
  projectPrefix?: string;
  /** Target project (override all) */
  targetProject?: string;
  /** Dry run (don't actually import) */
  dryRun?: boolean;
}

/**
 * Import conflict
 */
export interface ImportConflict {
  /** Type of conflict */
  type: 'duplicate' | 'schema_mismatch' | 'version_mismatch';
  /** Description of conflict */
  description: string;
  /** Affected items */
  affectedItems: Array<{
    type: 'observation' | 'summary' | 'session';
    originalId: string | number;
  }>;
  /** Suggested resolution */
  resolution?: string;
}

/**
 * Import result
 */
export interface ImportShareResult {
  /** Whether import succeeded */
  success: boolean;
  /** Import statistics */
  stats: {
    observationsImported: number;
    observationsSkipped: number;
    observationsErrors: number;
    summariesImported: number;
    summariesSkipped: number;
    summariesErrors: number;
    sessionsImported: number;
    sessionsSkipped: number;
    sessionsErrors: number;
  };
  /** Any conflicts detected */
  conflicts: ImportConflict[];
  /** Import timestamp */
  importedAt: string;
  /** Share ID that was imported */
  shareId: string;
}

/**
 * Share audit log entry
 */
export interface ShareAuditEntry {
  /** Entry ID */
  id: number;
  /** Share ID */
  shareId: string;
  /** Action type */
  action: 'created' | 'exported' | 'imported' | 'deleted';
  /** Actor (who performed the action) */
  actor?: string;
  /** Timestamp */
  timestamp: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Share audit record for database
 */
export interface ShareAuditRecord {
  id: number;
  share_id: string;
  action: string;
  actor?: string;
  details?: string; // JSON
  created_at: string;
  created_at_epoch: number;
}

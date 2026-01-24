/**
 * Share Service
 *
 * Manages memory sharing and collaboration features.
 * Handles creating shareable bundles, importing shares, and tracking audit logs.
 */

import crypto from 'crypto';
import { createLogger, redactSecrets } from '@claude-mem/shared';
import type {
  IObservationRepository,
  ISummaryRepository,
  ISessionRepository,
  ObservationRecord,
  SessionSummaryRecord,
  SdkSessionRecord,
  ShareBundle,
  ShareMetadata,
  ShareableObservation,
  ShareableSummary,
  ShareableSession,
  CreateShareOptions,
  ImportShareOptions,
  ImportShareResult,
  ImportConflict,
  ShareStats,
  ShareAuditEntry,
  SharePrivacyLevel,
  CreateObservationInput,
  CreateSummaryInput,
  CreateSessionInput,
} from '@claude-mem/types';

const logger = createLogger('share-service');

/** Current share format version */
const FORMAT_VERSION = '1.0.0';

export interface ShareServiceDeps {
  observations: IObservationRepository;
  summaries: ISummaryRepository;
  sessions: ISessionRepository;
}

/**
 * Share Service
 *
 * Provides memory sharing functionality including:
 * - Creating shareable bundles with privacy controls
 * - Importing shared bundles with conflict detection
 * - Audit logging for sharing activities
 */
export class ShareService {
  private auditLog: ShareAuditEntry[] = [];
  private auditIdCounter = 0;

  constructor(private readonly deps: ShareServiceDeps) {}

  /**
   * Create a shareable bundle from selected memories
   */
  async createShare(options: CreateShareOptions): Promise<ShareBundle> {
    const shareId = this.generateShareId();
    const privacyLevel = options.privacyLevel ?? 'redacted';

    logger.info(`Creating share ${shareId}`, { scope: options.scope, privacyLevel });

    // Fetch observations based on scope
    const observations = await this.fetchObservations(options.scope);

    // Fetch summaries if included
    const summaries = options.scope.includeSummaries
      ? await this.fetchSummaries(options.scope)
      : [];

    // Fetch sessions if included
    const sessions = options.scope.includeSessions
      ? await this.fetchSessions(options.scope, observations)
      : [];

    // Apply privacy transformations
    const processedObservations = observations.map(obs =>
      this.processObservationForSharing(obs, privacyLevel)
    );

    const processedSummaries = summaries.map(sum =>
      this.processSummaryForSharing(sum, privacyLevel)
    );

    const processedSessions = sessions.map(sess =>
      this.processSessionForSharing(sess, privacyLevel)
    );

    // Calculate statistics
    const stats = this.calculateStats(
      processedObservations,
      processedSummaries,
      processedSessions,
      privacyLevel
    );

    // Build metadata
    const metadata: ShareMetadata = {
      shareId,
      title: options.title,
      description: options.description,
      createdBy: options.createdBy,
      createdAt: new Date().toISOString(),
      formatVersion: FORMAT_VERSION,
      privacyLevel,
      scope: options.scope,
      stats,
      customMetadata: options.customMetadata,
    };

    // Build bundle
    const bundle: ShareBundle = {
      metadata,
      observations: processedObservations,
      summaries: processedSummaries.length > 0 ? processedSummaries : undefined,
      sessions: processedSessions.length > 0 ? processedSessions : undefined,
      checksum: '', // Will be calculated
    };

    // Calculate checksum
    bundle.checksum = this.calculateChecksum(bundle);

    // Log the share creation
    this.addAuditEntry(shareId, 'created', options.createdBy, {
      observationCount: processedObservations.length,
      summaryCount: processedSummaries.length,
      sessionCount: processedSessions.length,
    });

    logger.info(`Share ${shareId} created`, { stats });
    return bundle;
  }

  /**
   * Preview what would be shared without creating the bundle
   */
  async previewShare(options: CreateShareOptions): Promise<{
    stats: ShareStats;
    sampleObservations: ShareableObservation[];
  }> {
    const privacyLevel = options.privacyLevel ?? 'redacted';
    const observations = await this.fetchObservations(options.scope);
    const summaries = options.scope.includeSummaries
      ? await this.fetchSummaries(options.scope)
      : [];
    const sessions = options.scope.includeSessions
      ? await this.fetchSessions(options.scope, observations)
      : [];

    const processedObservations = observations.map(obs =>
      this.processObservationForSharing(obs, privacyLevel)
    );

    const stats = this.calculateStats(
      processedObservations,
      summaries.map(s => this.processSummaryForSharing(s, privacyLevel)),
      sessions.map(s => this.processSessionForSharing(s, privacyLevel)),
      privacyLevel
    );

    // Return first 5 observations as samples
    return {
      stats,
      sampleObservations: processedObservations.slice(0, 5),
    };
  }

  /**
   * Import a share bundle
   */
  async importShare(
    bundle: ShareBundle,
    options: ImportShareOptions = {}
  ): Promise<ImportShareResult> {
    const { shareId } = bundle.metadata;

    logger.info(`Importing share ${shareId}`, { options });

    // Verify checksum
    const calculatedChecksum = this.calculateChecksum({ ...bundle, checksum: '' });
    if (calculatedChecksum !== bundle.checksum) {
      logger.warn(`Checksum mismatch for share ${shareId}`);
    }

    // Detect conflicts
    const conflicts = await this.detectConflicts(bundle);

    if (options.dryRun) {
      return {
        success: true,
        stats: {
          observationsImported: bundle.observations.length,
          observationsSkipped: 0,
          observationsErrors: 0,
          summariesImported: bundle.summaries?.length ?? 0,
          summariesSkipped: 0,
          summariesErrors: 0,
          sessionsImported: bundle.sessions?.length ?? 0,
          sessionsSkipped: 0,
          sessionsErrors: 0,
        },
        conflicts,
        importedAt: new Date().toISOString(),
        shareId,
      };
    }

    const result: ImportShareResult = {
      success: true,
      stats: {
        observationsImported: 0,
        observationsSkipped: 0,
        observationsErrors: 0,
        summariesImported: 0,
        summariesSkipped: 0,
        summariesErrors: 0,
        sessionsImported: 0,
        sessionsSkipped: 0,
        sessionsErrors: 0,
      },
      conflicts,
      importedAt: new Date().toISOString(),
      shareId,
    };

    // Import sessions first (observations reference them)
    if (bundle.sessions) {
      for (const session of bundle.sessions) {
        try {
          const project = this.applyProjectTransform(session.project, options);

          // Check if session exists
          const existing = await this.deps.sessions.findByContentSessionId(
            session.originalContentSessionId
          );

          if (existing && options.skipExisting) {
            result.stats.sessionsSkipped++;
            continue;
          }

          if (!existing) {
            const input: CreateSessionInput = {
              contentSessionId: session.originalContentSessionId,
              memorySessionId: session.memorySessionId,
              project,
              userPrompt: session.userPrompt,
            };
            await this.deps.sessions.create(input);
            result.stats.sessionsImported++;
          } else {
            result.stats.sessionsSkipped++;
          }
        } catch (error) {
          logger.error('Failed to import session', { error: (error as Error).message });
          result.stats.sessionsErrors++;
        }
      }
    }

    // Import observations
    for (const obs of bundle.observations) {
      try {
        const project = this.applyProjectTransform(obs.project, options);

        const input: CreateObservationInput = {
          memorySessionId: obs.memorySessionId,
          project,
          text: obs.text,
          type: obs.type,
          title: obs.title,
          subtitle: obs.subtitle,
          concepts: obs.concepts,
          facts: obs.facts,
          narrative: obs.narrative,
          filesRead: obs.filesRead,
          filesModified: obs.filesModified,
          promptNumber: obs.promptNumber,
          discoveryTokens: obs.discoveryTokens,
          gitBranch: obs.gitBranch,
        };

        await this.deps.observations.create(input);
        result.stats.observationsImported++;
      } catch (error) {
        logger.error('Failed to import observation', { error: (error as Error).message });
        result.stats.observationsErrors++;
      }
    }

    // Import summaries
    if (bundle.summaries) {
      for (const summary of bundle.summaries) {
        try {
          const project = this.applyProjectTransform(summary.project, options);

          const input: CreateSummaryInput = {
            memorySessionId: summary.memorySessionId,
            project,
            request: summary.request,
            investigated: summary.investigated,
            learned: summary.learned,
            completed: summary.completed,
            nextSteps: summary.nextSteps,
            promptNumber: summary.promptNumber,
            discoveryTokens: summary.discoveryTokens,
          };

          await this.deps.summaries.create(input);
          result.stats.summariesImported++;
        } catch (error) {
          logger.error('Failed to import summary', { error: (error as Error).message });
          result.stats.summariesErrors++;
        }
      }
    }

    // Log the import
    this.addAuditEntry(shareId, 'imported', undefined, {
      stats: result.stats,
      conflicts: result.conflicts.length,
    });

    result.success =
      result.stats.observationsErrors === 0 &&
      result.stats.summariesErrors === 0 &&
      result.stats.sessionsErrors === 0;

    logger.info(`Share ${shareId} imported`, { stats: result.stats });
    return result;
  }

  /**
   * Validate a share bundle
   */
  validateBundle(bundle: ShareBundle): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!bundle.metadata) {
      errors.push('Missing metadata');
    } else {
      if (!bundle.metadata.shareId) errors.push('Missing shareId');
      if (!bundle.metadata.formatVersion) errors.push('Missing formatVersion');
      if (!bundle.metadata.createdAt) errors.push('Missing createdAt');
    }

    if (!bundle.observations || !Array.isArray(bundle.observations)) {
      errors.push('Missing or invalid observations array');
    } else {
      for (let i = 0; i < bundle.observations.length; i++) {
        const obs = bundle.observations[i];
        if (!obs.memorySessionId) errors.push(`Observation ${i}: missing memorySessionId`);
        if (!obs.project) errors.push(`Observation ${i}: missing project`);
        if (!obs.text) errors.push(`Observation ${i}: missing text`);
        if (!obs.type) errors.push(`Observation ${i}: missing type`);
      }
    }

    // Verify checksum
    const calculatedChecksum = this.calculateChecksum({ ...bundle, checksum: '' });
    if (calculatedChecksum !== bundle.checksum) {
      errors.push('Checksum verification failed');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get audit log entries for a share
   */
  getAuditLog(shareId?: string): ShareAuditEntry[] {
    if (shareId) {
      return this.auditLog.filter(entry => entry.shareId === shareId);
    }
    return [...this.auditLog];
  }

  // =====================================
  // Private helper methods
  // =====================================

  private generateShareId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `share_${timestamp}_${random}`;
  }

  private async fetchObservations(scope: CreateShareOptions['scope']): Promise<ObservationRecord[]> {
    const filters: Record<string, unknown> = {};

    if (scope.projects && scope.projects.length === 1) {
      filters.project = scope.projects[0];
    }

    if (scope.types && scope.types.length === 1) {
      filters.type = scope.types[0];
    }

    if (scope.dateRange?.start || scope.dateRange?.end) {
      filters.dateRange = scope.dateRange;
    }

    const observations = await this.deps.observations.list(
      filters,
      { limit: scope.limit ?? 10000 }
    );

    // Additional filtering for multiple projects/types
    let filtered = observations;

    if (scope.projects && scope.projects.length > 1) {
      filtered = filtered.filter(obs => scope.projects!.includes(obs.project));
    }

    if (scope.types && scope.types.length > 1) {
      filtered = filtered.filter(obs => scope.types!.includes(obs.type));
    }

    // Filter by tags/concepts
    if (scope.tags && scope.tags.length > 0) {
      filtered = filtered.filter(obs => {
        if (!obs.concepts) return false;
        const concepts = obs.concepts.toLowerCase();
        return scope.tags!.some(tag => concepts.includes(tag.toLowerCase()));
      });
    }

    return filtered;
  }

  private async fetchSummaries(scope: CreateShareOptions['scope']): Promise<SessionSummaryRecord[]> {
    const filters: Record<string, unknown> = {};

    if (scope.projects && scope.projects.length === 1) {
      filters.project = scope.projects[0];
    }

    const summaries = await this.deps.summaries.list(filters, { limit: scope.limit ?? 10000 });

    if (scope.projects && scope.projects.length > 1) {
      return summaries.filter(sum => scope.projects!.includes(sum.project));
    }

    return summaries;
  }

  private async fetchSessions(
    scope: CreateShareOptions['scope'],
    observations: ObservationRecord[]
  ): Promise<SdkSessionRecord[]> {
    // Get unique session IDs from observations (filter out nulls)
    const sessionIds = [...new Set(
      observations
        .map(obs => obs.memory_session_id)
        .filter((id): id is string => id !== null && id !== undefined)
    )];

    const sessions: SdkSessionRecord[] = [];
    for (const sessionId of sessionIds) {
      const session = await this.deps.sessions.findByMemorySessionId(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  private processObservationForSharing(
    obs: ObservationRecord,
    privacyLevel: SharePrivacyLevel
  ): ShareableObservation {
    const sessionId = obs.memory_session_id ?? '';
    const shareable: ShareableObservation = {
      originalId: obs.id,
      memorySessionId: privacyLevel === 'anonymous'
        ? this.anonymizeId(sessionId)
        : sessionId,
      project: obs.project,
      text: obs.text ? this.applyPrivacy(obs.text, privacyLevel) : '',
      type: obs.type,
      title: obs.title ?? undefined,
      subtitle: obs.subtitle ?? undefined,
      concepts: obs.concepts ?? undefined,
      facts: obs.facts ?? undefined,
      narrative: obs.narrative ? this.applyPrivacy(obs.narrative, privacyLevel) : undefined,
      filesRead: privacyLevel !== 'full' ? undefined : (obs.files_read ?? undefined),
      filesModified: privacyLevel !== 'full' ? undefined : (obs.files_modified ?? undefined),
      promptNumber: obs.prompt_number ?? undefined,
      discoveryTokens: obs.discovery_tokens ?? undefined,
      gitBranch: obs.git_branch ?? undefined,
      createdAt: obs.created_at,
      memoryTier: obs.memory_tier ?? undefined,
      importanceBoost: obs.importance_boost ?? undefined,
      pinned: obs.pinned ?? false,
    };

    return shareable;
  }

  private processSummaryForSharing(
    sum: SessionSummaryRecord,
    privacyLevel: SharePrivacyLevel
  ): ShareableSummary {
    return {
      originalId: sum.id,
      memorySessionId: privacyLevel === 'anonymous'
        ? this.anonymizeId(sum.memory_session_id)
        : sum.memory_session_id,
      project: sum.project,
      request: sum.request ? this.applyPrivacy(sum.request, privacyLevel) : undefined,
      investigated: sum.investigated ? this.applyPrivacy(sum.investigated, privacyLevel) : undefined,
      learned: sum.learned ? this.applyPrivacy(sum.learned, privacyLevel) : undefined,
      completed: sum.completed ? this.applyPrivacy(sum.completed, privacyLevel) : undefined,
      nextSteps: sum.next_steps ? this.applyPrivacy(sum.next_steps, privacyLevel) : undefined,
      promptNumber: sum.prompt_number,
      discoveryTokens: sum.discovery_tokens,
      createdAt: sum.created_at,
    };
  }

  private processSessionForSharing(
    sess: SdkSessionRecord,
    privacyLevel: SharePrivacyLevel
  ): ShareableSession {
    const memorySessionId = sess.memory_session_id ?? '';
    return {
      originalContentSessionId: privacyLevel === 'anonymous'
        ? this.anonymizeId(sess.content_session_id)
        : sess.content_session_id,
      memorySessionId: privacyLevel === 'anonymous'
        ? this.anonymizeId(memorySessionId)
        : memorySessionId,
      project: sess.project,
      userPrompt: sess.user_prompt
        ? this.applyPrivacy(sess.user_prompt, privacyLevel)
        : undefined,
      status: sess.status,
      workingDirectory: privacyLevel === 'full' ? (sess.working_directory ?? undefined) : undefined,
      createdAt: sess.started_at,
    };
  }

  private applyPrivacy(text: string, level: SharePrivacyLevel): string {
    if (level === 'full') {
      return text;
    }

    // Redact secrets
    const { text: redacted } = redactSecrets(text);
    return redacted;
  }

  private anonymizeId(id: string): string {
    const hash = crypto.createHash('sha256').update(id).digest('hex');
    return hash.substring(0, 16);
  }

  private calculateStats(
    observations: ShareableObservation[],
    summaries: ShareableSummary[],
    sessions: ShareableSession[],
    privacyLevel: SharePrivacyLevel
  ): ShareStats {
    const projects = new Set<string>();
    const typeBreakdown: Record<string, number> = {};
    let oldest: string | undefined;
    let newest: string | undefined;
    let redactedCount = 0;

    for (const obs of observations) {
      projects.add(obs.project);
      typeBreakdown[obs.type] = (typeBreakdown[obs.type] || 0) + 1;

      if (!oldest || obs.createdAt < oldest) oldest = obs.createdAt;
      if (!newest || obs.createdAt > newest) newest = obs.createdAt;

      // Count redactions if privacy level is not 'full'
      if (privacyLevel !== 'full' && obs.text.includes('[REDACTED:')) {
        redactedCount++;
      }
    }

    return {
      observationCount: observations.length,
      summaryCount: summaries.length,
      sessionCount: sessions.length,
      projectCount: projects.size,
      typeBreakdown,
      dateRange: { oldest, newest },
      redactedCount: privacyLevel !== 'full' ? redactedCount : undefined,
    };
  }

  private calculateChecksum(bundle: Omit<ShareBundle, 'checksum'> & { checksum: string }): string {
    const content = JSON.stringify({
      metadata: bundle.metadata,
      observations: bundle.observations,
      summaries: bundle.summaries,
      sessions: bundle.sessions,
    });
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async detectConflicts(bundle: ShareBundle): Promise<ImportConflict[]> {
    const conflicts: ImportConflict[] = [];

    // Check format version compatibility
    const [major] = bundle.metadata.formatVersion.split('.').map(Number);
    const [currentMajor] = FORMAT_VERSION.split('.').map(Number);

    if (major !== currentMajor) {
      conflicts.push({
        type: 'version_mismatch',
        description: `Share format version ${bundle.metadata.formatVersion} may not be compatible with current version ${FORMAT_VERSION}`,
        affectedItems: [],
        resolution: 'Import may proceed but some fields could be missing or incompatible',
      });
    }

    return conflicts;
  }

  private applyProjectTransform(project: string, options: ImportShareOptions): string {
    if (options.targetProject) {
      return options.targetProject;
    }
    if (options.projectPrefix) {
      return `${options.projectPrefix}${project}`;
    }
    return project;
  }

  private addAuditEntry(
    shareId: string,
    action: ShareAuditEntry['action'],
    actor?: string,
    details?: Record<string, unknown>
  ): void {
    this.auditLog.push({
      id: ++this.auditIdCounter,
      shareId,
      action,
      actor,
      timestamp: new Date().toISOString(),
      details,
    });

    // Keep only last 1000 entries
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
  }
}

/**
 * Create a share service instance
 */
export function createShareService(deps: ShareServiceDeps): ShareService {
  return new ShareService(deps);
}

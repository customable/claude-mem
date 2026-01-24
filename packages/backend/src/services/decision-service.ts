/**
 * Decision Service
 *
 * Handles conflict detection and decision tracking.
 */

import { createLogger } from '@claude-mem/shared';
import type {
  IUnitOfWork,
  ObservationRecord,
  DecisionCategory,
  ConflictCheckResult,
  ConflictingDecision,
  DecisionRecord,
} from '@claude-mem/types';

const logger = createLogger('decision-service');

export interface DecisionServiceDeps {
  uow: IUnitOfWork;
}

/**
 * Decision Service
 *
 * Provides conflict detection and decision management.
 */
export class DecisionService {
  constructor(private deps: DecisionServiceDeps) {}

  /**
   * Check for potential conflicts with existing decisions
   */
  async checkConflicts(params: {
    content: string;
    category?: DecisionCategory;
    project: string;
  }): Promise<ConflictCheckResult> {
    const { content, category, project } = params;

    try {
      // Find potentially conflicting decisions using full-text search
      const conflicting = await this.deps.uow.observations.findConflictingDecisions({
        project,
        text: content,
        category,
        limit: 10,
      });

      if (conflicting.length === 0) {
        return { hasConflict: false, conflictingDecisions: [] };
      }

      // Convert to ConflictingDecision format
      const conflictingDecisions: ConflictingDecision[] = conflicting.map((obs, idx) => ({
        observationId: obs.id,
        title: obs.title || 'Untitled Decision',
        text: obs.text || '',
        category: (obs.decision_category as DecisionCategory) || 'architecture',
        similarity: 1 - (idx * 0.1), // Simple decreasing similarity
        conflictType: 'related' as const, // Could be enhanced with AI analysis
        explanation: `Similar decision found in the same project`,
        createdAt: obs.created_at,
      }));

      return {
        hasConflict: conflictingDecisions.length > 0,
        conflictingDecisions,
      };
    } catch (error) {
      logger.error('Failed to check conflicts', { error: String(error) });
      return { hasConflict: false, conflictingDecisions: [] };
    }
  }

  /**
   * Mark a decision as superseded by another
   */
  async supersedeDecision(
    observationId: number,
    supersededBy: number,
    _reason?: string
  ): Promise<ObservationRecord | null> {
    try {
      const result = await this.deps.uow.observations.supersede(observationId, supersededBy);
      if (result) {
        logger.info(`Decision #${observationId} superseded by #${supersededBy}`);
      }
      return result;
    } catch (error) {
      logger.error('Failed to supersede decision', { error: String(error) });
      return null;
    }
  }

  /**
   * Get all decisions for a project
   */
  async getDecisions(project: string, options?: {
    category?: DecisionCategory;
    includeSuperseded?: boolean;
    limit?: number;
  }): Promise<DecisionRecord[]> {
    const observations = await this.deps.uow.observations.getDecisions(project, options);

    return observations.map(obs => ({
      id: obs.id,
      title: obs.title || 'Untitled Decision',
      text: obs.text || '',
      category: (obs.decision_category as DecisionCategory) || 'architecture',
      project: obs.project,
      createdAt: obs.created_at,
      supersededBy: obs.superseded_by,
      supersedes: obs.supersedes,
      supersededAt: obs.superseded_at,
      isActive: !obs.superseded_by,
    }));
  }

  /**
   * Get decision history (chain of supersessions)
   */
  async getDecisionHistory(observationId: number): Promise<DecisionRecord[]> {
    const observations = await this.deps.uow.observations.getDecisionHistory(observationId);

    return observations.map(obs => ({
      id: obs.id,
      title: obs.title || 'Untitled Decision',
      text: obs.text || '',
      category: (obs.decision_category as DecisionCategory) || 'architecture',
      project: obs.project,
      createdAt: obs.created_at,
      supersededBy: obs.superseded_by,
      supersedes: obs.supersedes,
      supersededAt: obs.superseded_at,
      isActive: !obs.superseded_by,
    }));
  }

  /**
   * Get decision categories with counts
   */
  async getDecisionCategories(project: string): Promise<Array<{
    category: DecisionCategory;
    count: number;
    activeCount: number;
  }>> {
    const allDecisions = await this.deps.uow.observations.getDecisions(project, {
      includeSuperseded: true,
      limit: 10000,
    });

    const categoryMap = new Map<DecisionCategory, { total: number; active: number }>();

    for (const obs of allDecisions) {
      const category = (obs.decision_category as DecisionCategory) || 'architecture';
      const existing = categoryMap.get(category) || { total: 0, active: 0 };
      existing.total++;
      if (!obs.superseded_by) {
        existing.active++;
      }
      categoryMap.set(category, existing);
    }

    return Array.from(categoryMap.entries()).map(([category, counts]) => ({
      category,
      count: counts.total,
      activeCount: counts.active,
    }));
  }
}

/**
 * Create decision service
 */
export function createDecisionService(deps: DecisionServiceDeps): DecisionService {
  return new DecisionService(deps);
}

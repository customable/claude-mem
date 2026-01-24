/**
 * Suggestion Service
 *
 * AI-powered memory suggestions based on current context.
 * Analyzes current work and suggests relevant past observations.
 */

import { createLogger } from '@claude-mem/shared';
import type { IObservationRepository, ObservationRecord, ObservationType } from '@claude-mem/types';

const logger = createLogger('suggestion-service');

/**
 * Context for generating suggestions
 */
export interface SuggestionContext {
  /** Current project */
  project?: string;
  /** Current file path */
  filePath?: string;
  /** Current directory */
  cwd?: string;
  /** Keywords from current work */
  keywords?: string[];
  /** Current observation types of interest */
  types?: ObservationType[];
  /** Error message if debugging */
  errorMessage?: string;
  /** Code snippet being worked on */
  codeSnippet?: string;
}

/**
 * A memory suggestion
 */
export interface Suggestion {
  /** Observation ID */
  id: number;
  /** Observation record */
  observation: ObservationRecord;
  /** Relevance score (0-1) */
  relevance: number;
  /** Why this was suggested */
  reason: string;
  /** Match type */
  matchType: 'file' | 'project' | 'keyword' | 'error' | 'recent' | 'similar';
}

/**
 * Suggestion feedback
 */
export interface SuggestionFeedback {
  suggestionId: number;
  observationId: number;
  context: SuggestionContext;
  helpful: boolean;
  timestamp: number;
}

export interface SuggestionServiceOptions {
  observations: IObservationRepository;
}

export class SuggestionService {
  private readonly observations: IObservationRepository;

  // In-memory feedback store (could be persisted to DB later)
  private feedbackHistory: SuggestionFeedback[] = [];

  // Cache for recent suggestions to avoid duplicates
  private recentSuggestions: Map<string, { suggestions: Suggestion[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60 * 1000; // 1 minute

  constructor(options: SuggestionServiceOptions) {
    this.observations = options.observations;
  }

  /**
   * Get suggestions based on context
   */
  async getSuggestions(context: SuggestionContext, limit = 5): Promise<Suggestion[]> {
    const cacheKey = this.getCacheKey(context);

    // Check cache
    const cached = this.recentSuggestions.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.suggestions.slice(0, limit);
    }

    const suggestions: Suggestion[] = [];

    try {
      // 1. File-based suggestions (same file modified before)
      if (context.filePath) {
        const fileResults = await this.findByFile(context.filePath, context.project);
        suggestions.push(...fileResults);
      }

      // 2. Error-based suggestions (similar errors encountered)
      if (context.errorMessage) {
        const errorResults = await this.findByError(context.errorMessage, context.project);
        suggestions.push(...errorResults);
      }

      // 3. Keyword-based suggestions
      if (context.keywords && context.keywords.length > 0) {
        const keywordResults = await this.findByKeywords(context.keywords, context.project);
        suggestions.push(...keywordResults);
      }

      // 4. Project context suggestions (recent important observations)
      if (context.project) {
        const projectResults = await this.findByProject(context.project);
        suggestions.push(...projectResults);
      }

      // 5. CWD-based suggestions (work in same directory)
      if (context.cwd) {
        const cwdResults = await this.findByCwd(context.cwd, context.project);
        suggestions.push(...cwdResults);
      }

      // Deduplicate and sort by relevance
      const uniqueSuggestions = this.deduplicateAndSort(suggestions);

      // Apply feedback learning (boost/demote based on past feedback)
      const rankedSuggestions = this.applyFeedbackLearning(uniqueSuggestions, context);

      // Cache results
      this.recentSuggestions.set(cacheKey, {
        suggestions: rankedSuggestions,
        timestamp: Date.now(),
      });

      return rankedSuggestions.slice(0, limit);
    } catch (error) {
      logger.error('Error generating suggestions:', { error: (error as Error).message });
      return [];
    }
  }

  /**
   * Record feedback for a suggestion
   */
  recordFeedback(observationId: number, context: SuggestionContext, helpful: boolean): void {
    this.feedbackHistory.push({
      suggestionId: Date.now(), // Simple ID
      observationId,
      context,
      helpful,
      timestamp: Date.now(),
    });

    // Keep only last 1000 feedback entries
    if (this.feedbackHistory.length > 1000) {
      this.feedbackHistory = this.feedbackHistory.slice(-1000);
    }

    logger.debug('Recorded suggestion feedback', { observationId, helpful });
  }

  /**
   * Get feedback statistics
   */
  getFeedbackStats(): { total: number; helpful: number; notHelpful: number; helpfulRate: number } {
    const total = this.feedbackHistory.length;
    const helpful = this.feedbackHistory.filter(f => f.helpful).length;
    const notHelpful = total - helpful;
    const helpfulRate = total > 0 ? helpful / total : 0;

    return { total, helpful, notHelpful, helpfulRate };
  }

  /**
   * Find observations related to a specific file
   */
  private async findByFile(filePath: string, project?: string): Promise<Suggestion[]> {
    // Extract filename for search
    const filename = filePath.split('/').pop() || filePath;

    const results = await this.observations.search(
      filename,
      { project },
      { limit: 10 }
    );

    return results
      .filter(obs => {
        // Check if observation mentions this file
        const filesRead = obs.files_read ? JSON.parse(obs.files_read) : [];
        const filesModified = obs.files_modified ? JSON.parse(obs.files_modified) : [];
        return filesRead.includes(filePath) ||
               filesModified.includes(filePath) ||
               filesRead.some((f: string) => f.endsWith(filename)) ||
               filesModified.some((f: string) => f.endsWith(filename));
      })
      .map(obs => ({
        id: obs.id,
        observation: obs,
        relevance: 0.9,
        reason: `Previously worked on ${filename}`,
        matchType: 'file' as const,
      }));
  }

  /**
   * Find observations related to similar errors
   */
  private async findByError(errorMessage: string, project?: string): Promise<Suggestion[]> {
    // Extract key error terms
    const errorTerms = errorMessage
      .split(/[\s:]+/)
      .filter(term => term.length > 3)
      .slice(0, 5)
      .join(' ');

    if (!errorTerms) return [];

    const results = await this.observations.search(
      errorTerms,
      { project, type: ['bugfix', 'discovery'] as any },
      { limit: 10 }
    );

    return results.map(obs => ({
      id: obs.id,
      observation: obs,
      relevance: 0.85,
      reason: 'Similar error encountered before',
      matchType: 'error' as const,
    }));
  }

  /**
   * Find observations matching keywords
   */
  private async findByKeywords(keywords: string[], project?: string): Promise<Suggestion[]> {
    const query = keywords.join(' ');

    const results = await this.observations.search(
      query,
      { project },
      { limit: 15 }
    );

    return results.map(obs => ({
      id: obs.id,
      observation: obs,
      relevance: 0.7,
      reason: `Matches: ${keywords.slice(0, 3).join(', ')}`,
      matchType: 'keyword' as const,
    }));
  }

  /**
   * Find recent important observations for a project
   */
  private async findByProject(project: string): Promise<Suggestion[]> {
    // Get pinned and high-importance observations
    const pinned = await this.observations.getPinnedObservations(project);
    const important = await this.observations.getByImportance({ project, limit: 5 });

    const combined = [...pinned, ...important];
    const unique = Array.from(new Map(combined.map(o => [o.id, o])).values());

    return unique.slice(0, 5).map(obs => ({
      id: obs.id,
      observation: obs,
      relevance: obs.pinned ? 0.95 : 0.6,
      reason: obs.pinned ? 'Pinned for this project' : 'Important for this project',
      matchType: 'project' as const,
    }));
  }

  /**
   * Find observations from work in the same directory
   */
  private async findByCwd(cwd: string, project?: string): Promise<Suggestion[]> {
    const results = await this.observations.list(
      { project, cwdPrefix: cwd },
      { limit: 10, orderBy: 'created_at_epoch', order: 'desc' }
    );

    return results.map(obs => ({
      id: obs.id,
      observation: obs,
      relevance: 0.65,
      reason: 'Recent work in this directory',
      matchType: 'recent' as const,
    }));
  }

  /**
   * Deduplicate suggestions and sort by relevance
   */
  private deduplicateAndSort(suggestions: Suggestion[]): Suggestion[] {
    const seen = new Map<number, Suggestion>();

    for (const suggestion of suggestions) {
      const existing = seen.get(suggestion.id);
      if (!existing || suggestion.relevance > existing.relevance) {
        seen.set(suggestion.id, suggestion);
      }
    }

    return Array.from(seen.values())
      .sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Apply feedback learning to adjust relevance scores
   */
  private applyFeedbackLearning(suggestions: Suggestion[], context: SuggestionContext): Suggestion[] {
    // Simple learning: boost observations that were helpful before, demote unhelpful ones
    const feedbackByObservation = new Map<number, { helpful: number; notHelpful: number }>();

    for (const feedback of this.feedbackHistory) {
      const stats = feedbackByObservation.get(feedback.observationId) || { helpful: 0, notHelpful: 0 };
      if (feedback.helpful) {
        stats.helpful++;
      } else {
        stats.notHelpful++;
      }
      feedbackByObservation.set(feedback.observationId, stats);
    }

    return suggestions.map(suggestion => {
      const stats = feedbackByObservation.get(suggestion.observation.id);
      if (!stats) return suggestion;

      // Adjust relevance based on feedback
      const feedbackScore = (stats.helpful - stats.notHelpful) / (stats.helpful + stats.notHelpful);
      const adjustedRelevance = Math.max(0, Math.min(1, suggestion.relevance + feedbackScore * 0.2));

      return {
        ...suggestion,
        relevance: adjustedRelevance,
      };
    }).sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Generate cache key for context
   */
  private getCacheKey(context: SuggestionContext): string {
    return JSON.stringify({
      project: context.project,
      filePath: context.filePath,
      cwd: context.cwd,
      keywords: context.keywords?.sort(),
    });
  }

  /**
   * Clear suggestion cache
   */
  clearCache(): void {
    this.recentSuggestions.clear();
  }
}

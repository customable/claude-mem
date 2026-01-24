/**
 * Insights Service
 *
 * Business logic for learning insights, daily stats, achievements, and technology tracking.
 */

import { createLogger } from '@claude-mem/shared';
import type {
  IDailyStatsRepository,
  ITechnologyUsageRepository,
  IAchievementRepository,
  IObservationRepository,
  InsightsSummary,
  DailyStatsRecord,
  TechnologyUsageRecord,
  AchievementProgress,
  ACHIEVEMENT_DEFINITIONS,
  AchievementDefinition,
} from '@claude-mem/types';

const logger = createLogger('insights-service');

// Achievement definitions
const ACHIEVEMENTS: AchievementDefinition[] = [
  // ========================================
  // Activity Achievements - Observation Count
  // ========================================
  { id: 'first-observation', name: 'First Memory', description: 'Create your first observation', icon: 'brain', category: 'activity' },
  { id: 'observations-10', name: 'Memory Keeper', description: 'Create 10 observations', icon: 'database', category: 'activity', threshold: 10 },
  { id: 'observations-100', name: 'Memory Master', description: 'Create 100 observations', icon: 'trophy', category: 'activity', threshold: 100 },
  { id: 'observations-500', name: 'Memory Hoarder', description: 'Create 500 observations', icon: 'archive', category: 'activity', threshold: 500 },
  { id: 'observations-1000', name: 'Memory Legend', description: 'Create 1,000 observations', icon: 'crown', category: 'activity', threshold: 1000 },
  { id: 'observations-5000', name: 'Memory Titan', description: 'Create 5,000 observations', icon: 'gem', category: 'activity', threshold: 5000 },
  { id: 'observations-10000', name: 'Memory God', description: 'Create 10,000 observations', icon: 'sparkles', category: 'activity', threshold: 10000 },

  // ========================================
  // Session Achievements
  // ========================================
  { id: 'first-session', name: 'Hello World', description: 'Complete your first coding session', icon: 'play', category: 'activity' },
  { id: 'sessions-10', name: 'Regular', description: 'Complete 10 coding sessions', icon: 'repeat', category: 'activity', threshold: 10 },
  { id: 'sessions-50', name: 'Dedicated', description: 'Complete 50 coding sessions', icon: 'heart', category: 'activity', threshold: 50 },
  { id: 'sessions-100', name: 'Committed', description: 'Complete 100 coding sessions', icon: 'medal', category: 'activity', threshold: 100 },
  { id: 'sessions-500', name: 'Veteran', description: 'Complete 500 coding sessions', icon: 'award', category: 'activity', threshold: 500 },
  { id: 'sessions-1000', name: 'Grandmaster', description: 'Complete 1,000 coding sessions', icon: 'crown', category: 'activity', threshold: 1000 },

  // ========================================
  // Token Achievements - AI Collaboration
  // ========================================
  { id: 'tokens-100k', name: 'Chatterbox', description: 'Use 100K tokens with AI', icon: 'message-circle', category: 'activity', threshold: 100000 },
  { id: 'tokens-1m', name: 'Conversationalist', description: 'Use 1M tokens with AI', icon: 'messages-square', category: 'activity', threshold: 1000000 },
  { id: 'tokens-10m', name: 'Deep Thinker', description: 'Use 10M tokens with AI', icon: 'brain', category: 'activity', threshold: 10000000 },
  { id: 'tokens-50m', name: 'AI Whisperer', description: 'Use 50M tokens with AI', icon: 'bot', category: 'activity', threshold: 50000000 },
  { id: 'tokens-100m', name: 'Token Billionaire', description: 'Use 100M tokens with AI', icon: 'coins', category: 'activity', threshold: 100000000 },
  { id: 'tokens-500m', name: 'Infinite Context', description: 'Use 500M tokens with AI', icon: 'infinity', category: 'activity', threshold: 500000000 },

  // ========================================
  // Learning Achievements - Decisions
  // ========================================
  { id: 'first-decision', name: 'Decision Maker', description: 'Record your first architectural decision', icon: 'git-branch', category: 'learning' },
  { id: 'decisions-10', name: 'Architect', description: 'Make 10 architectural decisions', icon: 'layout', category: 'learning', threshold: 10 },
  { id: 'decisions-50', name: 'Senior Architect', description: 'Make 50 architectural decisions', icon: 'building', category: 'learning', threshold: 50 },
  { id: 'decisions-100', name: 'Chief Architect', description: 'Make 100 architectural decisions', icon: 'castle', category: 'learning', threshold: 100 },

  // ========================================
  // Learning Achievements - Bug Fixes
  // ========================================
  { id: 'first-bugfix', name: 'First Blood', description: 'Fix your first bug', icon: 'bug', category: 'learning' },
  { id: 'bug-hunter-10', name: 'Bug Hunter', description: 'Fix 10 bugs', icon: 'bug', category: 'learning', threshold: 10 },
  { id: 'bug-hunter-50', name: 'Bug Slayer', description: 'Fix 50 bugs', icon: 'shield', category: 'learning', threshold: 50 },
  { id: 'bug-hunter-100', name: 'Exterminator', description: 'Fix 100 bugs', icon: 'zap', category: 'learning', threshold: 100 },
  { id: 'bug-hunter-500', name: 'Bug Whisperer', description: 'Fix 500 bugs', icon: 'sparkles', category: 'learning', threshold: 500 },

  // ========================================
  // Learning Achievements - Discoveries
  // ========================================
  { id: 'first-discovery', name: 'Explorer', description: 'Make your first discovery', icon: 'compass', category: 'learning' },
  { id: 'discoveries-10', name: 'Curious Mind', description: 'Make 10 discoveries', icon: 'lightbulb', category: 'learning', threshold: 10 },
  { id: 'discoveries-50', name: 'Knowledge Seeker', description: 'Make 50 discoveries', icon: 'book-open', category: 'learning', threshold: 50 },
  { id: 'discoveries-100', name: 'Enlightened', description: 'Make 100 discoveries', icon: 'sun', category: 'learning', threshold: 100 },
  { id: 'discoveries-500', name: 'Sage', description: 'Make 500 discoveries', icon: 'scroll', category: 'learning', threshold: 500 },

  // ========================================
  // Learning Achievements - Languages
  // ========================================
  { id: 'polyglot-3', name: 'Polyglot', description: 'Work with 3+ programming languages', icon: 'globe', category: 'learning', threshold: 3 },
  { id: 'polyglot-5', name: 'Language Master', description: 'Work with 5+ programming languages', icon: 'star', category: 'learning', threshold: 5 },
  { id: 'polyglot-10', name: 'Universal Translator', description: 'Work with 10+ programming languages', icon: 'languages', category: 'learning', threshold: 10 },

  // ========================================
  // Milestone Achievements - Projects
  // ========================================
  { id: 'projects-3', name: 'Multi-tasker', description: 'Work on 3 different projects', icon: 'folder', category: 'milestone', threshold: 3 },
  { id: 'projects-10', name: 'Project Pro', description: 'Work on 10 different projects', icon: 'briefcase', category: 'milestone', threshold: 10 },
  { id: 'projects-25', name: 'Portfolio Builder', description: 'Work on 25 different projects', icon: 'folders', category: 'milestone', threshold: 25 },
  { id: 'projects-50', name: 'Project Mogul', description: 'Work on 50 different projects', icon: 'building-2', category: 'milestone', threshold: 50 },

  // ========================================
  // Milestone Achievements - Deep Dive
  // ========================================
  { id: 'deep-dive-100', name: 'Deep Diver', description: '100+ observations in one project', icon: 'target', category: 'milestone', threshold: 100 },
  { id: 'deep-dive-500', name: 'Domain Expert', description: '500+ observations in one project', icon: 'microscope', category: 'milestone', threshold: 500 },
  { id: 'deep-dive-1000', name: 'Project Guru', description: '1,000+ observations in one project', icon: 'graduation-cap', category: 'milestone', threshold: 1000 },
  { id: 'deep-dive-5000', name: 'Living Documentation', description: '5,000+ observations in one project', icon: 'book', category: 'milestone', threshold: 5000 },

  // ========================================
  // Streak Achievements
  // ========================================
  { id: 'streak-3', name: 'Getting Started', description: '3-day coding streak', icon: 'flame', category: 'streak', threshold: 3 },
  { id: 'streak-7', name: 'Week Warrior', description: '7-day coding streak', icon: 'fire', category: 'streak', threshold: 7 },
  { id: 'streak-14', name: 'Fortnight Fighter', description: '14-day coding streak', icon: 'trending-up', category: 'streak', threshold: 14 },
  { id: 'streak-30', name: 'Month Champion', description: '30-day coding streak', icon: 'rocket', category: 'streak', threshold: 30 },
  { id: 'streak-60', name: 'Unstoppable', description: '60-day coding streak', icon: 'zap', category: 'streak', threshold: 60 },
  { id: 'streak-100', name: 'Century Coder', description: '100-day coding streak', icon: 'medal', category: 'streak', threshold: 100 },
  { id: 'streak-365', name: 'Year of Code', description: '365-day coding streak', icon: 'calendar-check', category: 'streak', threshold: 365 },

  // ========================================
  // Special Achievements
  // ========================================
  { id: 'first-error', name: 'Learning Opportunity', description: 'Document your first error', icon: 'alert-triangle', category: 'learning' },
  { id: 'night-owl', name: 'Night Owl', description: 'Code between midnight and 4 AM', icon: 'moon', category: 'special' },
  { id: 'early-bird', name: 'Early Bird', description: 'Code between 5 AM and 7 AM', icon: 'sunrise', category: 'special' },
  { id: 'weekend-warrior', name: 'Weekend Warrior', description: 'Code on 10 different weekends', icon: 'calendar', category: 'special', threshold: 10 },
  { id: 'marathon', name: 'Marathon Session', description: 'Single session with 50+ observations', icon: 'timer', category: 'special', threshold: 50 },
  { id: 'comeback', name: 'The Comeback', description: 'Return to coding after 7+ days break', icon: 'rotate-ccw', category: 'special' },
  { id: 'perfectionist', name: 'Perfectionist', description: 'Have a session with 0 errors', icon: 'check-circle', category: 'special' },
  { id: 'refactoring-hero', name: 'Refactoring Hero', description: 'Complete 10 refactoring sessions', icon: 'wand', category: 'special', threshold: 10 },
];

export class InsightsService {
  constructor(
    private readonly dailyStats: IDailyStatsRepository,
    private readonly technologyUsage: ITechnologyUsageRepository,
    private readonly achievements: IAchievementRepository,
    private readonly observations: IObservationRepository
  ) {}

  /**
   * Get summary insights for a date range
   */
  async getSummary(days: number = 30): Promise<InsightsSummary> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Try from daily_stats first
    const summary = await this.dailyStats.aggregateForPeriod(startDate, endDate);

    // If daily_stats is empty, compute directly from observations
    if (summary.totalObservations === 0) {
      return this.observations.getInsightsSummary(days);
    }

    return summary;
  }

  /**
   * Get recent daily activity
   */
  async getRecentActivity(days: number = 30): Promise<DailyStatsRecord[]> {
    const stats = await this.dailyStats.getRecent(days);

    // If daily_stats is empty, compute from observations
    if (stats.length === 0) {
      const obsStats = await this.observations.getTimelineStats({
        startEpoch: Date.now() - days * 24 * 60 * 60 * 1000,
        period: 'day',
      });

      return obsStats.map((s, idx) => ({
        id: idx,
        date: s.date,
        observation_count: s.observations,
        session_count: 0,
        project_count: 0,
        decision_count: 0,
        error_count: 0,
        bug_fix_count: 0,
        discovery_count: 0,
        tokens_used: s.tokens,
        technologies: null,
        projects: null,
        created_at_epoch: Date.now(),
      }));
    }

    return stats;
  }

  /**
   * Get top technologies
   */
  async getTopTechnologies(limit: number = 10, project?: string): Promise<TechnologyUsageRecord[]> {
    return this.technologyUsage.getTopTechnologies(limit, project);
  }

  /**
   * Get all achievements with progress
   */
  async getAchievements(): Promise<AchievementProgress[]> {
    const records = await this.achievements.getAll();
    const recordMap = new Map(records.map(r => [r.achievement_id, r]));

    return ACHIEVEMENTS.map(def => {
      const record = recordMap.get(def.id);
      return {
        definition: def,
        progress: record?.progress ?? 0,
        unlocked: record?.unlocked_at_epoch != null,
        unlockedAt: record?.unlocked_at_epoch ?? undefined,
      };
    });
  }

  /**
   * Update daily stats for today
   */
  async updateDailyStats(params: {
    observationCount?: number;
    sessionCount?: number;
    projectCount?: number;
    decisionCount?: number;
    errorCount?: number;
    bugFixCount?: number;
    discoveryCount?: number;
    tokensUsed?: number;
    technologies?: string[];
    projects?: string[];
  }): Promise<DailyStatsRecord> {
    const today = new Date().toISOString().split('T')[0];
    return this.dailyStats.upsert({
      date: today,
      ...params,
    });
  }

  /**
   * Track technology usage
   */
  async trackTechnology(name: string, category?: string, project?: string): Promise<TechnologyUsageRecord> {
    return this.technologyUsage.upsert({ name, category, project });
  }

  /**
   * Check and update achievements based on current stats
   */
  async checkAchievements(): Promise<AchievementProgress[]> {
    const updated: AchievementProgress[] = [];

    // Get current stats
    const totalObservations = await this.observations.count({});
    const summary = await this.getSummary(365); // Full year for streak calculation
    const technologies = await this.technologyUsage.getTopTechnologies(100);
    const projects = await this.observations.count({}); // Placeholder - need project count

    // Check observation milestones
    if (totalObservations >= 1) {
      const progress = await this.unlockIfNotUnlocked('first-observation');
      if (progress) updated.push(progress);
    }
    if (totalObservations >= 10) {
      const progress = await this.updateProgressIfNeeded('observations-10', totalObservations / 10);
      if (progress) updated.push(progress);
    }
    if (totalObservations >= 100) {
      const progress = await this.updateProgressIfNeeded('observations-100', totalObservations / 100);
      if (progress) updated.push(progress);
    }
    if (totalObservations >= 1000) {
      const progress = await this.updateProgressIfNeeded('observations-1000', totalObservations / 1000);
      if (progress) updated.push(progress);
    }

    // Check technology count (languages)
    const languageCount = technologies.filter(t => t.category === 'language').length;
    if (languageCount >= 3) {
      const progress = await this.updateProgressIfNeeded('polyglot-3', languageCount / 3);
      if (progress) updated.push(progress);
    }
    if (languageCount >= 5) {
      const progress = await this.updateProgressIfNeeded('polyglot-5', languageCount / 5);
      if (progress) updated.push(progress);
    }

    // Check streak achievements
    if (summary.currentStreak >= 3) {
      const progress = await this.updateProgressIfNeeded('streak-3', summary.currentStreak / 3);
      if (progress) updated.push(progress);
    }
    if (summary.currentStreak >= 7) {
      const progress = await this.updateProgressIfNeeded('streak-7', summary.currentStreak / 7);
      if (progress) updated.push(progress);
    }
    if (summary.currentStreak >= 30) {
      const progress = await this.updateProgressIfNeeded('streak-30', summary.currentStreak / 30);
      if (progress) updated.push(progress);
    }

    // Check project milestones
    if (summary.totalProjects >= 3) {
      const progress = await this.updateProgressIfNeeded('projects-3', summary.totalProjects / 3);
      if (progress) updated.push(progress);
    }
    if (summary.totalProjects >= 10) {
      const progress = await this.updateProgressIfNeeded('projects-10', summary.totalProjects / 10);
      if (progress) updated.push(progress);
    }

    logger.debug(`Checked achievements, ${updated.length} updated`);
    return updated;
  }

  /**
   * Unlock an achievement if not already unlocked
   */
  private async unlockIfNotUnlocked(achievementId: string): Promise<AchievementProgress | null> {
    const existing = await this.achievements.getById(achievementId);
    if (existing?.unlocked_at_epoch) return null;

    const record = await this.achievements.unlock(achievementId);
    const definition = ACHIEVEMENTS.find(d => d.id === achievementId);
    if (!definition) return null;

    logger.info(`Achievement unlocked: ${definition.name}`);
    return {
      definition,
      progress: 1,
      unlocked: true,
      unlockedAt: record.unlocked_at_epoch ?? undefined,
    };
  }

  /**
   * Update achievement progress
   */
  private async updateProgressIfNeeded(achievementId: string, progress: number): Promise<AchievementProgress | null> {
    const existing = await this.achievements.getById(achievementId);
    const normalizedProgress = Math.min(1, Math.max(0, progress));

    // Skip if already unlocked or progress hasn't increased
    if (existing?.unlocked_at_epoch || (existing && existing.progress >= normalizedProgress)) {
      return null;
    }

    const record = await this.achievements.updateProgress(achievementId, normalizedProgress);
    const definition = ACHIEVEMENTS.find(d => d.id === achievementId);
    if (!definition) return null;

    if (record.unlocked_at_epoch) {
      logger.info(`Achievement unlocked: ${definition.name}`);
    }

    return {
      definition,
      progress: record.progress,
      unlocked: record.unlocked_at_epoch != null,
      unlockedAt: record.unlocked_at_epoch ?? undefined,
    };
  }

  /**
   * Get activity heatmap data for the past year
   */
  async getActivityHeatmap(): Promise<Array<{ date: string; count: number }>> {
    const stats = await this.dailyStats.getRecent(365);

    // If daily_stats is empty, compute from observations
    if (stats.length === 0) {
      const obsStats = await this.observations.getTimelineStats({
        startEpoch: Date.now() - 365 * 24 * 60 * 60 * 1000,
        period: 'day',
      });

      return obsStats.map(s => ({
        date: s.date,
        count: s.observations,
      }));
    }

    return stats.map(s => ({
      date: s.date,
      count: s.observation_count,
    }));
  }

  /**
   * Get distinct technology categories
   */
  async getTechnologyCategories(): Promise<string[]> {
    return this.technologyUsage.getDistinctCategories();
  }

  /**
   * Get technologies by project
   */
  async getTechnologiesByProject(project: string): Promise<TechnologyUsageRecord[]> {
    return this.technologyUsage.getByProject(project);
  }
}

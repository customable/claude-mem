/**
 * Learning Insights Types
 *
 * Types for the learning insights dashboard including
 * daily stats, technology tracking, and achievements.
 */

// ============================================
// Daily Stats
// ============================================

export interface DailyStatsRecord {
  id: number;
  date: string;
  observation_count: number;
  session_count: number;
  project_count: number;
  decision_count: number;
  error_count: number;
  bug_fix_count: number;
  discovery_count: number;
  tokens_used: number;
  technologies: string | null; // JSON array
  projects: string | null; // JSON array
  created_at_epoch: number;
}

export interface CreateDailyStatsInput {
  date: string;
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
}

// ============================================
// Technology Usage
// ============================================

export interface TechnologyUsageRecord {
  id: number;
  name: string;
  category: string | null;
  first_seen_epoch: number;
  last_used_epoch: number;
  observation_count: number;
  project: string | null;
}

export interface CreateTechnologyUsageInput {
  name: string;
  category?: string;
  project?: string;
}

export type TechnologyCategory =
  | 'language'
  | 'framework'
  | 'library'
  | 'database'
  | 'tool'
  | 'platform'
  | 'other';

// ============================================
// Achievements
// ============================================

export interface AchievementRecord {
  id: number;
  achievement_id: string;
  unlocked_at_epoch: number | null;
  progress: number;
  metadata: string | null; // JSON
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'activity' | 'learning' | 'milestone' | 'streak';
  threshold?: number; // For progress-based achievements
}

export interface AchievementProgress {
  definition: AchievementDefinition;
  progress: number;
  unlocked: boolean;
  unlockedAt?: number;
}

// Built-in achievement definitions
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // Activity achievements
  { id: 'first-observation', name: 'First Memory', description: 'Create your first observation', icon: 'brain', category: 'activity' },
  { id: 'observations-10', name: 'Memory Keeper', description: 'Create 10 observations', icon: 'database', category: 'activity', threshold: 10 },
  { id: 'observations-100', name: 'Memory Master', description: 'Create 100 observations', icon: 'trophy', category: 'activity', threshold: 100 },
  { id: 'observations-1000', name: 'Memory Legend', description: 'Create 1,000 observations', icon: 'crown', category: 'activity', threshold: 1000 },

  // Learning achievements
  { id: 'first-decision', name: 'Decision Maker', description: 'Record your first architectural decision', icon: 'git-branch', category: 'learning' },
  { id: 'bug-hunter-10', name: 'Bug Hunter', description: 'Fix 10 bugs', icon: 'bug', category: 'learning', threshold: 10 },
  { id: 'bug-hunter-50', name: 'Bug Slayer', description: 'Fix 50 bugs', icon: 'shield', category: 'learning', threshold: 50 },
  { id: 'polyglot-3', name: 'Polyglot', description: 'Work with 3+ programming languages', icon: 'globe', category: 'learning', threshold: 3 },
  { id: 'polyglot-5', name: 'Language Master', description: 'Work with 5+ programming languages', icon: 'star', category: 'learning', threshold: 5 },

  // Milestone achievements
  { id: 'projects-3', name: 'Multi-tasker', description: 'Work on 3 different projects', icon: 'folder', category: 'milestone', threshold: 3 },
  { id: 'projects-10', name: 'Project Pro', description: 'Work on 10 different projects', icon: 'briefcase', category: 'milestone', threshold: 10 },
  { id: 'deep-dive-100', name: 'Deep Diver', description: '100+ observations in one project', icon: 'target', category: 'milestone', threshold: 100 },

  // Streak achievements
  { id: 'streak-3', name: 'Getting Started', description: '3-day coding streak', icon: 'flame', category: 'streak', threshold: 3 },
  { id: 'streak-7', name: 'Week Warrior', description: '7-day coding streak', icon: 'fire', category: 'streak', threshold: 7 },
  { id: 'streak-30', name: 'Month Champion', description: '30-day coding streak', icon: 'rocket', category: 'streak', threshold: 30 },
];

// ============================================
// Dashboard Types
// ============================================

export interface InsightsSummary {
  totalObservations: number;
  totalSessions: number;
  totalProjects: number;
  totalDecisions: number;
  totalTokens: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
}

export interface LearningInsight {
  type: 'bug-fix' | 'new-tech' | 'pattern' | 'improvement' | 'discovery';
  title: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
  changePercent?: number;
  examples?: string[];
}

export interface KnowledgeGap {
  area: string;
  reason: 'few-observations' | 'old-observations' | 'many-errors';
  lastActivity: number;
  suggestion: string;
}

export interface ActivityHeatmapData {
  date: string;
  count: number;
}

export interface InsightsDashboard {
  summary: InsightsSummary;
  recentActivity: DailyStatsRecord[];
  topTechnologies: TechnologyUsageRecord[];
  achievements: AchievementProgress[];
  insights: LearningInsight[];
  knowledgeGaps: KnowledgeGap[];
}

// ============================================
// Repository Interfaces
// ============================================

export interface IDailyStatsRepository {
  upsert(input: CreateDailyStatsInput): Promise<DailyStatsRecord>;
  getByDate(date: string): Promise<DailyStatsRecord | null>;
  getRange(startDate: string, endDate: string): Promise<DailyStatsRecord[]>;
  getRecent(days: number): Promise<DailyStatsRecord[]>;
  aggregateForPeriod(startDate: string, endDate: string): Promise<InsightsSummary>;
}

export interface ITechnologyUsageRepository {
  upsert(input: CreateTechnologyUsageInput): Promise<TechnologyUsageRecord>;
  incrementUsage(name: string, project?: string): Promise<TechnologyUsageRecord | null>;
  getTopTechnologies(limit: number, project?: string): Promise<TechnologyUsageRecord[]>;
  getByProject(project: string): Promise<TechnologyUsageRecord[]>;
  getDistinctCategories(): Promise<string[]>;
  count(project?: string): Promise<number>;
}

export interface IAchievementRepository {
  getAll(): Promise<AchievementRecord[]>;
  getById(achievementId: string): Promise<AchievementRecord | null>;
  unlock(achievementId: string): Promise<AchievementRecord>;
  updateProgress(achievementId: string, progress: number): Promise<AchievementRecord>;
  getUnlocked(): Promise<AchievementRecord[]>;
  getInProgress(): Promise<AchievementRecord[]>;
}

/**
 * DailyStats Repository
 *
 * Repository for aggregated daily statistics.
 */

import type { SqlEntityManager } from '@mikro-orm/knex';
import type { IDailyStatsRepository, DailyStatsRecord, CreateDailyStatsInput, InsightsSummary } from '@claude-mem/types';
import { DailyStats } from '../../entities/DailyStats.js';

export class MikroOrmDailyStatsRepository implements IDailyStatsRepository {
  constructor(private em: SqlEntityManager) {}

  async upsert(input: CreateDailyStatsInput): Promise<DailyStatsRecord> {
    const existing = await this.em.findOne(DailyStats, { date: input.date });

    if (existing) {
      // Update existing record
      existing.observation_count = input.observationCount ?? existing.observation_count;
      existing.session_count = input.sessionCount ?? existing.session_count;
      existing.project_count = input.projectCount ?? existing.project_count;
      existing.decision_count = input.decisionCount ?? existing.decision_count;
      existing.error_count = input.errorCount ?? existing.error_count;
      existing.bug_fix_count = input.bugFixCount ?? existing.bug_fix_count;
      existing.discovery_count = input.discoveryCount ?? existing.discovery_count;
      existing.tokens_used = input.tokensUsed ?? existing.tokens_used;
      if (input.technologies) {
        existing.technologies = JSON.stringify(input.technologies);
      }
      if (input.projects) {
        existing.projects = JSON.stringify(input.projects);
      }

      this.em.persist(existing);
      await this.em.flush();
      return this.toRecord(existing);
    }

    // Create new record
    const stats = new DailyStats();
    stats.date = input.date;
    stats.observation_count = input.observationCount ?? 0;
    stats.session_count = input.sessionCount ?? 0;
    stats.project_count = input.projectCount ?? 0;
    stats.decision_count = input.decisionCount ?? 0;
    stats.error_count = input.errorCount ?? 0;
    stats.bug_fix_count = input.bugFixCount ?? 0;
    stats.discovery_count = input.discoveryCount ?? 0;
    stats.tokens_used = input.tokensUsed ?? 0;
    stats.technologies = input.technologies ? JSON.stringify(input.technologies) : undefined;
    stats.projects = input.projects ? JSON.stringify(input.projects) : undefined;
    stats.created_at_epoch = Date.now();

    this.em.persist(stats);
    await this.em.flush();
    return this.toRecord(stats);
  }

  async getByDate(date: string): Promise<DailyStatsRecord | null> {
    const stats = await this.em.findOne(DailyStats, { date });
    return stats ? this.toRecord(stats) : null;
  }

  async getRange(startDate: string, endDate: string): Promise<DailyStatsRecord[]> {
    const stats = await this.em.find(
      DailyStats,
      { date: { $gte: startDate, $lte: endDate } },
      { orderBy: { date: 'ASC' } }
    );
    return stats.map(s => this.toRecord(s));
  }

  async getRecent(days: number): Promise<DailyStatsRecord[]> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return this.getRange(startDate, endDate);
  }

  async aggregateForPeriod(startDate: string, endDate: string): Promise<InsightsSummary> {
    const stats = await this.getRange(startDate, endDate);

    const totalObservations = stats.reduce((sum, s) => sum + s.observation_count, 0);
    const totalSessions = stats.reduce((sum, s) => sum + s.session_count, 0);
    const totalDecisions = stats.reduce((sum, s) => sum + s.decision_count, 0);
    const totalTokens = stats.reduce((sum, s) => sum + s.tokens_used, 0);

    // Count unique projects across all days
    const projectSet = new Set<string>();
    for (const s of stats) {
      if (s.projects) {
        try {
          const projects = JSON.parse(s.projects) as string[];
          projects.forEach(p => projectSet.add(p));
        } catch {
          // Ignore parse errors
        }
      }
    }

    // Calculate active days and streaks
    const activeDays = stats.filter(s => s.observation_count > 0).length;
    const { currentStreak, longestStreak } = this.calculateStreaks(stats);

    return {
      totalObservations,
      totalSessions,
      totalProjects: projectSet.size,
      totalDecisions,
      totalTokens,
      activeDays,
      currentStreak,
      longestStreak,
    };
  }

  private calculateStreaks(stats: DailyStatsRecord[]): { currentStreak: number; longestStreak: number } {
    // Sort by date descending
    const sorted = [...stats].sort((a, b) => b.date.localeCompare(a.date));

    let currentStreak = 0;
    let longestStreak = 0;
    let streak = 0;
    let prevDate: string | null = null;

    for (const s of sorted) {
      if (s.observation_count > 0) {
        if (prevDate === null || this.isConsecutiveDay(prevDate, s.date)) {
          streak++;
        } else {
          // Non-consecutive active day, reset streak
          longestStreak = Math.max(longestStreak, streak);
          streak = 1;
        }
        prevDate = s.date;
      } else if (prevDate !== null && this.isConsecutiveDay(prevDate, s.date)) {
        // Gap day, streak continues but check if it's today
        prevDate = s.date;
      } else {
        // Streak broken
        longestStreak = Math.max(longestStreak, streak);
        streak = 0;
        prevDate = null;
      }
    }

    longestStreak = Math.max(longestStreak, streak);

    // Current streak: count from today backwards
    const today = new Date().toISOString().split('T')[0];
    currentStreak = 0;
    for (const s of sorted) {
      if (s.observation_count > 0 && (s.date === today || this.isWithinDays(s.date, today, currentStreak + 1))) {
        currentStreak++;
      } else if (s.date < today && currentStreak > 0) {
        break;
      }
    }

    return { currentStreak, longestStreak };
  }

  private isConsecutiveDay(prevDate: string, currentDate: string): boolean {
    const prev = new Date(prevDate);
    const current = new Date(currentDate);
    const diffDays = (prev.getTime() - current.getTime()) / (24 * 60 * 60 * 1000);
    return Math.abs(diffDays) <= 1;
  }

  private isWithinDays(date: string, reference: string, days: number): boolean {
    const d = new Date(date);
    const r = new Date(reference);
    const diffDays = (r.getTime() - d.getTime()) / (24 * 60 * 60 * 1000);
    return diffDays >= 0 && diffDays < days;
  }

  private toRecord(entity: DailyStats): DailyStatsRecord {
    return {
      id: entity.id,
      date: entity.date,
      observation_count: entity.observation_count,
      session_count: entity.session_count,
      project_count: entity.project_count,
      decision_count: entity.decision_count,
      error_count: entity.error_count,
      bug_fix_count: entity.bug_fix_count,
      discovery_count: entity.discovery_count,
      tokens_used: entity.tokens_used,
      technologies: entity.technologies ?? null,
      projects: entity.projects ?? null,
      created_at_epoch: entity.created_at_epoch,
    };
  }
}

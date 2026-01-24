/**
 * Achievement Repository
 *
 * Repository for tracking achievements and progress.
 */

import type { SqlEntityManager } from '@mikro-orm/knex';
import type { IAchievementRepository, AchievementRecord } from '@claude-mem/types';
import { Achievement } from '../../entities/Achievement.js';

export class MikroOrmAchievementRepository implements IAchievementRepository {
  constructor(private em: SqlEntityManager) {}

  async getAll(): Promise<AchievementRecord[]> {
    const achievements = await this.em.find(Achievement, {}, {
      orderBy: { unlocked_at_epoch: 'DESC' },
    });
    return achievements.map(a => this.toRecord(a));
  }

  async getById(achievementId: string): Promise<AchievementRecord | null> {
    const achievement = await this.em.findOne(Achievement, { achievement_id: achievementId });
    return achievement ? this.toRecord(achievement) : null;
  }

  async unlock(achievementId: string): Promise<AchievementRecord> {
    let achievement = await this.em.findOne(Achievement, { achievement_id: achievementId });

    if (achievement) {
      // Only update if not already unlocked
      if (!achievement.unlocked_at_epoch) {
        achievement.unlocked_at_epoch = Date.now();
        achievement.progress = 1;
        this.em.persist(achievement);
        await this.em.flush();
      }
      return this.toRecord(achievement);
    }

    // Create new record
    achievement = new Achievement();
    achievement.achievement_id = achievementId;
    achievement.unlocked_at_epoch = Date.now();
    achievement.progress = 1;

    this.em.persist(achievement);
    await this.em.flush();
    return this.toRecord(achievement);
  }

  async updateProgress(achievementId: string, progress: number): Promise<AchievementRecord> {
    let achievement = await this.em.findOne(Achievement, { achievement_id: achievementId });

    if (achievement) {
      achievement.progress = Math.min(1, Math.max(0, progress));
      // Auto-unlock if progress reaches 1
      if (achievement.progress >= 1 && !achievement.unlocked_at_epoch) {
        achievement.unlocked_at_epoch = Date.now();
      }
      this.em.persist(achievement);
      await this.em.flush();
      return this.toRecord(achievement);
    }

    // Create new record
    achievement = new Achievement();
    achievement.achievement_id = achievementId;
    achievement.progress = Math.min(1, Math.max(0, progress));
    if (achievement.progress >= 1) {
      achievement.unlocked_at_epoch = Date.now();
    }

    this.em.persist(achievement);
    await this.em.flush();
    return this.toRecord(achievement);
  }

  async getUnlocked(): Promise<AchievementRecord[]> {
    const achievements = await this.em.find(
      Achievement,
      { unlocked_at_epoch: { $ne: null } },
      { orderBy: { unlocked_at_epoch: 'DESC' } }
    );
    return achievements.map(a => this.toRecord(a));
  }

  async getInProgress(): Promise<AchievementRecord[]> {
    const achievements = await this.em.find(
      Achievement,
      {
        unlocked_at_epoch: null,
        progress: { $gt: 0 },
      },
      { orderBy: { progress: 'DESC' } }
    );
    return achievements.map(a => this.toRecord(a));
  }

  private toRecord(entity: Achievement): AchievementRecord {
    return {
      id: entity.id,
      achievement_id: entity.achievement_id,
      unlocked_at_epoch: entity.unlocked_at_epoch ?? null,
      progress: entity.progress,
      metadata: entity.metadata ?? null,
    };
  }
}

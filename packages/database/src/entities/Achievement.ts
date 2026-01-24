/**
 * Achievement Entity
 *
 * Tracks unlocked achievements and progress for gamification.
 */

import { Entity, PrimaryKey, Property, Index, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'achievements' })
export class Achievement {
  @PrimaryKey()
  id!: number;

  @Property()
  @Unique()
  achievement_id!: string;

  @Property({ nullable: true })
  @Index()
  unlocked_at_epoch?: number;

  @Property({ default: 0, type: 'real' })
  progress!: number; // 0-1 for progress tracking

  @Property({ nullable: true, type: 'text' })
  metadata?: string; // JSON for additional data
}

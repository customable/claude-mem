/**
 * Migration: Create Insights Tables
 *
 * Adds tables for learning insights dashboard:
 * - daily_stats: Aggregated daily statistics
 * - technology_usage: Technology tracking
 * - achievements: Achievement tracking
 */

import { Migration } from '@mikro-orm/migrations';

export class Migration20260124000003_CreateInsightsTables extends Migration {
  override async up(): Promise<void> {
    // Daily stats aggregation table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS daily_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        observation_count INTEGER DEFAULT 0,
        session_count INTEGER DEFAULT 0,
        project_count INTEGER DEFAULT 0,
        decision_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        bug_fix_count INTEGER DEFAULT 0,
        discovery_count INTEGER DEFAULT 0,
        tokens_used INTEGER DEFAULT 0,
        technologies TEXT,
        projects TEXT,
        created_at_epoch INTEGER NOT NULL
      )
    `);

    this.addSql('CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date)');

    // Technology usage tracking table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS technology_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT,
        first_seen_epoch INTEGER NOT NULL,
        last_used_epoch INTEGER NOT NULL,
        observation_count INTEGER DEFAULT 0,
        project TEXT,
        UNIQUE(name, project)
      )
    `);

    this.addSql('CREATE INDEX IF NOT EXISTS idx_technology_usage_name ON technology_usage(name)');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_technology_usage_project ON technology_usage(project)');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_technology_usage_count ON technology_usage(observation_count DESC)');

    // Achievements tracking table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        achievement_id TEXT NOT NULL UNIQUE,
        unlocked_at_epoch INTEGER,
        progress REAL DEFAULT 0,
        metadata TEXT
      )
    `);

    this.addSql('CREATE INDEX IF NOT EXISTS idx_achievements_unlocked ON achievements(unlocked_at_epoch)');
  }

  override async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS daily_stats');
    this.addSql('DROP TABLE IF EXISTS technology_usage');
    this.addSql('DROP TABLE IF EXISTS achievements');
  }
}

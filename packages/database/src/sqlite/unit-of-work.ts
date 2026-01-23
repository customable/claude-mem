/**
 * SQLite Unit of Work Implementation
 *
 * Provides access to all repositories with transaction support.
 */

import type { Database } from 'bun:sqlite';
import type { IUnitOfWork } from '@claude-mem/types';
import { SQLiteSessionRepository } from './repositories/sessions.js';
import { SQLiteObservationRepository } from './repositories/observations.js';
import { SQLiteSummaryRepository } from './repositories/summaries.js';
import { SQLiteUserPromptRepository } from './repositories/user-prompts.js';
import { SQLiteTaskQueueRepository } from './repositories/task-queue.js';

/**
 * SQLite implementation of IUnitOfWork
 */
export class SQLiteUnitOfWork implements IUnitOfWork {
  public readonly sessions: SQLiteSessionRepository;
  public readonly observations: SQLiteObservationRepository;
  public readonly summaries: SQLiteSummaryRepository;
  public readonly userPrompts: SQLiteUserPromptRepository;
  public readonly taskQueue: SQLiteTaskQueueRepository;

  private inTransaction = false;

  constructor(private db: Database) {
    this.sessions = new SQLiteSessionRepository(db);
    this.observations = new SQLiteObservationRepository(db);
    this.summaries = new SQLiteSummaryRepository(db);
    this.userPrompts = new SQLiteUserPromptRepository(db);
    this.taskQueue = new SQLiteTaskQueueRepository(db);
  }

  async beginTransaction(): Promise<void> {
    if (this.inTransaction) {
      throw new Error('Transaction already in progress');
    }
    this.db.run('BEGIN TRANSACTION');
    this.inTransaction = true;
  }

  async commit(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }
    this.db.run('COMMIT');
    this.inTransaction = false;
  }

  async rollback(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }
    this.db.run('ROLLBACK');
    this.inTransaction = false;
  }

  /**
   * Execute a function within a transaction
   */
  async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.beginTransaction();
    try {
      const result = await fn();
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
}

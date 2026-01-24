/**
 * MikroORM Unit of Work Implementation
 *
 * Provides access to all repositories with transaction support.
 */

import type { SqlEntityManager } from '@mikro-orm/knex';
import type { IUnitOfWork } from '@claude-mem/types';
import { MikroOrmSessionRepository } from './repositories/SessionRepository.js';
import { MikroOrmObservationRepository } from './repositories/ObservationRepository.js';
import { MikroOrmSummaryRepository } from './repositories/SummaryRepository.js';
import { MikroOrmDocumentRepository } from './repositories/DocumentRepository.js';
import { MikroOrmUserPromptRepository } from './repositories/UserPromptRepository.js';
import { MikroOrmTaskRepository } from './repositories/TaskRepository.js';
import { MikroOrmClaudeMdRepository } from './repositories/ClaudeMdRepository.js';
import { MikroOrmCodeSnippetRepository } from './repositories/CodeSnippetRepository.js';
import { MikroOrmDailyStatsRepository } from './repositories/DailyStatsRepository.js';
import { MikroOrmTechnologyUsageRepository } from './repositories/TechnologyUsageRepository.js';
import { MikroOrmAchievementRepository } from './repositories/AchievementRepository.js';
import { MikroOrmRawMessageRepository } from './repositories/RawMessageRepository.js';
import { MikroOrmObservationLinkRepository } from './repositories/ObservationLinkRepository.js';

/**
 * MikroORM implementation of IUnitOfWork
 */
export class MikroOrmUnitOfWork implements IUnitOfWork {
  public sessions: MikroOrmSessionRepository;
  public observations: MikroOrmObservationRepository;
  public summaries: MikroOrmSummaryRepository;
  public documents: MikroOrmDocumentRepository;
  public userPrompts: MikroOrmUserPromptRepository;
  public taskQueue: MikroOrmTaskRepository;
  public claudemd: MikroOrmClaudeMdRepository;
  public codeSnippets: MikroOrmCodeSnippetRepository;
  public dailyStats: MikroOrmDailyStatsRepository;
  public technologyUsage: MikroOrmTechnologyUsageRepository;
  public achievements: MikroOrmAchievementRepository;
  public rawMessages: MikroOrmRawMessageRepository;
  public observationLinks: MikroOrmObservationLinkRepository;

  private transactionEm: SqlEntityManager | null = null;

  constructor(private em: SqlEntityManager) {
    this.sessions = new MikroOrmSessionRepository(em);
    this.observations = new MikroOrmObservationRepository(em);
    this.summaries = new MikroOrmSummaryRepository(em);
    this.documents = new MikroOrmDocumentRepository(em);
    this.userPrompts = new MikroOrmUserPromptRepository(em);
    this.taskQueue = new MikroOrmTaskRepository(em);
    this.claudemd = new MikroOrmClaudeMdRepository(em);
    this.codeSnippets = new MikroOrmCodeSnippetRepository(em);
    this.dailyStats = new MikroOrmDailyStatsRepository(em);
    this.technologyUsage = new MikroOrmTechnologyUsageRepository(em);
    this.achievements = new MikroOrmAchievementRepository(em);
    this.rawMessages = new MikroOrmRawMessageRepository(em);
    this.observationLinks = new MikroOrmObservationLinkRepository(em);
  }

  async beginTransaction(): Promise<void> {
    if (this.transactionEm) {
      throw new Error('Transaction already in progress');
    }
    // Fork the EntityManager for isolated transaction context
    this.transactionEm = this.em.fork() as SqlEntityManager;
    await this.transactionEm.begin();

    // Update repositories to use transaction EntityManager
    this.updateRepositoryEm(this.transactionEm);
  }

  async commit(): Promise<void> {
    if (!this.transactionEm) {
      throw new Error('No transaction in progress');
    }
    await this.transactionEm.commit();
    this.transactionEm = null;

    // Restore original EntityManager
    this.updateRepositoryEm(this.em);
  }

  async rollback(): Promise<void> {
    if (!this.transactionEm) {
      throw new Error('No transaction in progress');
    }
    await this.transactionEm.rollback();
    this.transactionEm = null;

    // Restore original EntityManager
    this.updateRepositoryEm(this.em);
  }

  /**
   * Update all repositories to use a new EntityManager
   * This is needed for transaction isolation
   */
  private updateRepositoryEm(em: SqlEntityManager): void {
    this.sessions = new MikroOrmSessionRepository(em);
    this.observations = new MikroOrmObservationRepository(em);
    this.summaries = new MikroOrmSummaryRepository(em);
    this.documents = new MikroOrmDocumentRepository(em);
    this.userPrompts = new MikroOrmUserPromptRepository(em);
    this.taskQueue = new MikroOrmTaskRepository(em);
    this.claudemd = new MikroOrmClaudeMdRepository(em);
    this.codeSnippets = new MikroOrmCodeSnippetRepository(em);
    this.dailyStats = new MikroOrmDailyStatsRepository(em);
    this.technologyUsage = new MikroOrmTechnologyUsageRepository(em);
    this.achievements = new MikroOrmAchievementRepository(em);
    this.rawMessages = new MikroOrmRawMessageRepository(em);
    this.observationLinks = new MikroOrmObservationLinkRepository(em);
  }
}

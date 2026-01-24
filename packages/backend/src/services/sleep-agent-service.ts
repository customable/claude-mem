/**
 * Sleep Agent Service
 *
 * Handles memory consolidation during idle periods.
 * Implements tier promotion/demotion and cleanup.
 */

import { createLogger, loadSettings } from '@claude-mem/shared';
import type { IUnitOfWork, MemoryTier, ObservationRecord } from '@claude-mem/types';

const logger = createLogger('sleep-agent');

export interface SleepAgentConfig {
  // Trigger settings
  scheduleEnabled: boolean;
  scheduleInterval: number; // seconds
  idleTimeout: number; // minutes before idle trigger

  // Processing settings
  maxDuration: number; // seconds
  batchSize: number;

  // Tier rules
  demotionDays: number; // days since last access to demote
  demotionMaxAccess: number; // max access count to consider for demotion
  promotionMinAccess: number; // min access count for promotion
  promotionTypes: string[]; // types eligible for core promotion
}

export interface ConsolidationResult {
  promoted: number;
  demoted: number;
  archived: number;
  deleted: number;
  duration: number;
}

export interface SleepAgentStatus {
  lastRun: number | null;
  lastRunDuration: number | null;
  nextScheduled: number | null;
  isRunning: boolean;
  tierCounts: Record<MemoryTier, number>;
  lastConsolidation: ConsolidationResult | null;
}

export interface SleepAgentServiceDeps {
  uow: IUnitOfWork;
}

/**
 * Sleep Agent Service
 *
 * Performs intelligent memory consolidation with tiering.
 */
export class SleepAgentService {
  private config: SleepAgentConfig;
  private scheduleTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastRun: number | null = null;
  private lastRunDuration: number | null = null;
  private lastConsolidation: ConsolidationResult | null = null;

  constructor(private deps: SleepAgentServiceDeps) {
    const settings = loadSettings();

    // Default configuration (can be extended with settings)
    this.config = {
      scheduleEnabled: settings.SLEEP_AGENT_ENABLED ?? false,
      scheduleInterval: settings.SLEEP_AGENT_INTERVAL ?? 3600, // 1 hour
      idleTimeout: settings.SLEEP_AGENT_IDLE_TIMEOUT ?? 30,
      maxDuration: 300, // 5 minutes
      batchSize: 100,
      demotionDays: 30,
      demotionMaxAccess: 2,
      promotionMinAccess: 10,
      promotionTypes: ['decision', 'architecture'],
    };
  }

  /**
   * Start scheduled consolidation
   */
  startScheduled(): void {
    if (!this.config.scheduleEnabled) {
      logger.debug('Sleep agent scheduling disabled');
      return;
    }

    this.stopScheduled();

    const intervalMs = this.config.scheduleInterval * 1000;
    this.scheduleTimer = setInterval(async () => {
      try {
        await this.runConsolidation();
      } catch (error) {
        logger.error('Scheduled consolidation failed', { error: String(error) });
      }
    }, intervalMs);

    logger.info(`Sleep agent scheduled every ${this.config.scheduleInterval}s`);
  }

  /**
   * Stop scheduled consolidation
   */
  stopScheduled(): void {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
      logger.debug('Sleep agent schedule stopped');
    }
  }

  /**
   * Run consolidation manually or on trigger
   */
  async runConsolidation(options?: {
    dryRun?: boolean;
    tasks?: ('promote' | 'demote' | 'archive' | 'cleanup')[];
  }): Promise<ConsolidationResult> {
    if (this.isRunning) {
      logger.warn('Consolidation already in progress');
      return {
        promoted: 0,
        demoted: 0,
        archived: 0,
        deleted: 0,
        duration: 0,
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const tasks = options?.tasks || ['promote', 'demote', 'archive', 'cleanup'];
    const dryRun = options?.dryRun ?? false;

    const result: ConsolidationResult = {
      promoted: 0,
      demoted: 0,
      archived: 0,
      deleted: 0,
      duration: 0,
    };

    try {
      logger.info(`Starting consolidation (tasks: ${tasks.join(', ')}, dryRun: ${dryRun})`);

      // Promote high-value observations to core
      if (tasks.includes('promote')) {
        result.promoted = await this.promoteToCore(dryRun);
      }

      // Demote inactive observations to archive
      if (tasks.includes('demote')) {
        result.demoted = await this.demoteToArchive(dryRun);
      }

      // Archive old observations
      if (tasks.includes('archive')) {
        result.archived = await this.archiveOld(dryRun);
      }

      // Cleanup ephemeral observations
      if (tasks.includes('cleanup')) {
        result.deleted = await this.cleanupEphemeral(dryRun);
      }

      result.duration = Date.now() - startTime;
      this.lastRun = Date.now();
      this.lastRunDuration = result.duration;
      this.lastConsolidation = result;

      logger.info(`Consolidation complete: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      logger.error('Consolidation error', { error: String(error) });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Promote high-value observations to core tier
   */
  private async promoteToCore(dryRun: boolean): Promise<number> {
    const candidates = await this.deps.uow.observations.getForPromotion({
      minAccessCount: this.config.promotionMinAccess,
      types: this.config.promotionTypes,
      limit: this.config.batchSize,
    });

    if (dryRun) {
      logger.info(`[DRY RUN] Would promote ${candidates.length} observations to core`);
      return candidates.length;
    }

    let promoted = 0;
    for (const obs of candidates) {
      try {
        await this.deps.uow.observations.updateTier(obs.id, 'core');
        promoted++;
      } catch (error) {
        logger.error(`Failed to promote observation ${obs.id}`, { error: String(error) });
      }
    }

    return promoted;
  }

  /**
   * Demote inactive observations to archive tier
   */
  private async demoteToArchive(dryRun: boolean): Promise<number> {
    const candidates = await this.deps.uow.observations.getForDemotion({
      olderThanDays: this.config.demotionDays,
      maxAccessCount: this.config.demotionMaxAccess,
      limit: this.config.batchSize,
    });

    if (dryRun) {
      logger.info(`[DRY RUN] Would demote ${candidates.length} observations to archive`);
      return candidates.length;
    }

    let demoted = 0;
    for (const obs of candidates) {
      try {
        await this.deps.uow.observations.updateTier(obs.id, 'archive');
        demoted++;
      } catch (error) {
        logger.error(`Failed to demote observation ${obs.id}`, { error: String(error) });
      }
    }

    return demoted;
  }

  /**
   * Archive old observations that haven't been accessed
   */
  private async archiveOld(dryRun: boolean): Promise<number> {
    // Get observations older than 90 days with no access
    const candidates = await this.deps.uow.observations.getForDemotion({
      olderThanDays: 90,
      maxAccessCount: 0,
      limit: this.config.batchSize,
    });

    if (dryRun) {
      logger.info(`[DRY RUN] Would archive ${candidates.length} old observations`);
      return candidates.length;
    }

    let archived = 0;
    for (const obs of candidates) {
      try {
        await this.deps.uow.observations.updateTier(obs.id, 'archive');
        archived++;
      } catch (error) {
        logger.error(`Failed to archive observation ${obs.id}`, { error: String(error) });
      }
    }

    return archived;
  }

  /**
   * Cleanup ephemeral observations
   */
  private async cleanupEphemeral(dryRun: boolean): Promise<number> {
    const ephemeral = await this.deps.uow.observations.getByTier('ephemeral', { limit: 1000 });

    if (dryRun) {
      logger.info(`[DRY RUN] Would delete ${ephemeral.length} ephemeral observations`);
      return ephemeral.length;
    }

    let deleted = 0;
    for (const obs of ephemeral) {
      try {
        await this.deps.uow.observations.delete(obs.id);
        deleted++;
      } catch (error) {
        logger.error(`Failed to delete ephemeral observation ${obs.id}`, { error: String(error) });
      }
    }

    return deleted;
  }

  /**
   * Get current status
   */
  async getStatus(): Promise<SleepAgentStatus> {
    const tierCounts = await this.deps.uow.observations.getTierCounts();

    return {
      lastRun: this.lastRun,
      lastRunDuration: this.lastRunDuration,
      nextScheduled: this.scheduleTimer && this.lastRun
        ? this.lastRun + (this.config.scheduleInterval * 1000)
        : null,
      isRunning: this.isRunning,
      tierCounts,
      lastConsolidation: this.lastConsolidation,
    };
  }

  /**
   * Update tier for a specific observation
   */
  async setTier(observationId: number, tier: MemoryTier): Promise<ObservationRecord | null> {
    return this.deps.uow.observations.updateTier(observationId, tier);
  }

  /**
   * Get observations by tier
   */
  async getByTier(tier: MemoryTier, options?: {
    project?: string;
    limit?: number;
  }): Promise<ObservationRecord[]> {
    return this.deps.uow.observations.getByTier(tier, options);
  }
}

/**
 * Create sleep agent service
 */
export function createSleepAgentService(deps: SleepAgentServiceDeps): SleepAgentService {
  return new SleepAgentService(deps);
}

/**
 * MikroORM Archived Output Repository
 *
 * Stores full tool outputs for Endless Mode (Issue #109).
 * Enables perfect recall while using compressed observations in context.
 */

import type { SqlEntityManager } from '@mikro-orm/knex';
import { ref } from '@mikro-orm/core';
import type {
  IArchivedOutputRepository,
  CreateArchivedOutputInput,
  ArchivedOutputQueryFilters,
  QueryOptions,
  ArchivedOutputRecord,
  CompressionStatus,
} from '@claude-mem/types';
import { ArchivedOutput } from '../../entities/ArchivedOutput.js';
import { Observation } from '../../entities/Observation.js';

/**
 * Convert ArchivedOutput entity to ArchivedOutputRecord
 */
function toRecord(entity: ArchivedOutput): ArchivedOutputRecord {
  // Extract the observation ID from the Ref (if populated) or from the raw foreign key
  let compressedObservationId: number | undefined;
  if (entity.compressedObservation) {
    // MikroORM Ref: can be unwrapped or we can get the ID directly
    compressedObservationId = entity.compressedObservation.id;
  }

  return {
    id: entity.id,
    memory_session_id: entity.memory_session_id,
    project: entity.project,
    tool_name: entity.tool_name,
    tool_input: entity.tool_input,
    tool_output: entity.tool_output,
    compressed_observation_id: compressedObservationId,
    compression_status: entity.compression_status,
    token_count: entity.token_count,
    compressed_token_count: entity.compressed_token_count,
    error_message: entity.error_message,
    created_at: entity.created_at,
    created_at_epoch: entity.created_at_epoch,
    compressed_at: entity.compressed_at,
    compressed_at_epoch: entity.compressed_at_epoch,
  };
}

export class MikroOrmArchivedOutputRepository implements IArchivedOutputRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async create(input: CreateArchivedOutputInput): Promise<ArchivedOutputRecord> {
    const now = new Date();
    const entity = this.em.create(ArchivedOutput, {
      memory_session_id: input.memorySessionId,
      project: input.project,
      tool_name: input.toolName,
      tool_input: input.toolInput,
      tool_output: input.toolOutput,
      token_count: input.tokenCount,
      compression_status: 'pending' as CompressionStatus,
      created_at: now.toISOString(),
      created_at_epoch: now.getTime(),
    });

    this.em.persist(entity);
    await this.em.flush();
    return toRecord(entity);
  }

  async findById(id: number): Promise<ArchivedOutputRecord | null> {
    const entity = await this.em.findOne(ArchivedOutput, { id });
    return entity ? toRecord(entity) : null;
  }

  async getPendingCompression(limit = 10): Promise<ArchivedOutputRecord[]> {
    const entities = await this.em.find(
      ArchivedOutput,
      { compression_status: 'pending' },
      { orderBy: { created_at_epoch: 'ASC' }, limit }
    );
    return entities.map(toRecord);
  }

  async updateCompressionStatus(
    id: number,
    status: CompressionStatus,
    extra?: {
      compressedObservationId?: number;
      compressedTokenCount?: number;
      errorMessage?: string;
    }
  ): Promise<ArchivedOutputRecord | null> {
    const entity = await this.em.findOne(ArchivedOutput, { id });
    if (!entity) return null;

    entity.compression_status = status;

    if (extra?.compressedObservationId !== undefined) {
      // Use ref() + getReference to set the Ref relation by ID without loading the entity
      entity.compressedObservation = ref(this.em.getReference(Observation, extra.compressedObservationId));
    }
    if (extra?.compressedTokenCount !== undefined) {
      entity.compressed_token_count = extra.compressedTokenCount;
    }
    if (extra?.errorMessage !== undefined) {
      entity.error_message = extra.errorMessage;
    }

    if (status === 'completed' || status === 'failed' || status === 'skipped') {
      const now = new Date();
      entity.compressed_at = now.toISOString();
      entity.compressed_at_epoch = now.getTime();
    }

    await this.em.flush();
    return toRecord(entity);
  }

  async list(filters?: ArchivedOutputQueryFilters, options?: QueryOptions): Promise<ArchivedOutputRecord[]> {
    const qb = this.em.createQueryBuilder(ArchivedOutput, 'a');

    if (filters?.project) {
      qb.andWhere({ project: filters.project });
    }
    if (filters?.sessionId) {
      qb.andWhere({ memory_session_id: filters.sessionId });
    }
    if (filters?.toolName) {
      qb.andWhere({ tool_name: filters.toolName });
    }
    if (filters?.compressionStatus) {
      if (Array.isArray(filters.compressionStatus)) {
        qb.andWhere({ compression_status: { $in: filters.compressionStatus } });
      } else {
        qb.andWhere({ compression_status: filters.compressionStatus });
      }
    }
    if (filters?.dateRange?.start) {
      const epoch = typeof filters.dateRange.start === 'number'
        ? filters.dateRange.start
        : filters.dateRange.start.getTime();
      qb.andWhere({ created_at_epoch: { $gte: epoch } });
    }
    if (filters?.dateRange?.end) {
      const epoch = typeof filters.dateRange.end === 'number'
        ? filters.dateRange.end
        : filters.dateRange.end.getTime();
      qb.andWhere({ created_at_epoch: { $lte: epoch } });
    }

    qb.orderBy({ [options?.orderBy || 'created_at_epoch']: options?.order || 'DESC' });

    if (options?.limit) qb.limit(options.limit);
    if (options?.offset) qb.offset(options.offset);

    const entities = await qb.getResult();
    return entities.map(toRecord);
  }

  async findByObservationId(observationId: number): Promise<ArchivedOutputRecord | null> {
    // Query by the relation - MikroORM accepts the ID directly for relation queries
    const entity = await this.em.findOne(ArchivedOutput, { compressedObservation: observationId });
    return entity ? toRecord(entity) : null;
  }

  async search(
    query: string,
    filters?: ArchivedOutputQueryFilters,
    options?: QueryOptions
  ): Promise<ArchivedOutputRecord[]> {
    // Simple LIKE search on tool_output
    const qb = this.em.createQueryBuilder(ArchivedOutput, 'a');
    qb.andWhere({ tool_output: { $like: `%${query}%` } });

    if (filters?.project) {
      qb.andWhere({ project: filters.project });
    }
    if (filters?.sessionId) {
      qb.andWhere({ memory_session_id: filters.sessionId });
    }
    if (filters?.toolName) {
      qb.andWhere({ tool_name: filters.toolName });
    }

    qb.orderBy({ [options?.orderBy || 'created_at_epoch']: options?.order || 'DESC' });

    if (options?.limit) qb.limit(options.limit);
    if (options?.offset) qb.offset(options.offset);

    const entities = await qb.getResult();
    return entities.map(toRecord);
  }

  async getStats(): Promise<{
    totalCount: number;
    pendingCount: number;
    completedCount: number;
    failedCount: number;
    totalTokensSaved: number;
  }> {
    const knex = this.em.getKnex();

    const [stats] = await knex('archived_outputs')
      .select(
        knex.raw('COUNT(*) as total_count'),
        knex.raw('SUM(CASE WHEN compression_status = ? THEN 1 ELSE 0 END) as pending_count', ['pending']),
        knex.raw('SUM(CASE WHEN compression_status = ? THEN 1 ELSE 0 END) as completed_count', ['completed']),
        knex.raw('SUM(CASE WHEN compression_status = ? THEN 1 ELSE 0 END) as failed_count', ['failed']),
        knex.raw('COALESCE(SUM(token_count - COALESCE(compressed_token_count, 0)), 0) as total_tokens_saved')
      );

    return {
      totalCount: Number(stats.total_count || 0),
      pendingCount: Number(stats.pending_count || 0),
      completedCount: Number(stats.completed_count || 0),
      failedCount: Number(stats.failed_count || 0),
      totalTokensSaved: Number(stats.total_tokens_saved || 0),
    };
  }

  async delete(id: number): Promise<boolean> {
    const entity = await this.em.findOne(ArchivedOutput, { id });
    if (!entity) return false;
    this.em.remove(entity);
    await this.em.flush();
    return true;
  }

  async cleanup(olderThanDays: number): Promise<number> {
    const cutoffEpoch = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    // Only cleanup completed compressions
    const result = await this.em.nativeDelete(ArchivedOutput, {
      compression_status: 'completed',
      compressed_at_epoch: { $lt: cutoffEpoch },
    });
    return result;
  }
}

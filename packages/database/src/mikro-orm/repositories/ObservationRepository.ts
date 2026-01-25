/**
 * MikroORM Observation Repository
 *
 * Note: FTS5 queries remain as raw SQL since MikroORM doesn't support FTS5.
 */

import type { SqlEntityManager } from '@mikro-orm/knex';
import type {
  IObservationRepository,
  CreateObservationInput,
  ObservationQueryFilters,
  QueryOptions,
  ObservationRecord,
  DecisionCategory,
  MemoryTier,
} from '@claude-mem/types';
import { Observation } from '../../entities/Observation.js';

/**
 * Convert Observation entity to ObservationRecord
 */
function toRecord(entity: Observation): ObservationRecord {
  return {
    id: entity.id,
    memory_session_id: entity.memory_session_id,
    project: entity.project,
    text: entity.text ?? null,
    type: entity.type,
    created_at: entity.created_at,
    created_at_epoch: entity.created_at_epoch,
    title: entity.title,
    subtitle: entity.subtitle,
    narrative: entity.narrative,
    concept: entity.concept,
    concepts: entity.concepts,
    facts: entity.facts,
    source_files: entity.source_files,
    files_read: entity.files_read,
    files_modified: entity.files_modified,
    git_branch: entity.git_branch,
    cwd: entity.cwd,
    prompt_number: entity.prompt_number,
    discovery_tokens: entity.discovery_tokens,
    // Decision tracking
    decision_category: entity.decision_category,
    superseded_by: entity.superseded_by,
    supersedes: entity.supersedes,
    superseded_at: entity.superseded_at,
    // Memory tiering
    memory_tier: entity.memory_tier as MemoryTier | undefined,
    tier_changed_at: entity.tier_changed_at,
    access_count: entity.access_count,
    last_accessed_at: entity.last_accessed_at,
    last_accessed_at_epoch: entity.last_accessed_at_epoch,
    consolidation_score: entity.consolidation_score,
    // Importance scoring
    pinned: entity.pinned,
    importance_boost: entity.importance_boost,
  };
}

export class MikroOrmObservationRepository implements IObservationRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async create(input: CreateObservationInput): Promise<ObservationRecord> {
    const now = new Date();
    const entity = this.em.create(Observation, {
      memory_session_id: input.memorySessionId,
      project: input.project,
      text: input.text,
      type: input.type,
      title: input.title,
      subtitle: input.subtitle,
      concepts: input.concepts,
      facts: input.facts,
      narrative: input.narrative,
      files_read: input.filesRead,
      files_modified: input.filesModified,
      prompt_number: input.promptNumber,
      discovery_tokens: input.discoveryTokens,
      git_branch: input.gitBranch,
      cwd: input.cwd,
      created_at: now.toISOString(),
      created_at_epoch: now.getTime(),
      // Decision tracking
      decision_category: input.decisionCategory,
    });

    this.em.persist(entity);
    await this.em.flush();
    return toRecord(entity);
  }

  async findById(id: number): Promise<ObservationRecord | null> {
    const entity = await this.em.findOne(Observation, { id });
    return entity ? toRecord(entity) : null;
  }

  async update(id: number, input: Partial<CreateObservationInput>): Promise<ObservationRecord | null> {
    const entity = await this.em.findOne(Observation, { id });
    if (!entity) return null;

    if (input.text !== undefined) entity.text = input.text;
    if (input.type !== undefined) entity.type = input.type;
    if (input.title !== undefined) entity.title = input.title;
    if (input.subtitle !== undefined) entity.subtitle = input.subtitle;
    if (input.concepts !== undefined) entity.concepts = input.concepts;
    if (input.facts !== undefined) entity.facts = input.facts;
    if (input.narrative !== undefined) entity.narrative = input.narrative;
    if (input.filesRead !== undefined) entity.files_read = input.filesRead;
    if (input.filesModified !== undefined) entity.files_modified = input.filesModified;

    await this.em.flush();
    return toRecord(entity);
  }

  async list(filters?: ObservationQueryFilters, options?: QueryOptions): Promise<ObservationRecord[]> {
    const qb = this.em.createQueryBuilder(Observation, 'o');

    if (filters?.project) {
      qb.andWhere({ project: filters.project });
    }
    if (filters?.sessionId) {
      qb.andWhere({ memory_session_id: filters.sessionId });
    }
    if (filters?.type) {
      if (Array.isArray(filters.type)) {
        qb.andWhere({ type: { $in: filters.type } });
      } else {
        qb.andWhere({ type: filters.type });
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
    if (filters?.cwdPrefix) {
      qb.andWhere({ cwd: { $like: `${filters.cwdPrefix}%` } });
    }

    qb.orderBy({ [options?.orderBy || 'created_at_epoch']: options?.order || 'DESC' });

    if (options?.limit) qb.limit(options.limit);
    if (options?.offset) qb.offset(options.offset);

    const entities = await qb.getResult();
    return entities.map(toRecord);
  }

  async count(filters?: ObservationQueryFilters): Promise<number> {
    const qb = this.em.createQueryBuilder(Observation, 'o');

    if (filters?.project) {
      qb.andWhere({ project: filters.project });
    }
    if (filters?.sessionId) {
      qb.andWhere({ memory_session_id: filters.sessionId });
    }
    if (filters?.type) {
      if (Array.isArray(filters.type)) {
        qb.andWhere({ type: { $in: filters.type } });
      } else {
        qb.andWhere({ type: filters.type });
      }
    }

    return qb.count();
  }

  /**
   * Parse and sanitize FTS5 query with support for extended syntax (Issue #211, #238)
   * Supports: phrase search ("..."), OR, NOT (-), prefix (*)
   * Handles: hyphens in terms (claude-mem), standalone wildcards, special characters
   */
  private parseFts5Query(query: string): string {
    // Trim and handle empty/whitespace-only queries
    const trimmed = query.trim();
    if (!trimmed) {
      throw new Error('Search query cannot be empty');
    }

    // Handle standalone wildcard - not a valid FTS5 query
    if (trimmed === '*') {
      throw new Error('Standalone wildcard (*) is not a valid search query. Use a prefix like "term*" instead.');
    }

    // Handle quoted phrases first - preserve them
    const phrases: string[] = [];
    let processed = trimmed.replace(/"([^"]+)"/g, (_, phrase) => {
      phrases.push(`"${phrase}"`);
      return `__PHRASE_${phrases.length - 1}__`;
    });

    // Convert -term to NOT term (only when preceded by space or at start)
    processed = processed.replace(/\s-(\w+)/g, ' NOT $1');
    processed = processed.replace(/^-(\w+)/, 'NOT $1');

    // Restore phrases
    phrases.forEach((phrase, i) => {
      processed = processed.replace(`__PHRASE_${i}__`, phrase);
    });

    // Escape any remaining special characters in individual terms (except allowed operators)
    const terms = processed.split(/\s+/).filter(Boolean);
    return terms.map(term => {
      // Allow: OR, NOT, quoted phrases, valid prefix wildcards (word*)
      if (term === 'OR' || term === 'NOT' || term.startsWith('"')) {
        return term;
      }

      // Handle prefix wildcard (word*) - valid FTS5 syntax
      if (term.endsWith('*') && term.length > 1 && !term.slice(0, -1).includes('*')) {
        const prefix = term.slice(0, -1);
        // If prefix contains special chars, quote it and add wildcard
        if (/[-():^]/.test(prefix)) {
          return `"${prefix.replace(/"/g, '""')}"*`;
        }
        return term;
      }

      // Handle terms with hyphens (like claude-mem) - quote them to treat as literal
      // FTS5 interprets - as NOT operator, so we need to quote the entire term
      if (term.includes('-')) {
        return `"${term.replace(/"/g, '""')}"`;
      }

      // Escape other special FTS5 characters in regular terms
      if (/[():^*]/.test(term)) {
        return `"${term.replace(/"/g, '""')}"`;
      }
      return term;
    }).join(' ');
  }

  async search(
    query: string,
    filters?: ObservationQueryFilters,
    options?: QueryOptions
  ): Promise<ObservationRecord[]> {
    // FTS5 requires raw SQL - MikroORM doesn't support virtual tables
    const parsedQuery = this.parseFts5Query(query);
    const knex = this.em.getKnex();

    let sql = knex('observations as o')
      .join(knex.raw('observations_fts fts ON o.id = fts.rowid'))
      .whereRaw('observations_fts MATCH ?', [parsedQuery])
      .select('o.*');

    if (filters?.project) {
      sql = sql.andWhere('o.project', filters.project);
    }
    if (filters?.type) {
      if (Array.isArray(filters.type)) {
        sql = sql.whereIn('o.type', filters.type);
      } else {
        sql = sql.andWhere('o.type', filters.type);
      }
    }

    if (options?.orderBy === 'relevance') {
      sql = sql.orderByRaw('rank');
    } else {
      sql = sql.orderBy(options?.orderBy || 'o.created_at_epoch', options?.order || 'desc');
    }

    if (options?.limit) sql = sql.limit(options.limit);
    if (options?.offset) sql = sql.offset(options.offset);

    const rows = await sql;
    return rows as ObservationRecord[];
  }

  /**
   * Search with BM25 ranking, snippets and highlighting (Issue #211)
   */
  async searchWithRanking(
    query: string,
    filters?: ObservationQueryFilters,
    options?: QueryOptions & { snippetLength?: number }
  ): Promise<{ results: Array<{ item: ObservationRecord; score: number; highlights: Array<{ field: string; snippet: string }> }>; total: number }> {
    const parsedQuery = this.parseFts5Query(query);
    const knex = this.em.getKnex();
    const snippetLen = options?.snippetLength || 64;

    // Build main query with BM25 ranking and snippets
    let sql = knex('observations as o')
      .join(knex.raw('observations_fts fts ON o.id = fts.rowid'))
      .whereRaw('observations_fts MATCH ?', [parsedQuery])
      .select(
        'o.*',
        knex.raw('bm25(observations_fts, 1.0, 0.75, 0.5) as score'),
        knex.raw(`snippet(observations_fts, 0, '<mark>', '</mark>', '...', ?) as title_snippet`, [snippetLen]),
        knex.raw(`snippet(observations_fts, 1, '<mark>', '</mark>', '...', ?) as text_snippet`, [snippetLen]),
        knex.raw(`snippet(observations_fts, 2, '<mark>', '</mark>', '...', ?) as concept_snippet`, [snippetLen])
      );

    if (filters?.project) {
      sql = sql.andWhere('o.project', filters.project);
    }
    if (filters?.type) {
      if (Array.isArray(filters.type)) {
        sql = sql.whereIn('o.type', filters.type);
      } else {
        sql = sql.andWhere('o.type', filters.type);
      }
    }

    // Always order by relevance (BM25 score - lower is better)
    sql = sql.orderByRaw('score');

    if (options?.limit) sql = sql.limit(options.limit);
    if (options?.offset) sql = sql.offset(options.offset);

    const rows = await sql;

    // Get total count
    const countSql = knex('observations as o')
      .join(knex.raw('observations_fts fts ON o.id = fts.rowid'))
      .whereRaw('observations_fts MATCH ?', [parsedQuery]);

    if (filters?.project) {
      countSql.andWhere('o.project', filters.project);
    }
    if (filters?.type) {
      if (Array.isArray(filters.type)) {
        countSql.whereIn('o.type', filters.type);
      } else {
        countSql.andWhere('o.type', filters.type);
      }
    }

    const [{ count }] = await countSql.count('* as count');
    const total = typeof count === 'number' ? count : parseInt(count as string, 10);

    // Transform results
    const results = rows.map((row: Record<string, unknown>) => {
      const { score, title_snippet, text_snippet, concept_snippet, ...item } = row;
      const highlights: Array<{ field: string; snippet: string }> = [];

      if (title_snippet && (title_snippet as string).includes('<mark>')) {
        highlights.push({ field: 'title', snippet: title_snippet as string });
      }
      if (text_snippet && (text_snippet as string).includes('<mark>')) {
        highlights.push({ field: 'text', snippet: text_snippet as string });
      }
      if (concept_snippet && (concept_snippet as string).includes('<mark>')) {
        highlights.push({ field: 'concept', snippet: concept_snippet as string });
      }

      return {
        item: item as unknown as ObservationRecord,
        score: score as number,
        highlights,
      };
    });

    return { results, total };
  }

  /**
   * Get search facets for filtering (Issue #211)
   */
  async getSearchFacets(
    query: string,
    filters?: ObservationQueryFilters
  ): Promise<{ types: Record<string, number>; projects: Record<string, number>; tiers: Record<string, number> }> {
    const parsedQuery = this.parseFts5Query(query);
    const knex = this.em.getKnex();

    let baseQuery = knex('observations as o')
      .join(knex.raw('observations_fts fts ON o.id = fts.rowid'))
      .whereRaw('observations_fts MATCH ?', [parsedQuery]);

    if (filters?.project) {
      baseQuery = baseQuery.andWhere('o.project', filters.project);
    }

    // Get type counts
    const typeRows = await baseQuery.clone()
      .select('o.type')
      .count('* as count')
      .groupBy('o.type');

    // Get project counts
    const projectRows = await baseQuery.clone()
      .select('o.project')
      .count('* as count')
      .groupBy('o.project');

    // Get tier counts
    const tierRows = await baseQuery.clone()
      .select('o.memory_tier')
      .count('* as count')
      .groupBy('o.memory_tier');

    const types: Record<string, number> = {};
    const projects: Record<string, number> = {};
    const tiers: Record<string, number> = {};

    for (const row of typeRows) {
      const r = row as { type: string; count: number | string };
      types[r.type] = typeof r.count === 'number' ? r.count : parseInt(r.count, 10);
    }
    for (const row of projectRows) {
      const r = row as { project: string; count: number | string };
      projects[r.project] = typeof r.count === 'number' ? r.count : parseInt(r.count, 10);
    }
    for (const row of tierRows) {
      const r = row as { memory_tier: string; count: number | string };
      if (r.memory_tier) {
        tiers[r.memory_tier] = typeof r.count === 'number' ? r.count : parseInt(r.count, 10);
      }
    }

    return { types, projects, tiers };
  }

  async getBySessionId(memorySessionId: string, options?: QueryOptions): Promise<ObservationRecord[]> {
    return this.list({ sessionId: memorySessionId }, options);
  }

  async getForContext(project: string, limit: number): Promise<ObservationRecord[]> {
    const entities = await this.em.find(
      Observation,
      { project },
      { orderBy: { created_at_epoch: 'DESC' }, limit }
    );
    return entities.map(toRecord);
  }

  async delete(id: number): Promise<boolean> {
    const entity = await this.em.findOne(Observation, { id });
    if (!entity) return false;
    this.em.remove(entity);
    await this.em.flush();
    return true;
  }

  /**
   * Batch delete observations by IDs (Issue #204)
   * Chunks large arrays to avoid SQLite IN clause limits
   */
  async batchDelete(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;

    // SQLite has a limit on IN clause (~999 items), chunk to be safe
    const chunkSize = 500;
    let totalDeleted = 0;

    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const result = await this.em.nativeDelete(Observation, {
        id: { $in: chunk },
      });
      totalDeleted += result;
    }

    return totalDeleted;
  }

  async deleteBySessionId(memorySessionId: string): Promise<number> {
    const result = await this.em.nativeDelete(Observation, { memory_session_id: memorySessionId });
    return result;
  }

  async getInsightsSummary(days: number): Promise<{
    totalObservations: number;
    totalSessions: number;
    totalProjects: number;
    totalDecisions: number;
    totalTokens: number;
    activeDays: number;
    currentStreak: number;
    longestStreak: number;
  }> {
    const cutoffEpoch = Date.now() - days * 24 * 60 * 60 * 1000;
    const knex = this.em.getKnex();

    // Get basic counts
    const [counts] = await knex('observations')
      .where('created_at_epoch', '>=', cutoffEpoch)
      .select(
        knex.raw('COUNT(*) as total_observations'),
        knex.raw('COUNT(DISTINCT memory_session_id) as total_sessions'),
        knex.raw('COUNT(DISTINCT project) as total_projects'),
        knex.raw("SUM(CASE WHEN type = 'decision' THEN 1 ELSE 0 END) as total_decisions"),
        knex.raw('COALESCE(SUM(discovery_tokens), 0) as total_tokens')
      );

    // Get active days (distinct dates with observations)
    const activeDaysResult = await knex('observations')
      .where('created_at_epoch', '>=', cutoffEpoch)
      .select(knex.raw("DATE(created_at_epoch / 1000, 'unixepoch') as date"))
      .groupBy('date')
      .orderBy('date', 'desc');

    const activeDates = activeDaysResult.map((r: { date: string }) => r.date);
    const activeDays = activeDates.length;

    // Calculate streaks
    const { currentStreak, longestStreak } = this.calculateStreaksFromDates(activeDates);

    return {
      totalObservations: Number(counts.total_observations) || 0,
      totalSessions: Number(counts.total_sessions) || 0,
      totalProjects: Number(counts.total_projects) || 0,
      totalDecisions: Number(counts.total_decisions) || 0,
      totalTokens: Number(counts.total_tokens) || 0,
      activeDays,
      currentStreak,
      longestStreak,
    };
  }

  private calculateStreaksFromDates(dates: string[]): { currentStreak: number; longestStreak: number } {
    if (dates.length === 0) return { currentStreak: 0, longestStreak: 0 };

    // Dates are already sorted desc
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let currentStreak = 0;
    let longestStreak = 0;
    let streak = 0;
    let prevDate: Date | null = null;

    // Check if streak is active (today or yesterday has activity)
    const streakActive = dates[0] === today || dates[0] === yesterday;

    for (const dateStr of dates) {
      const date = new Date(dateStr);

      if (prevDate === null) {
        streak = 1;
      } else {
        const diffDays = (prevDate.getTime() - date.getTime()) / (24 * 60 * 60 * 1000);
        if (diffDays === 1) {
          streak++;
        } else {
          longestStreak = Math.max(longestStreak, streak);
          streak = 1;
        }
      }
      prevDate = date;
    }

    longestStreak = Math.max(longestStreak, streak);
    currentStreak = streakActive ? streak : 0;

    // Re-calculate current streak properly from today
    if (streakActive) {
      currentStreak = 0;
      let checkDate = dates[0] === today ? today : yesterday;
      for (const dateStr of dates) {
        if (dateStr === checkDate) {
          currentStreak++;
          const d = new Date(checkDate);
          d.setDate(d.getDate() - 1);
          checkDate = d.toISOString().split('T')[0];
        } else if (dateStr < checkDate) {
          break;
        }
      }
    }

    return { currentStreak, longestStreak };
  }

  async getTimelineStats(params: {
    startEpoch: number;
    period: 'day' | 'week' | 'month';
    project?: string;
  }): Promise<Array<{ date: string; observations: number; tokens: number }>> {
    const { startEpoch, period, project } = params;
    const knex = this.em.getKnex();

    // SQLite date formatting based on period
    let dateFormat: string;
    if (period === 'month') {
      dateFormat = "strftime('%Y-%m', datetime(created_at_epoch / 1000, 'unixepoch'))";
    } else if (period === 'week') {
      // Week start (Sunday)
      dateFormat = "date(datetime(created_at_epoch / 1000, 'unixepoch'), 'weekday 0', '-7 days')";
    } else {
      // Day
      dateFormat = "date(datetime(created_at_epoch / 1000, 'unixepoch'))";
    }

    let query = knex('observations')
      .where('created_at_epoch', '>=', startEpoch)
      .select(
        knex.raw(`${dateFormat} as date`),
        knex.raw('COUNT(*) as observations'),
        knex.raw('COALESCE(SUM(discovery_tokens), 0) as tokens')
      )
      .groupByRaw(dateFormat)
      .orderBy('date', 'asc');

    if (project) {
      query = query.andWhere('project', project);
    }

    const rows = await query;
    return rows.map((r: { date: string; observations: string | number; tokens: string | number }) => ({
      date: r.date,
      observations: Number(r.observations),
      tokens: Number(r.tokens),
    }));
  }

  // Decision tracking methods

  async getDecisions(project: string, options?: {
    category?: string;
    includeSuperseded?: boolean;
    limit?: number;
  }): Promise<ObservationRecord[]> {
    const qb = this.em.createQueryBuilder(Observation, 'o')
      .where({ project, type: 'decision' });

    if (options?.category) {
      qb.andWhere({ decision_category: options.category });
    }

    if (!options?.includeSuperseded) {
      qb.andWhere({ superseded_by: null });
    }

    qb.orderBy({ created_at_epoch: 'DESC' });

    if (options?.limit) {
      qb.limit(options.limit);
    }

    const entities = await qb.getResult();
    return entities.map(toRecord);
  }

  async findConflictingDecisions(params: {
    project: string;
    text: string;
    category?: string;
    limit?: number;
  }): Promise<ObservationRecord[]> {
    // Use FTS5 to find semantically similar decisions
    const sanitizedQuery = this.parseFts5Query(params.text);
    const knex = this.em.getKnex();

    let sql = knex('observations as o')
      .join(knex.raw('observations_fts fts ON o.id = fts.rowid'))
      .whereRaw('observations_fts MATCH ?', [sanitizedQuery])
      .andWhere('o.project', params.project)
      .andWhere('o.type', 'decision')
      .whereNull('o.superseded_by')
      .select('o.*')
      .orderByRaw('rank');

    if (params.category) {
      sql = sql.andWhere('o.decision_category', params.category);
    }

    if (params.limit) {
      sql = sql.limit(params.limit);
    } else {
      sql = sql.limit(10);
    }

    const rows = await sql;
    return rows as ObservationRecord[];
  }

  async supersede(id: number, supersededBy: number): Promise<ObservationRecord | null> {
    const entity = await this.em.findOne(Observation, { id });
    if (!entity) return null;

    entity.superseded_by = supersededBy;
    entity.superseded_at = new Date().toISOString();

    // Also update the superseding observation to track what it supersedes
    const supersedingEntity = await this.em.findOne(Observation, { id: supersededBy });
    if (supersedingEntity) {
      supersedingEntity.supersedes = id;
    }

    await this.em.flush();
    return toRecord(entity);
  }

  async getDecisionHistory(id: number): Promise<ObservationRecord[]> {
    const history: ObservationRecord[] = [];
    const visited = new Set<number>();

    // Traverse backwards to find older decisions
    let currentId: number | undefined = id;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const foundEntity: Observation | null = await this.em.findOne(Observation, { id: currentId });
      if (!foundEntity) break;
      history.unshift(toRecord(foundEntity));
      currentId = foundEntity.supersedes;
    }

    // Traverse forwards to find newer decisions
    const startEntity = await this.em.findOne(Observation, { id });
    currentId = startEntity?.superseded_by;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const nextEntity: Observation | null = await this.em.findOne(Observation, { id: currentId });
      if (!nextEntity) break;
      history.push(toRecord(nextEntity));
      currentId = nextEntity.superseded_by;
    }

    return history;
  }

  // Memory tier methods (Sleep Agent)

  async getByTier(tier: MemoryTier, options?: {
    project?: string;
    limit?: number;
  }): Promise<ObservationRecord[]> {
    const qb = this.em.createQueryBuilder(Observation, 'o')
      .where({ memory_tier: tier });

    if (options?.project) {
      qb.andWhere({ project: options.project });
    }

    qb.orderBy({ created_at_epoch: 'DESC' });

    if (options?.limit) {
      qb.limit(options.limit);
    }

    const entities = await qb.getResult();
    return entities.map(toRecord);
  }

  async updateTier(id: number, tier: MemoryTier): Promise<ObservationRecord | null> {
    const entity = await this.em.findOne(Observation, { id });
    if (!entity) return null;

    entity.memory_tier = tier;
    entity.tier_changed_at = new Date().toISOString();

    await this.em.flush();
    return toRecord(entity);
  }

  async recordAccess(id: number): Promise<ObservationRecord | null> {
    const entity = await this.em.findOne(Observation, { id });
    if (!entity) return null;

    const now = new Date();
    entity.access_count = (entity.access_count || 0) + 1;
    entity.last_accessed_at = now.toISOString();
    entity.last_accessed_at_epoch = now.getTime();

    await this.em.flush();
    return toRecord(entity);
  }

  async getTierCounts(project?: string): Promise<Record<MemoryTier, number>> {
    const knex = this.em.getKnex();

    let query = knex('observations')
      .select('memory_tier')
      .count('* as count')
      .groupBy('memory_tier');

    if (project) {
      query = query.where('project', project);
    }

    const rows = await query;

    // Initialize with zeros
    const counts: Record<MemoryTier, number> = {
      core: 0,
      working: 0,
      archive: 0,
      ephemeral: 0,
    };

    for (const row of rows) {
      const tier = (row.memory_tier || 'working') as MemoryTier;
      counts[tier] = Number(row.count);
    }

    return counts;
  }

  async getForDemotion(params: {
    olderThanDays: number;
    maxAccessCount: number;
    limit?: number;
  }): Promise<ObservationRecord[]> {
    const cutoffEpoch = Date.now() - (params.olderThanDays * 24 * 60 * 60 * 1000);

    const qb = this.em.createQueryBuilder(Observation, 'o')
      .where({ memory_tier: 'working' })
      .andWhere({
        $or: [
          { last_accessed_at_epoch: { $lt: cutoffEpoch } },
          { last_accessed_at_epoch: null },
        ],
      })
      .andWhere({
        $or: [
          { access_count: { $lte: params.maxAccessCount } },
          { access_count: null },
        ],
      })
      .orderBy({ created_at_epoch: 'ASC' });

    if (params.limit) {
      qb.limit(params.limit);
    }

    const entities = await qb.getResult();
    return entities.map(toRecord);
  }

  async getForPromotion(params: {
    minAccessCount: number;
    types?: string[];
    limit?: number;
  }): Promise<ObservationRecord[]> {
    const qb = this.em.createQueryBuilder(Observation, 'o')
      .where({ memory_tier: 'working' })
      .andWhere({ access_count: { $gte: params.minAccessCount } });

    if (params.types && params.types.length > 0) {
      qb.andWhere({ type: { $in: params.types } });
    }

    qb.orderBy({ access_count: 'DESC' });

    if (params.limit) {
      qb.limit(params.limit);
    }

    const entities = await qb.getResult();
    return entities.map(toRecord);
  }

  // Importance scoring methods

  async pinObservation(id: number): Promise<ObservationRecord | null> {
    const entity = await this.em.findOne(Observation, { id });
    if (!entity) return null;

    entity.pinned = true;

    await this.em.flush();
    return toRecord(entity);
  }

  async unpinObservation(id: number): Promise<ObservationRecord | null> {
    const entity = await this.em.findOne(Observation, { id });
    if (!entity) return null;

    entity.pinned = false;

    await this.em.flush();
    return toRecord(entity);
  }

  async setImportanceBoost(id: number, boost: number): Promise<ObservationRecord | null> {
    const entity = await this.em.findOne(Observation, { id });
    if (!entity) return null;

    entity.importance_boost = boost;

    await this.em.flush();
    return toRecord(entity);
  }

  async getByImportance(options?: {
    project?: string;
    limit?: number;
  }): Promise<ObservationRecord[]> {
    const knex = this.em.getKnex();

    // Calculate importance score: pinned items first, then by boost + recency
    let query = knex('observations')
      .select('*')
      .orderByRaw('CASE WHEN pinned = 1 THEN 0 ELSE 1 END')
      .orderByRaw('COALESCE(importance_boost, 0) DESC')
      .orderBy('created_at_epoch', 'desc');

    if (options?.project) {
      query = query.where('project', options.project);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const rows = await query;
    return rows as ObservationRecord[];
  }

  async getPinnedObservations(project?: string): Promise<ObservationRecord[]> {
    const qb = this.em.createQueryBuilder(Observation, 'o')
      .where({ pinned: true });

    if (project) {
      qb.andWhere({ project });
    }

    qb.orderBy({ created_at_epoch: 'DESC' });

    const entities = await qb.getResult();
    return entities.map(toRecord);
  }
}

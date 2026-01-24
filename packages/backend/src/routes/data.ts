/**
 * Data Routes
 *
 * API endpoints for data retrieval (UI, MCP, etc.)
 */

import type { Request, Response } from 'express';
import { BaseRouter } from './base-router.js';
import type { SessionService } from '../services/session-service.js';
import type { TaskService } from '../services/task-service.js';
import type { IObservationRepository, ISummaryRepository, ISessionRepository, IDocumentRepository, IUserPromptRepository, ObservationType, DocumentType, TaskStatus, ObservationQueryFilters } from '@claude-mem/types';

/**
 * Helper to get string from query/params (handles string | string[])
 */
function getString(val: unknown): string | undefined {
  if (Array.isArray(val)) return val[0];
  if (typeof val === 'string') return val;
  return undefined;
}

/**
 * Helper to get required string from params (handles string | string[])
 */
function getRequiredString(val: unknown): string {
  if (Array.isArray(val)) return val[0] ?? '';
  if (typeof val === 'string') return val;
  return '';
}

export interface DataRouterDeps {
  sessionService: SessionService;
  taskService: TaskService;
  observations: IObservationRepository;
  summaries: ISummaryRepository;
  sessions: ISessionRepository;
  documents: IDocumentRepository;
  userPrompts: IUserPromptRepository;
}

export class DataRouter extends BaseRouter {
  constructor(private readonly deps: DataRouterDeps) {
    super();
  }

  protected setupRoutes(): void {
    // Sessions
    this.router.get('/sessions', this.asyncHandler(this.listSessions.bind(this)));
    this.router.get('/sessions/:id', this.asyncHandler(this.getSession.bind(this)));
    this.router.delete('/sessions/:id', this.asyncHandler(this.deleteSession.bind(this)));

    // Observations
    this.router.get('/observations', this.asyncHandler(this.listObservations.bind(this)));
    this.router.post('/observations', this.asyncHandler(this.createObservation.bind(this)));
    this.router.get('/observations/:id', this.asyncHandler(this.getObservation.bind(this)));
    this.router.delete('/observations/:id', this.asyncHandler(this.deleteObservation.bind(this)));
    this.router.delete('/observations', this.asyncHandler(this.bulkDeleteObservations.bind(this)));
    this.router.get('/sessions/:sessionId/observations', this.asyncHandler(this.getSessionObservations.bind(this)));

    // Summaries
    this.router.get('/sessions/:sessionId/summaries', this.asyncHandler(this.getSessionSummaries.bind(this)));

    // User Prompts
    this.router.get('/sessions/:sessionId/prompts', this.asyncHandler(this.getSessionPrompts.bind(this)));

    // Tasks
    this.router.get('/tasks', this.asyncHandler(this.listTasks.bind(this)));
    this.router.get('/tasks/:id', this.asyncHandler(this.getTask.bind(this)));
    this.router.get('/tasks/status/counts', this.asyncHandler(this.getTaskCounts.bind(this)));

    // Stats
    this.router.get('/stats', this.asyncHandler(this.getStats.bind(this)));

    // Projects
    this.router.get('/projects', this.asyncHandler(this.listProjects.bind(this)));
    this.router.get('/projects/:project/stats', this.asyncHandler(this.getProjectStats.bind(this)));
    this.router.get('/projects/:project/files', this.asyncHandler(this.getProjectFiles.bind(this)));

    // Analytics
    this.router.get('/analytics/timeline', this.asyncHandler(this.getAnalyticsTimeline.bind(this)));
    this.router.get('/analytics/types', this.asyncHandler(this.getAnalyticsTypes.bind(this)));
    this.router.get('/analytics/projects', this.asyncHandler(this.getAnalyticsProjects.bind(this)));

    // Documents (MCP documentation cache)
    this.router.get('/documents', this.asyncHandler(this.listDocuments.bind(this)));
    this.router.get('/documents/:id', this.asyncHandler(this.getDocument.bind(this)));
    this.router.get('/documents/search', this.asyncHandler(this.searchDocuments.bind(this)));
    this.router.delete('/documents/:id', this.asyncHandler(this.deleteDocument.bind(this)));
  }

  /**
   * GET /api/data/sessions
   */
  private async listSessions(req: Request, res: Response): Promise<void> {
    const { project, status, limit, offset } = req.query;

    const sessions = await this.deps.sessionService.listSessions({
      project: getString(project),
      status: getString(status),
      limit: this.parseOptionalIntParam(getString(limit)),
      offset: this.parseOptionalIntParam(getString(offset)),
    });

    // Get first prompts for all sessions in batch
    const sessionIds = sessions.map(s => s.content_session_id);
    const firstPrompts = await this.deps.userPrompts.getFirstPromptsForSessions(sessionIds);

    // Enrich sessions with observation counts and first prompts
    const enrichedSessions = await Promise.all(
      sessions.map(async (session) => {
        const observationCount = session.memory_session_id
          ? await this.deps.observations.count({ sessionId: session.memory_session_id })
          : 0;
        return {
          ...session,
          user_prompt: firstPrompts.get(session.content_session_id) || null,
          observation_count: observationCount,
          prompt_count: session.prompt_counter ?? 0,
        };
      })
    );

    const total = await this.deps.sessionService.getSessionCount({
      project: getString(project),
      status: getString(status),
    });

    const parsedLimit = this.parseOptionalIntParam(getString(limit)) ?? 50;
    const parsedOffset = this.parseOptionalIntParam(getString(offset)) ?? 0;

    this.success(res, {
      data: enrichedSessions,
      total,
      limit: parsedLimit,
      offset: parsedOffset,
    });
  }

  /**
   * GET /api/data/sessions/:id
   */
  private async getSession(req: Request, res: Response): Promise<void> {
    const id = getRequiredString(req.params.id);

    const session = await this.deps.sessionService.getSession(id);
    if (!session) {
      this.notFound(`Session not found: ${id}`);
    }

    // Get first prompt
    const firstPrompt = await this.deps.userPrompts.getFirstForSession(session.content_session_id);

    // Enrich with observation count
    const observationCount = session.memory_session_id
      ? await this.deps.observations.count({ sessionId: session.memory_session_id })
      : 0;

    this.success(res, {
      ...session,
      user_prompt: firstPrompt?.prompt_text || null,
      observation_count: observationCount,
      prompt_count: session.prompt_counter ?? 0,
    });
  }

  /**
   * DELETE /api/data/sessions/:id
   */
  private async deleteSession(req: Request, res: Response): Promise<void> {
    const id = getRequiredString(req.params.id);

    const deleted = await this.deps.sessionService.deleteSession(id);
    if (!deleted) {
      this.notFound(`Session not found: ${id}`);
    }

    this.noContent(res);
  }

  /**
   * GET /api/data/observations
   */
  private async listObservations(req: Request, res: Response): Promise<void> {
    const { project, type, sessionId, limit, offset } = req.query;

    const observations = await this.deps.observations.list(
      {
        project: getString(project),
        type: getString(type) as ObservationType | undefined,
        sessionId: getString(sessionId),
      },
      {
        limit: this.parseOptionalIntParam(getString(limit)) ?? 50,
        offset: this.parseOptionalIntParam(getString(offset)),
      }
    );

    const total = await this.deps.observations.count({
      project: getString(project),
      type: getString(type) as ObservationType | undefined,
      sessionId: getString(sessionId),
    });

    const parsedLimit = this.parseOptionalIntParam(getString(limit)) ?? 50;
    const parsedOffset = this.parseOptionalIntParam(getString(offset)) ?? 0;

    this.success(res, {
      data: observations,
      total,
      limit: parsedLimit,
      offset: parsedOffset,
    });
  }

  /**
   * GET /api/data/observations/:id
   */
  private async getObservation(req: Request, res: Response): Promise<void> {
    const id = this.parseIntParam(getString(req.params.id), 'id');

    const observation = await this.deps.observations.findById(id);
    if (!observation) {
      this.notFound(`Observation not found: ${id}`);
    }

    this.success(res, observation);
  }

  /**
   * DELETE /api/data/observations/:id
   * Delete a single observation (GDPR compliance)
   */
  private async deleteObservation(req: Request, res: Response): Promise<void> {
    const id = this.parseIntParam(getString(req.params.id), 'id');

    const deleted = await this.deps.observations.delete(id);
    if (!deleted) {
      this.notFound(`Observation not found: ${id}`);
    }

    this.noContent(res);
  }

  /**
   * DELETE /api/data/observations
   * Bulk delete observations with filters (GDPR compliance)
   * Query params: project, sessionId, before (ISO date), ids (comma-separated)
   */
  private async bulkDeleteObservations(req: Request, res: Response): Promise<void> {
    const { project, sessionId, before, ids } = req.query;

    // At least one filter required for safety
    if (!project && !sessionId && !before && !ids) {
      this.badRequest('At least one filter required: project, sessionId, before, or ids');
    }

    let deletedCount = 0;

    // Delete by specific IDs
    if (ids) {
      const idList = getString(ids)!.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
      for (const id of idList) {
        const deleted = await this.deps.observations.delete(id);
        if (deleted) deletedCount++;
      }
    }
    // Delete by session
    else if (sessionId) {
      deletedCount = await this.deps.observations.deleteBySessionId(getString(sessionId)!);
    }
    // Delete by project and/or date (requires listing first)
    else {
      const filters: ObservationQueryFilters = {};
      if (project) filters.project = getString(project);
      if (before) {
        const beforeDate = new Date(getString(before)!);
        if (!isNaN(beforeDate.getTime())) {
          filters.dateRange = { end: beforeDate.getTime() };
        }
      }

      // Get matching observations and delete them
      const toDelete = await this.deps.observations.list(filters, { limit: 10000 });
      for (const obs of toDelete) {
        const deleted = await this.deps.observations.delete(obs.id);
        if (deleted) deletedCount++;
      }
    }

    this.success(res, { deleted: deletedCount });
  }

  /**
   * POST /api/data/observations
   * Create a manual memory observation (for save_memory MCP tool)
   */
  private async createObservation(req: Request, res: Response): Promise<void> {
    const { text, title, project, type } = req.body;

    if (!text) {
      this.badRequest('Missing required field: text');
    }

    // Use provided project or default to 'manual-memories'
    const observationProject = project || 'manual-memories';

    // Get or create a manual-memories session for this project
    const manualSessionId = `manual-${observationProject}`;
    let session = await this.deps.sessions.findByContentSessionId(manualSessionId);

    if (!session) {
      // Create the manual memories session
      session = await this.deps.sessions.create({
        contentSessionId: manualSessionId,
        memorySessionId: manualSessionId,
        project: observationProject,
      });
    }

    // Map type parameter to ObservationType (default: 'note')
    const typeMapping: Record<string, ObservationType> = {
      decision: 'decision',
      discovery: 'discovery',
      note: 'note',
      bookmark: 'discovery', // bookmark maps to discovery
    };
    const observationType: ObservationType = typeMapping[type] || 'note';

    // Create the observation
    const observation = await this.deps.observations.create({
      memorySessionId: manualSessionId,
      project: observationProject,
      text,
      type: observationType,
      title: title || text.slice(0, 100),
    });

    // Queue embedding for searchability
    await this.deps.taskService.queueEmbedding({
      observationIds: [observation.id],
    });

    this.success(res, {
      id: observation.id,
      message: 'Memory saved successfully',
      type: observationType,
      project: observationProject,
    });
  }

  /**
   * GET /api/data/sessions/:sessionId/observations
   */
  private async getSessionObservations(req: Request, res: Response): Promise<void> {
    const sessionId = getRequiredString(req.params.sessionId);
    const { limit, offset } = req.query;

    const observations = await this.deps.sessionService.getSessionObservations(sessionId, {
      limit: this.parseOptionalIntParam(getString(limit)),
      offset: this.parseOptionalIntParam(getString(offset)),
    });

    this.success(res, { data: observations });
  }

  /**
   * GET /api/data/sessions/:sessionId/summaries
   */
  private async getSessionSummaries(req: Request, res: Response): Promise<void> {
    const sessionId = getRequiredString(req.params.sessionId);

    const summaries = await this.deps.summaries.getBySessionId(sessionId);

    this.success(res, { data: summaries });
  }

  /**
   * GET /api/data/sessions/:sessionId/prompts
   */
  private async getSessionPrompts(req: Request, res: Response): Promise<void> {
    const sessionId = getRequiredString(req.params.sessionId);

    const prompts = await this.deps.userPrompts.getBySessionId(sessionId);

    this.success(res, { data: prompts });
  }

  /**
   * GET /api/data/tasks
   */
  private async listTasks(req: Request, res: Response): Promise<void> {
    const { status, type, limit, offset } = req.query;

    const tasks = await this.deps.taskService.listTasks({
      status: getString(status) as TaskStatus | undefined,
      type: getString(type),
      limit: this.parseOptionalIntParam(getString(limit)),
      offset: this.parseOptionalIntParam(getString(offset)),
    });

    this.success(res, { data: tasks });
  }

  /**
   * GET /api/data/tasks/:id
   */
  private async getTask(req: Request, res: Response): Promise<void> {
    const id = getRequiredString(req.params.id);

    const task = await this.deps.taskService.getTask(id);
    if (!task) {
      this.notFound(`Task not found: ${id}`);
    }

    this.success(res, task);
  }

  /**
   * GET /api/data/tasks/status/counts
   */
  private async getTaskCounts(_req: Request, res: Response): Promise<void> {
    const counts = await this.deps.taskService.getQueueStatus();
    this.success(res, counts);
  }

  /**
   * GET /api/data/stats
   */
  private async getStats(req: Request, res: Response): Promise<void> {
    const { project } = req.query;
    const projectFilter = getString(project);

    const [sessionCount, observationCount, summaryCount, taskCounts, distinctProjects] = await Promise.all([
      this.deps.sessionService.getSessionCount({ project: projectFilter }),
      this.deps.observations.count({ project: projectFilter }),
      this.deps.summaries.count({ project: projectFilter }),
      this.deps.taskService.getQueueStatus(),
      this.deps.sessions.getDistinctProjects(),
    ]);

    this.success(res, {
      sessions: sessionCount,
      observations: observationCount,
      summaries: summaryCount,
      projects: distinctProjects.length,
      tasks: taskCounts,
    });
  }

  /**
   * GET /api/data/projects
   */
  private async listProjects(_req: Request, res: Response): Promise<void> {
    const allProjects = await this.deps.sessions.getDistinctProjects();
    // Filter out empty/null project names
    const projects = allProjects.filter((p) => p && p.trim() !== '');
    this.success(res, { projects });
  }

  /**
   * GET /api/data/projects/:project/stats
   */
  private async getProjectStats(req: Request, res: Response): Promise<void> {
    const project = decodeURIComponent(getRequiredString(req.params.project));

    const [sessions, observations, summaries] = await Promise.all([
      this.deps.sessions.list({ project }, { limit: 1000 }),
      this.deps.observations.list({ project }, { limit: 10000 }),
      this.deps.summaries.list({ project }, { limit: 1000 }),
    ]);

    const totalTokens = observations.reduce((sum, o) => sum + (o.discovery_tokens || 0), 0)
      + summaries.reduce((sum, s) => sum + (s.discovery_tokens || 0), 0);

    const epochs = [
      ...observations.map(o => o.created_at_epoch),
      ...sessions.map(s => s.started_at_epoch),
    ].filter(Boolean);

    this.success(res, {
      sessions: sessions.length,
      observations: observations.length,
      summaries: summaries.length,
      tokens: totalTokens,
      firstActivity: epochs.length > 0 ? Math.min(...epochs) : null,
      lastActivity: epochs.length > 0 ? Math.max(...epochs) : null,
    });
  }

  /**
   * GET /api/data/projects/:project/files
   */
  private async getProjectFiles(req: Request, res: Response): Promise<void> {
    const project = decodeURIComponent(getRequiredString(req.params.project));

    const observations = await this.deps.observations.list({ project }, { limit: 10000 });

    const filesRead: Record<string, number> = {};
    const filesModified: Record<string, number> = {};

    for (const obs of observations) {
      if (obs.files_read) {
        try {
          const files = JSON.parse(obs.files_read) as string[];
          for (const f of files) {
            filesRead[f] = (filesRead[f] || 0) + 1;
          }
        } catch { /* ignore parse errors */ }
      }
      if (obs.files_modified) {
        try {
          const files = JSON.parse(obs.files_modified) as string[];
          for (const f of files) {
            filesModified[f] = (filesModified[f] || 0) + 1;
          }
        } catch { /* ignore parse errors */ }
      }
    }

    const sortByCount = (obj: Record<string, number>) =>
      Object.entries(obj)
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 50);

    this.success(res, {
      filesRead: sortByCount(filesRead),
      filesModified: sortByCount(filesModified),
    });
  }

  /**
   * GET /api/data/analytics/timeline
   * Returns observations/sessions/tokens grouped by day/week/month
   */
  private async getAnalyticsTimeline(req: Request, res: Response): Promise<void> {
    const period = getString(req.query.period) || 'day';
    const project = getString(req.query.project);
    const days = this.parseOptionalIntParam(getString(req.query.days)) || 30;

    const now = Date.now();
    const startEpoch = now - days * 24 * 60 * 60 * 1000;

    const [observations, sessions] = await Promise.all([
      this.deps.observations.list(
        { project, dateRange: { start: startEpoch } },
        { limit: 10000 }
      ),
      this.deps.sessions.list(
        { project, dateRange: { start: startEpoch } },
        { limit: 10000 }
      ),
    ]);

    // Group by period
    const getKey = (epoch: number): string => {
      const date = new Date(epoch);
      if (period === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().slice(0, 10);
      } else if (period === 'month') {
        return date.toISOString().slice(0, 7);
      }
      return date.toISOString().slice(0, 10); // day
    };

    const timeline: Record<string, { observations: number; sessions: number; tokens: number }> = {};

    for (const obs of observations) {
      const key = getKey(obs.created_at_epoch);
      if (!timeline[key]) timeline[key] = { observations: 0, sessions: 0, tokens: 0 };
      timeline[key].observations++;
      timeline[key].tokens += obs.discovery_tokens || 0;
    }

    for (const sess of sessions) {
      const key = getKey(sess.started_at_epoch);
      if (!timeline[key]) timeline[key] = { observations: 0, sessions: 0, tokens: 0 };
      timeline[key].sessions++;
    }

    const data = Object.entries(timeline)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    this.success(res, { data, period, days });
  }

  /**
   * GET /api/data/analytics/types
   * Returns observation count by type
   */
  private async getAnalyticsTypes(req: Request, res: Response): Promise<void> {
    const project = getString(req.query.project);

    const observations = await this.deps.observations.list({ project }, { limit: 100000 });

    const types: Record<string, number> = {};
    for (const obs of observations) {
      types[obs.type] = (types[obs.type] || 0) + 1;
    }

    const data = Object.entries(types)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    this.success(res, { data });
  }

  /**
   * GET /api/data/analytics/projects
   * Returns stats per project
   */
  private async getAnalyticsProjects(_req: Request, res: Response): Promise<void> {
    const allProjects = await this.deps.sessions.getDistinctProjects();
    // Filter out empty/null project names
    const projects = allProjects.filter((p) => p && p.trim() !== '');

    const data = await Promise.all(
      projects.map(async (project) => {
        const [observationCount, sessionCount] = await Promise.all([
          this.deps.observations.count({ project }),
          this.deps.sessions.count({ project }),
        ]);

        // Get token sum for a sample of observations
        const observations = await this.deps.observations.list({ project }, { limit: 1000 });
        const tokens = observations.reduce((sum, o) => sum + (o.discovery_tokens || 0), 0);

        return { project, observations: observationCount, sessions: sessionCount, tokens };
      })
    );

    this.success(res, {
      data: data.sort((a, b) => b.observations - a.observations),
    });
  }

  // ============================================
  // Documents (MCP Documentation Cache)
  // ============================================

  /**
   * GET /api/data/documents
   * List documents with optional filters
   */
  private async listDocuments(req: Request, res: Response): Promise<void> {
    const { project, source, sourceTool, type, limit, offset } = req.query;

    const documents = await this.deps.documents.list(
      {
        project: getString(project),
        source: getString(source),
        sourceTool: getString(sourceTool),
        type: getString(type) as DocumentType | undefined,
      },
      {
        limit: this.parseOptionalIntParam(getString(limit)) ?? 50,
        offset: this.parseOptionalIntParam(getString(offset)),
      }
    );

    const total = await this.deps.documents.count({
      project: getString(project),
      source: getString(source),
      sourceTool: getString(sourceTool),
      type: getString(type) as DocumentType | undefined,
    });

    const parsedLimit = this.parseOptionalIntParam(getString(limit)) ?? 50;
    const parsedOffset = this.parseOptionalIntParam(getString(offset)) ?? 0;

    this.success(res, {
      data: documents,
      total,
      limit: parsedLimit,
      offset: parsedOffset,
    });
  }

  /**
   * GET /api/data/documents/:id
   */
  private async getDocument(req: Request, res: Response): Promise<void> {
    const id = this.parseIntParam(getString(req.params.id), 'id');

    const document = await this.deps.documents.findById(id);
    if (!document) {
      this.notFound(`Document not found: ${id}`);
    }

    // Record access for cache statistics
    await this.deps.documents.recordAccess(id);

    this.success(res, document);
  }

  /**
   * GET /api/data/documents/search
   * Full-text search across documents
   */
  private async searchDocuments(req: Request, res: Response): Promise<void> {
    const query = getString(req.query.q);
    if (!query) {
      this.badRequest('Missing required query parameter: q');
    }

    const { project, type, limit, offset } = req.query;

    const documents = await this.deps.documents.search(
      query,
      {
        project: getString(project),
        type: getString(type) as DocumentType | undefined,
      },
      {
        limit: this.parseOptionalIntParam(getString(limit)) ?? 20,
        offset: this.parseOptionalIntParam(getString(offset)),
        orderBy: 'relevance',
      }
    );

    this.success(res, { data: documents, query });
  }

  /**
   * DELETE /api/data/documents/:id
   */
  private async deleteDocument(req: Request, res: Response): Promise<void> {
    const id = this.parseIntParam(getString(req.params.id), 'id');

    const deleted = await this.deps.documents.delete(id);
    if (!deleted) {
      this.notFound(`Document not found: ${id}`);
    }

    this.noContent(res);
  }
}

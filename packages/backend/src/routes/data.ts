/**
 * Data Routes
 *
 * API endpoints for data retrieval (UI, MCP, etc.)
 */

import type { Request, Response } from 'express';
import { BaseRouter } from './base-router.js';
import type { SessionService } from '../services/session-service.js';
import type { TaskService } from '../services/task-service.js';
import type { IObservationRepository, ISummaryRepository, ISessionRepository, IDocumentRepository, IUserPromptRepository, ICodeSnippetRepository, IObservationLinkRepository, IObservationTemplateRepository, IProjectSettingsRepository, ObservationType, DocumentType, TaskStatus, ObservationQueryFilters, ObservationLinkType } from '@claude-mem/types';
import {
  cacheManager,
  projectCache,
  analyticsCache,
  statsCache,
  createCacheKey,
} from '../services/cache-service.js';

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
  codeSnippets: ICodeSnippetRepository;
  observationLinks: IObservationLinkRepository;
  observationTemplates: IObservationTemplateRepository;
  projectSettings: IProjectSettingsRepository;
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
    this.router.get('/observations/pinned', this.asyncHandler(this.getPinnedObservations.bind(this)));
    this.router.get('/observations/important', this.asyncHandler(this.getImportantObservations.bind(this)));
    this.router.get('/observations/:id', this.asyncHandler(this.getObservation.bind(this)));
    this.router.delete('/observations/:id', this.asyncHandler(this.deleteObservation.bind(this)));
    this.router.post('/observations/:id/pin', this.asyncHandler(this.pinObservation.bind(this)));
    this.router.post('/observations/:id/unpin', this.asyncHandler(this.unpinObservation.bind(this)));
    this.router.post('/observations/:id/importance-boost', this.asyncHandler(this.setImportanceBoost.bind(this)));
    this.router.delete('/observations', this.asyncHandler(this.bulkDeleteObservations.bind(this)));
    this.router.get('/sessions/:sessionId/observations', this.asyncHandler(this.getSessionObservations.bind(this)));

    // Observation Links
    this.router.post('/observations/:id/links', this.asyncHandler(this.createObservationLink.bind(this)));
    this.router.get('/observations/:id/links', this.asyncHandler(this.getObservationLinks.bind(this)));
    this.router.delete('/links/:id', this.asyncHandler(this.deleteObservationLink.bind(this)));

    // Observation Templates
    this.router.get('/templates', this.asyncHandler(this.listTemplates.bind(this)));
    this.router.post('/templates', this.asyncHandler(this.createTemplate.bind(this)));
    this.router.get('/templates/:id', this.asyncHandler(this.getTemplate.bind(this)));
    this.router.put('/templates/:id', this.asyncHandler(this.updateTemplate.bind(this)));
    this.router.delete('/templates/:id', this.asyncHandler(this.deleteTemplate.bind(this)));

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

    // Code Snippets
    this.router.get('/code-snippets', this.asyncHandler(this.listCodeSnippets.bind(this)));
    this.router.get('/code-snippets/search', this.asyncHandler(this.searchCodeSnippets.bind(this)));
    this.router.get('/code-snippets/languages', this.asyncHandler(this.getCodeSnippetLanguages.bind(this)));
    this.router.get('/code-snippets/:id', this.asyncHandler(this.getCodeSnippet.bind(this)));
    this.router.get('/observations/:id/code-snippets', this.asyncHandler(this.getObservationCodeSnippets.bind(this)));
    this.router.delete('/code-snippets/:id', this.asyncHandler(this.deleteCodeSnippet.bind(this)));

    // Project Settings
    this.router.get('/project-settings', this.asyncHandler(this.listProjectSettings.bind(this)));
    this.router.get('/project-settings/recent', this.asyncHandler(this.getRecentlyActiveProjects.bind(this)));
    this.router.get('/project-settings/:project', this.asyncHandler(this.getProjectSettings.bind(this)));
    this.router.put('/project-settings/:project', this.asyncHandler(this.updateProjectSettings.bind(this)));
    this.router.delete('/project-settings/:project', this.asyncHandler(this.deleteProjectSettings.bind(this)));
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

    // Enrich sessions with observation counts, first prompts, and file info
    const enrichedSessions = await Promise.all(
      sessions.map(async (session) => {
        let observationCount = 0;
        const filesRead: string[] = [];
        const filesModified: string[] = [];

        if (session.memory_session_id) {
          const observations = await this.deps.observations.getBySessionId(session.memory_session_id);
          observationCount = observations.length;

          // Aggregate files from all observations
          for (const obs of observations) {
            if (obs.files_read) {
              try {
                const files = JSON.parse(obs.files_read) as string[];
                for (const f of files) {
                  if (!filesRead.includes(f)) filesRead.push(f);
                }
              } catch { /* ignore parse errors */ }
            }
            if (obs.files_modified) {
              try {
                const files = JSON.parse(obs.files_modified) as string[];
                for (const f of files) {
                  if (!filesModified.includes(f)) filesModified.push(f);
                }
              } catch { /* ignore parse errors */ }
            }
          }
        }

        return {
          ...session,
          user_prompt: firstPrompts.get(session.content_session_id) || null,
          observation_count: observationCount,
          prompt_count: session.prompt_counter ?? 0,
          files_read: filesRead,
          files_modified: filesModified,
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

    // Enrich with observation count and file info
    let observationCount = 0;
    const filesRead: string[] = [];
    const filesModified: string[] = [];

    if (session.memory_session_id) {
      const observations = await this.deps.observations.getBySessionId(session.memory_session_id);
      observationCount = observations.length;

      // Aggregate files from all observations
      for (const obs of observations) {
        if (obs.files_read) {
          try {
            const files = JSON.parse(obs.files_read) as string[];
            for (const f of files) {
              if (!filesRead.includes(f)) filesRead.push(f);
            }
          } catch { /* ignore parse errors */ }
        }
        if (obs.files_modified) {
          try {
            const files = JSON.parse(obs.files_modified) as string[];
            for (const f of files) {
              if (!filesModified.includes(f)) filesModified.push(f);
            }
          } catch { /* ignore parse errors */ }
        }
      }
    }

    this.success(res, {
      ...session,
      user_prompt: firstPrompt?.prompt_text || null,
      observation_count: observationCount,
      prompt_count: session.prompt_counter ?? 0,
      files_read: filesRead,
      files_modified: filesModified,
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

    // Invalidate caches (Issue #203)
    cacheManager.invalidateAll('');

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

    // Invalidate caches (Issue #203)
    cacheManager.invalidateAll('');

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

    // Delete by specific IDs (Issue #204: Use batch delete)
    if (ids) {
      const idList = getString(ids)!.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
      deletedCount = await this.deps.observations.batchDelete(idList);
    }
    // Delete by session
    else if (sessionId) {
      deletedCount = await this.deps.observations.deleteBySessionId(getString(sessionId)!);
    }
    // Delete by project and/or date (Issue #204: Use batch delete)
    else {
      const filters: ObservationQueryFilters = {};
      if (project) filters.project = getString(project);
      if (before) {
        const beforeDate = new Date(getString(before)!);
        if (!isNaN(beforeDate.getTime())) {
          filters.dateRange = { end: beforeDate.getTime() };
        }
      }

      // Get matching observations and batch delete them
      const toDelete = await this.deps.observations.list(filters, { limit: 10000 });
      const idsToDelete = toDelete.map(obs => obs.id);
      deletedCount = await this.deps.observations.batchDelete(idsToDelete);
    }

    // Invalidate caches (Issue #203)
    cacheManager.invalidateAll('');

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

    // Invalidate caches (Issue #203)
    cacheManager.onObservationCreated(observationProject);

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
   * POST /api/data/observations/:id/pin
   * Pin an observation (mark as important)
   */
  private async pinObservation(req: Request, res: Response): Promise<void> {
    const id = this.parseIntParam(getString(req.params.id), 'id');

    const observation = await this.deps.observations.pinObservation(id);
    if (!observation) {
      this.notFound(`Observation not found: ${id}`);
    }

    this.success(res, observation);
  }

  /**
   * POST /api/data/observations/:id/unpin
   * Unpin an observation
   */
  private async unpinObservation(req: Request, res: Response): Promise<void> {
    const id = this.parseIntParam(getString(req.params.id), 'id');

    const observation = await this.deps.observations.unpinObservation(id);
    if (!observation) {
      this.notFound(`Observation not found: ${id}`);
    }

    this.success(res, observation);
  }

  /**
   * POST /api/data/observations/:id/importance-boost
   * Set importance boost for an observation
   */
  private async setImportanceBoost(req: Request, res: Response): Promise<void> {
    const id = this.parseIntParam(getString(req.params.id), 'id');
    const { boost } = req.body;

    if (typeof boost !== 'number') {
      this.badRequest('Missing or invalid boost value (must be a number)');
    }

    const observation = await this.deps.observations.setImportanceBoost(id, boost);
    if (!observation) {
      this.notFound(`Observation not found: ${id}`);
    }

    this.success(res, observation);
  }

  /**
   * GET /api/data/observations/pinned
   * Get all pinned observations
   */
  private async getPinnedObservations(req: Request, res: Response): Promise<void> {
    const { project } = req.query;

    const observations = await this.deps.observations.getPinnedObservations(
      getString(project)
    );

    this.success(res, { data: observations });
  }

  /**
   * GET /api/data/observations/important
   * Get observations sorted by importance
   */
  private async getImportantObservations(req: Request, res: Response): Promise<void> {
    const { project, limit } = req.query;

    const observations = await this.deps.observations.getByImportance({
      project: getString(project),
      limit: this.parseOptionalIntParam(getString(limit)) ?? 50,
    });

    this.success(res, { data: observations });
  }

  /**
   * POST /api/data/observations/:id/links
   * Create a link from this observation to another
   */
  private async createObservationLink(req: Request, res: Response): Promise<void> {
    const sourceId = this.parseIntParam(getString(req.params.id), 'id');
    const { targetId, linkType, description } = req.body;

    if (!targetId) {
      this.badRequest('Missing required field: targetId');
    }

    // Validate link type
    const validLinkTypes = ['related', 'depends_on', 'blocks', 'references', 'supersedes', 'similar', 'contradicts', 'extends'];
    const type = linkType || 'related';
    if (!validLinkTypes.includes(type)) {
      this.badRequest(`Invalid link type. Must be one of: ${validLinkTypes.join(', ')}`);
    }

    // Prevent self-links
    if (sourceId === targetId) {
      this.badRequest('Cannot link an observation to itself');
    }

    // Check if link already exists
    const exists = await this.deps.observationLinks.linkExists(sourceId, targetId, type as ObservationLinkType);
    if (exists) {
      this.badRequest('Link already exists');
    }

    const link = await this.deps.observationLinks.create({
      sourceId,
      targetId,
      linkType: type as ObservationLinkType,
      description,
    });

    this.success(res, link);
  }

  /**
   * GET /api/data/observations/:id/links
   * Get all links for an observation (both directions)
   */
  private async getObservationLinks(req: Request, res: Response): Promise<void> {
    const observationId = this.parseIntParam(getString(req.params.id), 'id');

    const links = await this.deps.observationLinks.getAllLinks(observationId);

    this.success(res, { data: links });
  }

  /**
   * DELETE /api/data/links/:id
   * Delete a link
   */
  private async deleteObservationLink(req: Request, res: Response): Promise<void> {
    const id = this.parseIntParam(getString(req.params.id), 'id');

    const deleted = await this.deps.observationLinks.delete(id);
    if (!deleted) {
      this.notFound(`Link not found: ${id}`);
    }

    this.noContent(res);
  }

  // ============================================
  // Observation Templates
  // ============================================

  /**
   * GET /api/data/templates
   * List observation templates
   */
  private async listTemplates(req: Request, res: Response): Promise<void> {
    const { type, project, isDefault } = req.query;

    const templates = await this.deps.observationTemplates.list({
      type: getString(type) as ObservationType | undefined,
      project: getString(project),
      isDefault: getString(isDefault) === 'true' ? true : undefined,
    });

    this.success(res, { data: templates });
  }

  /**
   * POST /api/data/templates
   * Create a new template
   */
  private async createTemplate(req: Request, res: Response): Promise<void> {
    const { name, description, type, project, fields, isDefault } = req.body;

    if (!name) {
      this.badRequest('Missing required field: name');
    }
    if (!type) {
      this.badRequest('Missing required field: type');
    }
    if (!fields) {
      this.badRequest('Missing required field: fields');
    }

    const template = await this.deps.observationTemplates.create({
      name,
      description,
      type,
      project,
      fields: typeof fields === 'string' ? fields : JSON.stringify(fields),
      isDefault: isDefault ?? false,
    });

    this.success(res, template);
  }

  /**
   * GET /api/data/templates/:id
   * Get a template by ID
   */
  private async getTemplate(req: Request, res: Response): Promise<void> {
    const id = this.parseIntParam(getString(req.params.id), 'id');

    const template = await this.deps.observationTemplates.findById(id);
    if (!template) {
      this.notFound(`Template not found: ${id}`);
    }

    this.success(res, template);
  }

  /**
   * PUT /api/data/templates/:id
   * Update a template
   */
  private async updateTemplate(req: Request, res: Response): Promise<void> {
    const id = this.parseIntParam(getString(req.params.id), 'id');
    const { name, description, type, project, fields, isDefault } = req.body;

    try {
      const template = await this.deps.observationTemplates.update(id, {
        name,
        description,
        type,
        project,
        fields: fields ? (typeof fields === 'string' ? fields : JSON.stringify(fields)) : undefined,
        isDefault,
      });

      if (!template) {
        this.notFound(`Template not found: ${id}`);
      }

      this.success(res, template);
    } catch (error) {
      if (error instanceof Error && error.message.includes('system')) {
        this.badRequest('Cannot modify system templates');
      }
      throw error;
    }
  }

  /**
   * DELETE /api/data/templates/:id
   * Delete a template
   */
  private async deleteTemplate(req: Request, res: Response): Promise<void> {
    const id = this.parseIntParam(getString(req.params.id), 'id');

    try {
      const deleted = await this.deps.observationTemplates.delete(id);
      if (!deleted) {
        this.notFound(`Template not found: ${id}`);
      }

      this.noContent(res);
    } catch (error) {
      if (error instanceof Error && error.message.includes('system')) {
        this.badRequest('Cannot delete system templates');
      }
      throw error;
    }
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
   * Cached for 1 minute (Issue #203)
   */
  private async getStats(req: Request, res: Response): Promise<void> {
    const { project } = req.query;
    const projectFilter = getString(project);
    const cacheKey = createCacheKey('stats:overview', { project: projectFilter });

    const result = await statsCache.getOrSet(cacheKey, async () => {
      const [sessionCount, observationCount, summaryCount, taskCounts, distinctProjects] = await Promise.all([
        this.deps.sessionService.getSessionCount({ project: projectFilter }),
        this.deps.observations.count({ project: projectFilter }),
        this.deps.summaries.count({ project: projectFilter }),
        this.deps.taskService.getQueueStatus(),
        this.deps.sessions.getDistinctProjects(),
      ]);

      return {
        sessions: sessionCount,
        observations: observationCount,
        summaries: summaryCount,
        projects: distinctProjects.length,
        tasks: taskCounts,
      };
    });

    res.set('X-Cache', statsCache.has(cacheKey) ? 'HIT' : 'MISS');
    this.success(res, result);
  }

  /**
   * GET /api/data/projects
   * Cached for 1 minute (Issue #203)
   */
  private async listProjects(_req: Request, res: Response): Promise<void> {
    const cacheKey = createCacheKey('projects', {});

    const result = await projectCache.getOrSet(cacheKey, async () => {
      const allProjects = await this.deps.sessions.getDistinctProjects();
      // Filter out empty/null project names
      const projects = allProjects.filter((p) => p && p.trim() !== '');
      return { projects };
    });

    res.set('X-Cache', projectCache.has(cacheKey) ? 'HIT' : 'MISS');
    this.success(res, result);
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
   * Uses SQL aggregation for efficiency
   * Cached for 5 minutes (Issue #203)
   */
  private async getAnalyticsTimeline(req: Request, res: Response): Promise<void> {
    const period = (getString(req.query.period) || 'day') as 'day' | 'week' | 'month';
    const project = getString(req.query.project);
    const days = this.parseOptionalIntParam(getString(req.query.days)) || 30;
    const cacheKey = createCacheKey('analytics:timeline', { period, project, days });

    const result = await analyticsCache.getOrSet(cacheKey, async () => {
      const startEpoch = Date.now() - days * 24 * 60 * 60 * 1000;

      // Use SQL aggregation instead of loading all records
      const [obsStats, sessStats] = await Promise.all([
        this.deps.observations.getTimelineStats({ startEpoch, period, project }),
        this.deps.sessions.getTimelineStats({ startEpoch, period, project }),
      ]);

      // Merge observation and session stats
      const timeline: Record<string, { observations: number; sessions: number; tokens: number }> = {};

      for (const obs of obsStats) {
        timeline[obs.date] = { observations: obs.observations, sessions: 0, tokens: obs.tokens };
      }

      for (const sess of sessStats) {
        if (timeline[sess.date]) {
          timeline[sess.date].sessions = sess.sessions;
        } else {
          timeline[sess.date] = { observations: 0, sessions: sess.sessions, tokens: 0 };
        }
      }

      const data = Object.entries(timeline)
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return { data, period, days };
    });

    res.set('X-Cache', analyticsCache.has(cacheKey) ? 'HIT' : 'MISS');
    this.success(res, result);
  }

  /**
   * GET /api/data/analytics/types
   * Returns observation count by type
   * Cached for 5 minutes (Issue #203)
   */
  private async getAnalyticsTypes(req: Request, res: Response): Promise<void> {
    const project = getString(req.query.project);
    const cacheKey = createCacheKey('analytics:types', { project });

    const result = await analyticsCache.getOrSet(cacheKey, async () => {
      const observations = await this.deps.observations.list({ project }, { limit: 100000 });

      const types: Record<string, number> = {};
      for (const obs of observations) {
        types[obs.type] = (types[obs.type] || 0) + 1;
      }

      const data = Object.entries(types)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

      return { data };
    });

    res.set('X-Cache', analyticsCache.has(cacheKey) ? 'HIT' : 'MISS');
    this.success(res, result);
  }

  /**
   * GET /api/data/analytics/projects
   * Returns stats per project
   * Cached for 5 minutes (Issue #203)
   */
  private async getAnalyticsProjects(_req: Request, res: Response): Promise<void> {
    const cacheKey = createCacheKey('analytics:projects', {});

    const result = await analyticsCache.getOrSet(cacheKey, async () => {
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

      return {
        data: data.sort((a, b) => b.observations - a.observations),
      };
    });

    res.set('X-Cache', analyticsCache.has(cacheKey) ? 'HIT' : 'MISS');
    this.success(res, result);
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

  // ============================================
  // Code Snippet Endpoints
  // ============================================

  /**
   * GET /api/data/code-snippets
   * List code snippets with optional filtering
   */
  private async listCodeSnippets(req: Request, res: Response): Promise<void> {
    const { project, language, sessionId, limit, offset } = req.query;

    const snippets = await this.deps.codeSnippets.list(
      {
        project: getString(project),
        language: getString(language),
        sessionId: getString(sessionId),
      },
      {
        limit: this.parseOptionalIntParam(getString(limit)) ?? 50,
        offset: this.parseOptionalIntParam(getString(offset)),
        orderBy: 'created_at_epoch',
        order: 'desc',
      }
    );

    this.success(res, { data: snippets });
  }

  /**
   * GET /api/data/code-snippets/search
   * Full-text search across code snippets
   */
  private async searchCodeSnippets(req: Request, res: Response): Promise<void> {
    const query = getString(req.query.q);
    if (!query) {
      this.badRequest('Missing required query parameter: q');
    }

    const { project, language, limit, offset } = req.query;

    const snippets = await this.deps.codeSnippets.search(
      query,
      {
        project: getString(project),
        language: getString(language),
      },
      {
        limit: this.parseOptionalIntParam(getString(limit)) ?? 20,
        offset: this.parseOptionalIntParam(getString(offset)),
      }
    );

    this.success(res, { data: snippets, query });
  }

  /**
   * GET /api/data/code-snippets/languages
   * Get distinct programming languages from code snippets
   */
  private async getCodeSnippetLanguages(req: Request, res: Response): Promise<void> {
    const { project } = req.query;

    const languages = await this.deps.codeSnippets.getDistinctLanguages(
      getString(project)
    );

    this.success(res, { data: languages });
  }

  /**
   * GET /api/data/code-snippets/:id
   * Get a specific code snippet by ID
   */
  private async getCodeSnippet(req: Request, res: Response): Promise<void> {
    const id = this.parseIntParam(getString(req.params.id), 'id');

    const snippet = await this.deps.codeSnippets.findById(id);
    if (!snippet) {
      this.notFound(`Code snippet not found: ${id}`);
    }

    this.success(res, snippet);
  }

  /**
   * GET /api/data/observations/:id/code-snippets
   * Get code snippets for a specific observation
   */
  private async getObservationCodeSnippets(req: Request, res: Response): Promise<void> {
    const observationId = this.parseIntParam(getString(req.params.id), 'id');

    const snippets = await this.deps.codeSnippets.findByObservationId(observationId);

    this.success(res, { data: snippets });
  }

  /**
   * DELETE /api/data/code-snippets/:id
   * Delete a code snippet
   */
  private async deleteCodeSnippet(req: Request, res: Response): Promise<void> {
    const id = this.parseIntParam(getString(req.params.id), 'id');

    const deleted = await this.deps.codeSnippets.delete(id);
    if (!deleted) {
      this.notFound(`Code snippet not found: ${id}`);
    }

    this.noContent(res);
  }

  // ============================================
  // Project Settings
  // ============================================

  /**
   * GET /api/data/project-settings
   * List all project settings
   */
  private async listProjectSettings(req: Request, res: Response): Promise<void> {
    const { limit, offset } = req.query;

    const settings = await this.deps.projectSettings.listAll({
      limit: this.parseOptionalIntParam(getString(limit)) ?? 50,
      offset: this.parseOptionalIntParam(getString(offset)),
    });

    const total = await this.deps.projectSettings.count();

    this.success(res, {
      data: settings,
      total,
      limit: this.parseOptionalIntParam(getString(limit)) ?? 50,
      offset: this.parseOptionalIntParam(getString(offset)) ?? 0,
    });
  }

  /**
   * GET /api/data/project-settings/recent
   * Get recently active projects
   */
  private async getRecentlyActiveProjects(req: Request, res: Response): Promise<void> {
    const { limit } = req.query;

    const settings = await this.deps.projectSettings.getRecentlyActive(
      this.parseOptionalIntParam(getString(limit)) ?? 10
    );

    this.success(res, { data: settings });
  }

  /**
   * GET /api/data/project-settings/:project
   * Get or create project settings
   */
  private async getProjectSettings(req: Request, res: Response): Promise<void> {
    const project = decodeURIComponent(getRequiredString(req.params.project));

    const settings = await this.deps.projectSettings.getOrCreate(project);

    this.success(res, settings);
  }

  /**
   * PUT /api/data/project-settings/:project
   * Update project settings
   */
  private async updateProjectSettings(req: Request, res: Response): Promise<void> {
    const project = decodeURIComponent(getRequiredString(req.params.project));
    const { displayName, description, settings, metadata } = req.body;

    const updated = await this.deps.projectSettings.update(project, {
      displayName,
      description,
      settings: settings ? (typeof settings === 'string' ? settings : JSON.stringify(settings)) : undefined,
      metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : undefined,
    });

    if (!updated) {
      this.notFound(`Project settings not found: ${project}`);
    }

    this.success(res, updated);
  }

  /**
   * DELETE /api/data/project-settings/:project
   * Delete project settings
   */
  private async deleteProjectSettings(req: Request, res: Response): Promise<void> {
    const project = decodeURIComponent(getRequiredString(req.params.project));

    const deleted = await this.deps.projectSettings.delete(project);
    if (!deleted) {
      this.notFound(`Project settings not found: ${project}`);
    }

    this.noContent(res);
  }
}

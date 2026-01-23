/**
 * Export Routes
 *
 * API endpoints for exporting data (sessions, observations, etc.)
 */

import type { Request, Response } from 'express';
import { BaseRouter } from './base-router.js';
import type { SessionService } from '../services/session-service.js';
import type { IObservationRepository, ISummaryRepository, ISessionRepository } from '@claude-mem/types';

/**
 * Helper to get string from query/params (handles string | string[])
 */
function getString(val: unknown): string | undefined {
  if (Array.isArray(val)) return val[0];
  if (typeof val === 'string') return val;
  return undefined;
}

/**
 * Parse JSON string to array, return null if invalid
 */
function parseJsonArray(val: string | null | undefined): string[] | null {
  if (!val) return null;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    // Fallback: treat as newline-separated (legacy format)
    return val.split('\n').filter(s => s.trim());
  }
}

/**
 * Transform observation record for export (parse JSON fields to arrays)
 */
function transformObservation(obs: Record<string, unknown>): Record<string, unknown> {
  return {
    ...obs,
    facts: parseJsonArray(obs.facts as string),
    concepts: parseJsonArray(obs.concepts as string),
    files_read: parseJsonArray(obs.files_read as string),
    files_modified: parseJsonArray(obs.files_modified as string),
  };
}

export interface ExportRouterDeps {
  sessionService: SessionService;
  observations: IObservationRepository;
  summaries: ISummaryRepository;
  sessions: ISessionRepository;
}

export class ExportRouter extends BaseRouter {
  constructor(private readonly deps: ExportRouterDeps) {
    super();
  }

  protected setupRoutes(): void {
    // Export all data (sessions + observations)
    this.router.get('/', this.asyncHandler(this.exportAll.bind(this)));

    // Export sessions
    this.router.get('/sessions', this.asyncHandler(this.exportSessions.bind(this)));

    // Export observations
    this.router.get('/observations', this.asyncHandler(this.exportObservations.bind(this)));

    // Export single session with all related data
    this.router.get('/sessions/:id', this.asyncHandler(this.exportSession.bind(this)));
  }

  /**
   * GET /api/export
   * Export all data (optionally filtered by project)
   */
  private async exportAll(req: Request, res: Response): Promise<void> {
    const { project, format } = req.query;
    const projectFilter = getString(project);
    const formatType = getString(format) ?? 'json';

    // Fetch all data
    const [sessions, rawObservations, summaries] = await Promise.all([
      this.deps.sessions.list({ project: projectFilter }, { limit: 10000 }),
      this.deps.observations.list({ project: projectFilter }, { limit: 100000 }),
      this.deps.summaries.list({ project: projectFilter }, { limit: 10000 }),
    ]);

    // Transform observations to parse JSON arrays
    const observations = rawObservations.map(obs => transformObservation(obs as unknown as Record<string, unknown>));

    const exportData = {
      exportedAt: new Date().toISOString(),
      project: projectFilter ?? 'all',
      sessions,
      observations,
      summaries,
      counts: {
        sessions: sessions.length,
        observations: observations.length,
        summaries: summaries.length,
      },
    };

    if (formatType === 'download') {
      const filename = projectFilter
        ? `claude-mem-export-${projectFilter}-${Date.now()}.json`
        : `claude-mem-export-${Date.now()}.json`;

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(JSON.stringify(exportData, null, 2));
    } else {
      this.success(res, exportData);
    }
  }

  /**
   * GET /api/export/sessions
   * Export sessions list
   */
  private async exportSessions(req: Request, res: Response): Promise<void> {
    const { project, limit } = req.query;
    const projectFilter = getString(project);
    const limitNum = this.parseOptionalIntParam(getString(limit)) ?? 1000;

    const sessions = await this.deps.sessions.list(
      { project: projectFilter },
      { limit: limitNum }
    );

    this.success(res, {
      exportedAt: new Date().toISOString(),
      project: projectFilter ?? 'all',
      count: sessions.length,
      sessions,
    });
  }

  /**
   * GET /api/export/observations
   * Export observations list
   */
  private async exportObservations(req: Request, res: Response): Promise<void> {
    const { project, sessionId, type, limit } = req.query;
    const projectFilter = getString(project);
    const sessionIdFilter = getString(sessionId);
    const typeFilter = getString(type);
    const limitNum = this.parseOptionalIntParam(getString(limit)) ?? 10000;

    const rawObservations = await this.deps.observations.list(
      {
        project: projectFilter,
        sessionId: sessionIdFilter,
        type: typeFilter as any,
      },
      { limit: limitNum }
    );

    // Transform observations to parse JSON arrays
    const observations = rawObservations.map(obs => transformObservation(obs as unknown as Record<string, unknown>));

    this.success(res, {
      exportedAt: new Date().toISOString(),
      filters: {
        project: projectFilter ?? 'all',
        sessionId: sessionIdFilter,
        type: typeFilter,
      },
      count: observations.length,
      observations,
    });
  }

  /**
   * GET /api/export/sessions/:id
   * Export a single session with all related data
   */
  private async exportSession(req: Request, res: Response): Promise<void> {
    const sessionId = getString(req.params.id);
    if (!sessionId) {
      this.badRequest('Session ID is required');
    }

    const session = await this.deps.sessionService.getSession(sessionId!);
    if (!session) {
      this.notFound(`Session not found: ${sessionId}`);
    }

    const [rawObservations, summaries] = await Promise.all([
      this.deps.observations.list({ sessionId: sessionId }, { limit: 100000 }),
      this.deps.summaries.list({ sessionId: sessionId }, { limit: 1000 }),
    ]);

    // Transform observations to parse JSON arrays
    const observations = rawObservations.map(obs => transformObservation(obs as unknown as Record<string, unknown>));

    this.success(res, {
      exportedAt: new Date().toISOString(),
      session,
      observations,
      summaries,
      counts: {
        observations: observations.length,
        summaries: summaries.length,
      },
    });
  }
}

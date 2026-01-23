/**
 * Import Routes
 *
 * API endpoints for importing data (sessions, observations, etc.)
 */

import type { Request, Response } from 'express';
import { BaseRouter } from './base-router.js';
import type {
  IObservationRepository,
  ISummaryRepository,
  ISessionRepository,
  CreateSessionInput,
  CreateObservationInput,
  CreateSummaryInput,
} from '@claude-mem/types';

export interface ImportRouterDeps {
  observations: IObservationRepository;
  summaries: ISummaryRepository;
  sessions: ISessionRepository;
}

interface ImportData {
  sessions?: Array<{
    content_session_id: string;
    memory_session_id?: string;
    project: string;
    user_prompt?: string;
    [key: string]: unknown;
  }>;
  observations?: Array<{
    memory_session_id: string;
    project: string;
    text: string;
    type: string;
    title?: string;
    subtitle?: string;
    concepts?: string;
    facts?: string;
    narrative?: string;
    files_read?: string;
    files_modified?: string;
    prompt_number?: number;
    discovery_tokens?: number;
    git_branch?: string;
    [key: string]: unknown;
  }>;
  summaries?: Array<{
    memory_session_id: string;
    project: string;
    request?: string;
    investigated?: string;
    learned?: string;
    completed?: string;
    next_steps?: string;
    prompt_number?: number;
    discovery_tokens?: number;
    [key: string]: unknown;
  }>;
}

export class ImportRouter extends BaseRouter {
  constructor(private readonly deps: ImportRouterDeps) {
    super();
  }

  protected setupRoutes(): void {
    // Import all data
    this.router.post('/', this.asyncHandler(this.importAll.bind(this)));

    // Import sessions only
    this.router.post('/sessions', this.asyncHandler(this.importSessions.bind(this)));

    // Import observations only
    this.router.post('/observations', this.asyncHandler(this.importObservations.bind(this)));

    // Import summaries only
    this.router.post('/summaries', this.asyncHandler(this.importSummaries.bind(this)));
  }

  /**
   * POST /api/import
   * Import all data from export format
   */
  private async importAll(req: Request, res: Response): Promise<void> {
    const data = req.body as ImportData;
    const { skipExisting } = req.query;
    const shouldSkip = skipExisting === 'true';

    const results = {
      sessions: { imported: 0, skipped: 0, errors: 0 },
      observations: { imported: 0, skipped: 0, errors: 0 },
      summaries: { imported: 0, skipped: 0, errors: 0 },
    };

    // Import sessions first (observations/summaries reference them)
    if (data.sessions && Array.isArray(data.sessions)) {
      for (const session of data.sessions) {
        try {
          const existing = await this.deps.sessions.findByContentSessionId(session.content_session_id);
          if (existing && shouldSkip) {
            results.sessions.skipped++;
            continue;
          }

          if (!existing) {
            const input: CreateSessionInput = {
              contentSessionId: session.content_session_id,
              memorySessionId: session.memory_session_id,
              project: session.project,
              userPrompt: session.user_prompt,
            };
            await this.deps.sessions.create(input);
            results.sessions.imported++;
          } else {
            results.sessions.skipped++;
          }
        } catch {
          results.sessions.errors++;
        }
      }
    }

    // Import observations
    if (data.observations && Array.isArray(data.observations)) {
      for (const obs of data.observations) {
        try {
          const input: CreateObservationInput = {
            memorySessionId: obs.memory_session_id,
            project: obs.project,
            text: obs.text,
            type: obs.type as CreateObservationInput['type'],
            title: obs.title,
            subtitle: obs.subtitle,
            concepts: obs.concepts,
            facts: obs.facts,
            narrative: obs.narrative,
            filesRead: obs.files_read,
            filesModified: obs.files_modified,
            promptNumber: obs.prompt_number,
            discoveryTokens: obs.discovery_tokens,
            gitBranch: obs.git_branch,
          };
          await this.deps.observations.create(input);
          results.observations.imported++;
        } catch {
          results.observations.errors++;
        }
      }
    }

    // Import summaries
    if (data.summaries && Array.isArray(data.summaries)) {
      for (const summary of data.summaries) {
        try {
          const input: CreateSummaryInput = {
            memorySessionId: summary.memory_session_id,
            project: summary.project,
            request: summary.request,
            investigated: summary.investigated,
            learned: summary.learned,
            completed: summary.completed,
            nextSteps: summary.next_steps,
            promptNumber: summary.prompt_number,
            discoveryTokens: summary.discovery_tokens,
          };
          await this.deps.summaries.create(input);
          results.summaries.imported++;
        } catch {
          results.summaries.errors++;
        }
      }
    }

    this.success(res, {
      importedAt: new Date().toISOString(),
      results,
      totals: {
        imported: results.sessions.imported + results.observations.imported + results.summaries.imported,
        skipped: results.sessions.skipped + results.observations.skipped + results.summaries.skipped,
        errors: results.sessions.errors + results.observations.errors + results.summaries.errors,
      },
    });
  }

  /**
   * POST /api/import/sessions
   * Import sessions only
   */
  private async importSessions(req: Request, res: Response): Promise<void> {
    const { sessions } = req.body as { sessions: ImportData['sessions'] };
    const { skipExisting } = req.query;
    const shouldSkip = skipExisting === 'true';

    if (!sessions || !Array.isArray(sessions)) {
      this.badRequest('sessions array is required');
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const session of sessions!) {
      try {
        const existing = await this.deps.sessions.findByContentSessionId(session.content_session_id);
        if (existing && shouldSkip) {
          skipped++;
          continue;
        }

        if (!existing) {
          const input: CreateSessionInput = {
            contentSessionId: session.content_session_id,
            memorySessionId: session.memory_session_id,
            project: session.project,
            userPrompt: session.user_prompt,
          };
          await this.deps.sessions.create(input);
          imported++;
        } else {
          skipped++;
        }
      } catch {
        errors++;
      }
    }

    this.success(res, { imported, skipped, errors });
  }

  /**
   * POST /api/import/observations
   * Import observations only
   */
  private async importObservations(req: Request, res: Response): Promise<void> {
    const { observations } = req.body as { observations: ImportData['observations'] };

    if (!observations || !Array.isArray(observations)) {
      this.badRequest('observations array is required');
    }

    let imported = 0;
    let errors = 0;

    for (const obs of observations!) {
      try {
        const input: CreateObservationInput = {
          memorySessionId: obs.memory_session_id,
          project: obs.project,
          text: obs.text,
          type: obs.type as CreateObservationInput['type'],
          title: obs.title,
          subtitle: obs.subtitle,
          concepts: obs.concepts,
          facts: obs.facts,
          narrative: obs.narrative,
          filesRead: obs.files_read,
          filesModified: obs.files_modified,
          promptNumber: obs.prompt_number,
          discoveryTokens: obs.discovery_tokens,
          gitBranch: obs.git_branch,
        };
        await this.deps.observations.create(input);
        imported++;
      } catch {
        errors++;
      }
    }

    this.success(res, { imported, errors });
  }

  /**
   * POST /api/import/summaries
   * Import summaries only
   */
  private async importSummaries(req: Request, res: Response): Promise<void> {
    const { summaries } = req.body as { summaries: ImportData['summaries'] };

    if (!summaries || !Array.isArray(summaries)) {
      this.badRequest('summaries array is required');
    }

    let imported = 0;
    let errors = 0;

    for (const summary of summaries!) {
      try {
        const input: CreateSummaryInput = {
          memorySessionId: summary.memory_session_id,
          project: summary.project,
          request: summary.request,
          investigated: summary.investigated,
          learned: summary.learned,
          completed: summary.completed,
          nextSteps: summary.next_steps,
          promptNumber: summary.prompt_number,
          discoveryTokens: summary.discovery_tokens,
        };
        await this.deps.summaries.create(input);
        imported++;
      } catch {
        errors++;
      }
    }

    this.success(res, { imported, errors });
  }
}

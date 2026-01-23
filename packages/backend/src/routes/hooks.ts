/**
 * Hooks Routes
 *
 * API endpoints for Claude Code hooks integration.
 */

import type { Request, Response } from 'express';
import { BaseRouter } from './base-router.js';
import type { SessionService } from '../services/session-service.js';
import type { TaskService } from '../services/task-service.js';

export interface HooksRouterDeps {
  sessionService: SessionService;
  taskService: TaskService;
}

export class HooksRouter extends BaseRouter {
  constructor(private readonly deps: HooksRouterDeps) {
    super();
  }

  protected setupRoutes(): void {
    // Session lifecycle
    this.router.post('/session/start', this.asyncHandler(this.sessionStart.bind(this)));
    this.router.post('/session-init', this.asyncHandler(this.sessionStart.bind(this))); // Alias for hooks client
    this.router.post('/session/end', this.asyncHandler(this.sessionEnd.bind(this)));

    // User prompt submission
    this.router.post('/prompt', this.asyncHandler(this.promptSubmit.bind(this)));

    // Tool use observation
    this.router.post('/observation', this.asyncHandler(this.postToolUse.bind(this)));

    // Context injection
    this.router.get('/context', this.asyncHandler(this.getContext.bind(this)));

    // Summary trigger
    this.router.post('/summarize', this.asyncHandler(this.summarize.bind(this)));
  }

  /**
   * POST /api/hooks/session/start
   * Called at session start
   */
  private async sessionStart(req: Request, res: Response): Promise<void> {
    // Accept both sessionId (new) and contentSessionId (legacy)
    const contentSessionId = req.body.sessionId || req.body.contentSessionId;
    if (!contentSessionId || !req.body.project) {
      this.badRequest('Missing required fields: sessionId, project');
    }

    const { project, userPrompt, prompt, cwd } = req.body;

    const session = await this.deps.sessionService.startSession({
      contentSessionId,
      project,
      userPrompt: userPrompt || prompt,
      workingDirectory: cwd,
    });

    this.success(res, {
      success: true,
      sessionId: session.id,
      memorySessionId: session.memory_session_id,
    });
  }

  /**
   * POST /api/hooks/session/end
   * Called at session end
   */
  private async sessionEnd(req: Request, res: Response): Promise<void> {
    // Accept both sessionId (new) and contentSessionId (legacy)
    const contentSessionId = req.body.sessionId || req.body.contentSessionId;
    if (!contentSessionId) {
      this.badRequest('Missing required field: sessionId');
    }

    await this.deps.sessionService.completeSession(contentSessionId);

    this.success(res, { success: true });
  }

  /**
   * POST /api/hooks/prompt
   * Called on user prompt submission
   */
  private async promptSubmit(req: Request, res: Response): Promise<void> {
    // Accept both sessionId (new) and contentSessionId (legacy)
    const contentSessionId = req.body.sessionId || req.body.contentSessionId;
    if (!contentSessionId || !req.body.promptNumber || !req.body.promptText) {
      this.badRequest('Missing required fields: sessionId, promptNumber, promptText');
    }

    const { promptNumber, promptText } = req.body;

    await this.deps.sessionService.recordPrompt({
      contentSessionId,
      promptNumber,
      promptText,
    });

    this.success(res, { success: true });
  }

  /**
   * POST /api/hooks/observation
   * Called after tool use for observation processing
   */
  private async postToolUse(req: Request, res: Response): Promise<void> {
    // Accept both sessionId (new) and contentSessionId (legacy)
    const contentSessionId = req.body.sessionId || req.body.contentSessionId;
    if (!contentSessionId || !req.body.toolName) {
      this.badRequest('Missing required fields: sessionId, toolName');
    }

    const { toolName, toolInput, toolOutput, promptNumber, gitBranch, cwd, targetDirectory } = req.body;

    const taskId = await this.deps.sessionService.queueObservation({
      contentSessionId,
      toolName,
      toolInput,
      toolOutput,
      promptNumber,
      gitBranch,
      cwd,
      targetDirectory,
    });

    this.success(res, {
      success: true,
      taskId,
    });
  }

  /**
   * GET /api/hooks/context
   * Get context injection for session start
   */
  private async getContext(req: Request, res: Response): Promise<void> {
    const project = req.query.project as string;
    if (!project) {
      this.badRequest('Missing required query parameter: project');
    }

    // Queue context generation task
    const task = await this.deps.taskService.queueContextGenerate({ project });

    // For now, return immediately - context will be generated async
    // In the future, could wait for task completion or use cached context
    this.success(res, {
      taskId: task.id,
      message: 'Context generation queued',
      // TODO: Return cached context if available
    });
  }

  /**
   * POST /api/hooks/summarize
   * Trigger session summarization
   */
  private async summarize(req: Request, res: Response): Promise<void> {
    // Accept both sessionId (new) and contentSessionId (legacy)
    const contentSessionId = req.body.sessionId || req.body.contentSessionId;
    if (!contentSessionId) {
      this.badRequest('Missing required field: sessionId');
    }

    const session = await this.deps.sessionService.getSession(contentSessionId);
    if (!session) {
      this.notFound(`Session not found: ${contentSessionId}`);
    }

    const task = await this.deps.taskService.queueSummarize({
      sessionId: contentSessionId,
      project: session.project,
    });

    this.success(res, {
      success: true,
      taskId: task.id,
    });
  }
}

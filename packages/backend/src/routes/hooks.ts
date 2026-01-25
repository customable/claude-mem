/**
 * Hooks Routes
 *
 * API endpoints for Claude Code hooks integration.
 */

import type { Request, Response } from 'express';
import { BaseRouter } from './base-router.js';
import type { SessionService } from '../services/session-service.js';
import type { TaskService } from '../services/task-service.js';
import type { SSEBroadcaster } from '../services/sse-broadcaster.js';
import type { IClaudeMdRepository, IUserTaskRepository, UserTaskStatus } from '@claude-mem/types';

export interface HooksRouterDeps {
  sessionService: SessionService;
  taskService: TaskService;
  claudemd: IClaudeMdRepository;
  sseBroadcaster: SSEBroadcaster;
  userTasks: IUserTaskRepository;
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

    // Pre-compact hook (Issue #73)
    this.router.post('/pre-compact', this.asyncHandler(this.preCompact.bind(this)));

    // Subagent lifecycle hooks (Issue #232)
    this.router.post('/subagent/start', this.asyncHandler(this.subagentStart.bind(this)));
    this.router.post('/subagent/stop', this.asyncHandler(this.subagentStop.bind(this)));

    // Writer control for git operations (Issue #288)
    this.router.post('/writer/pause', this.asyncHandler(this.writerPause.bind(this)));
    this.router.post('/writer/resume', this.asyncHandler(this.writerResume.bind(this)));

    // User task tracking from CLI tools (Issue #260)
    this.router.post('/user-task/create', this.asyncHandler(this.userTaskCreate.bind(this)));
    this.router.post('/user-task/update', this.asyncHandler(this.userTaskUpdate.bind(this)));

    // Plan mode tracking (Issue #317)
    this.router.post('/plan-mode/enter', this.asyncHandler(this.planModeEnter.bind(this)));
    this.router.post('/plan-mode/exit', this.asyncHandler(this.planModeExit.bind(this)));
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

    const { project, userPrompt, prompt, cwd, repoPath, isWorktree, branch, isUrgent } = req.body;

    const session = await this.deps.sessionService.startSession({
      contentSessionId,
      project,
      userPrompt: userPrompt || prompt,
      workingDirectory: cwd,
      // Git worktree support
      repoPath,
      isWorktree,
      branch,
      // CAPSLOCK/urgent detection (Issue #233)
      isUrgent: isUrgent === true,
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

    // Check for cached context first
    const cached = await this.deps.claudemd.getByProject(project);

    if (cached) {
      // Return cached context immediately
      this.success(res, {
        context: cached.content,
        cached: true,
        cachedAt: cached.generated_at,
      });
      return;
    }

    // No cached context - queue generation task
    const task = await this.deps.taskService.queueContextGenerate({ project });

    this.success(res, {
      taskId: task.id,
      message: 'Context generation queued',
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

  /**
   * POST /api/hooks/pre-compact
   * Called before Claude Code compacts the context (Issue #73)
   * Preserves context by extracting unprocessed observations
   */
  private async preCompact(req: Request, res: Response): Promise<void> {
    // Accept both sessionId (new) and contentSessionId (legacy)
    const contentSessionId = req.body.sessionId || req.body.contentSessionId;
    if (!contentSessionId) {
      this.badRequest('Missing required field: sessionId');
    }

    const session = await this.deps.sessionService.getSession(contentSessionId);
    if (!session) {
      // Session not found - allow compaction (fail-open)
      this.success(res, {
        success: true,
        observationsExtracted: 0,
        blockCompaction: false,
      });
      return;
    }

    // Record pre-compact event in session
    await this.deps.sessionService.recordPreCompact(contentSessionId);

    // Queue CLAUDE.md generation to preserve context before compaction
    if (session.project) {
      await this.deps.taskService.queueClaudeMd({
        project: session.project,
        contentSessionId,
        memorySessionId: session.memory_session_id || contentSessionId,
        workingDirectory: session.working_directory ?? undefined,
      });
    }

    this.success(res, {
      success: true,
      observationsExtracted: 0,
      blockCompaction: false,
    });
  }

  /**
   * POST /api/hooks/subagent/start
   * Called when a subagent (Task tool) starts (Issue #232)
   */
  private async subagentStart(req: Request, res: Response): Promise<void> {
    const contentSessionId = req.body.sessionId || req.body.contentSessionId;
    const { subagentId, subagentType, parentSessionId, cwd } = req.body;

    if (!contentSessionId) {
      this.badRequest('Missing required field: sessionId');
    }

    // Record subagent start in session service
    await this.deps.sessionService.recordSubagentStart({
      contentSessionId,
      subagentId,
      subagentType,
      parentSessionId: parentSessionId || contentSessionId,
      cwd,
    });

    this.success(res, {
      success: true,
      subagentId,
    });
  }

  /**
   * POST /api/hooks/subagent/stop
   * Called when a subagent (Task tool) stops (Issue #232)
   */
  private async subagentStop(req: Request, res: Response): Promise<void> {
    const contentSessionId = req.body.sessionId || req.body.contentSessionId;
    const { subagentId, subagentType } = req.body;

    if (!contentSessionId) {
      this.badRequest('Missing required field: sessionId');
    }

    // Record subagent stop in session service
    await this.deps.sessionService.recordSubagentStop({
      contentSessionId,
      subagentId,
      subagentType,
    });

    this.success(res, {
      success: true,
    });
  }

  /**
   * POST /api/hooks/writer/pause
   * Pause SSE-Writer during git operations (Issue #288)
   */
  private async writerPause(req: Request, res: Response): Promise<void> {
    const contentSessionId = req.body.sessionId || req.body.contentSessionId;
    const { reason } = req.body;

    if (!contentSessionId) {
      this.badRequest('Missing required field: sessionId');
    }

    // Broadcast pause event to all SSE clients (including SSE-Writer)
    this.deps.sseBroadcaster.broadcastWriterPause(contentSessionId, reason || 'git-operation');

    this.success(res, {
      success: true,
      paused: true,
    });
  }

  /**
   * POST /api/hooks/writer/resume
   * Resume SSE-Writer after git operations (Issue #288)
   */
  private async writerResume(req: Request, res: Response): Promise<void> {
    const contentSessionId = req.body.sessionId || req.body.contentSessionId;

    if (!contentSessionId) {
      this.badRequest('Missing required field: sessionId');
    }

    // Broadcast resume event to all SSE clients (including SSE-Writer)
    this.deps.sseBroadcaster.broadcastWriterResume(contentSessionId);

    this.success(res, {
      success: true,
      paused: false,
    });
  }

  /**
   * POST /api/hooks/user-task/create
   * Called when Claude Code TaskCreate tool is used (Issue #260)
   */
  private async userTaskCreate(req: Request, res: Response): Promise<void> {
    const contentSessionId = req.body.sessionId || req.body.contentSessionId;
    const {
      project,
      externalId, // Claude Code's taskId (Issue #316)
      title,
      description,
      activeForm,
      workingDirectory,
      gitBranch,
      sourceMetadata,
    } = req.body;

    if (!project || !title) {
      this.badRequest('Missing required fields: project, title');
    }

    // Create the user task with externalId for linking to Claude Code's task
    const task = await this.deps.userTasks.create({
      externalId, // Link to Claude Code's taskId
      project,
      title,
      description,
      activeForm,
      sessionId: contentSessionId,
      source: 'claude-code',
      sourceMetadata,
      workingDirectory,
      gitBranch,
      status: 'pending',
    });

    // Broadcast task creation event for real-time UI updates
    this.deps.sseBroadcaster.broadcast({
      type: 'user-task:created',
      data: { task, sessionId: contentSessionId },
    });

    this.success(res, {
      success: true,
      taskId: task.id,
      externalId: task.externalId,
    });
  }

  /**
   * POST /api/hooks/user-task/update
   * Called when Claude Code TaskUpdate tool is used (Issue #260)
   */
  private async userTaskUpdate(req: Request, res: Response): Promise<void> {
    const contentSessionId = req.body.sessionId || req.body.contentSessionId;
    const {
      project,
      externalId,
      title,
      description,
      activeForm,
      status,
      owner,
      blockedBy,
      blocks,
      sourceMetadata,
    } = req.body;

    if (!externalId) {
      this.badRequest('Missing required field: externalId');
    }

    // Map Claude Code status to our status type
    const mappedStatus = status as UserTaskStatus | undefined;

    // Update the task by external ID
    const task = await this.deps.userTasks.updateByExternalId(externalId, {
      title,
      description,
      activeForm,
      status: mappedStatus,
      owner,
      blockedBy,
      blocks,
    });

    if (!task) {
      // Task doesn't exist yet - create it
      const newTask = await this.deps.userTasks.create({
        externalId,
        project: project || 'unknown',
        title: title || `Task ${externalId}`,
        description,
        activeForm,
        sessionId: contentSessionId,
        source: 'claude-code',
        sourceMetadata,
        status: mappedStatus || 'pending',
        owner,
        blockedBy,
        blocks,
      });

      this.deps.sseBroadcaster.broadcast({
        type: 'user-task:created',
        data: { task: newTask, sessionId: contentSessionId },
      });

      this.success(res, {
        success: true,
        taskId: newTask.id,
        created: true,
      });
      return;
    }

    // Broadcast task update event for real-time UI updates
    this.deps.sseBroadcaster.broadcast({
      type: 'user-task:updated',
      data: { task, sessionId: contentSessionId },
    });

    this.success(res, {
      success: true,
      taskId: task.id,
      updated: true,
    });
  }

  /**
   * POST /api/hooks/plan-mode/enter
   * Called when Claude Code EnterPlanMode tool is used (Issue #317)
   */
  private async planModeEnter(req: Request, res: Response): Promise<void> {
    const contentSessionId = req.body.sessionId || req.body.contentSessionId;
    const { project } = req.body;

    if (!contentSessionId) {
      this.badRequest('Missing required field: sessionId');
    }

    await this.deps.sessionService.enterPlanMode(contentSessionId);

    // Broadcast event for real-time UI updates
    this.deps.sseBroadcaster.broadcast({
      type: 'session:plan-mode-entered',
      data: { sessionId: contentSessionId, project },
    });

    this.success(res, { success: true });
  }

  /**
   * POST /api/hooks/plan-mode/exit
   * Called when Claude Code ExitPlanMode tool is used (Issue #317)
   */
  private async planModeExit(req: Request, res: Response): Promise<void> {
    const contentSessionId = req.body.sessionId || req.body.contentSessionId;
    const { project, approved, allowedPrompts } = req.body;

    if (!contentSessionId) {
      this.badRequest('Missing required field: sessionId');
    }

    const duration = await this.deps.sessionService.exitPlanMode(contentSessionId);

    // Broadcast event for real-time UI updates
    this.deps.sseBroadcaster.broadcast({
      type: 'session:plan-mode-exited',
      data: { sessionId: contentSessionId, project, approved, duration, allowedPrompts },
    });

    this.success(res, { success: true, duration });
  }
}

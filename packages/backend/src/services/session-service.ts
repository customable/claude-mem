/**
 * Session Service
 *
 * Business logic for session management.
 */

import { createLogger } from '@claude-mem/shared';
import type {
  ISessionRepository,
  IObservationRepository,
  ISummaryRepository,
  IUserPromptRepository,
  SdkSessionRecord,
  ObservationRecord,
  SessionSummaryRecord,
} from '@claude-mem/types';
import type { SSEBroadcaster } from './sse-broadcaster.js';
import type { TaskService } from './task-service.js';

const logger = createLogger('session-service');

/**
 * Check if a prompt is a real user prompt (not system-generated)
 */
function isRealUserPrompt(prompt: string | undefined): boolean {
  if (!prompt || prompt.trim().length === 0) return false;

  const trimmed = prompt.trim();

  // Filter out task-notifications (background task completions)
  if (trimmed.startsWith('<task-notification>')) return false;

  // Filter out prompts that are ONLY task-notifications
  return !(trimmed.includes('<task-notification>') && !trimmed.replace(/<task-notification>[\s\S]*?<\/task-notification>/g, '').trim());
}

/**
 * Extract real user content from prompt (strip system tags)
 */
function extractUserContent(prompt: string): string {
  // Remove task-notification blocks
  return prompt.replace(/<task-notification>[\s\S]*?<\/task-notification>\s*/g, '').trim();
}

export class SessionService {
  constructor(
    private readonly sessions: ISessionRepository,
    private readonly observations: IObservationRepository,
    private readonly summaries: ISummaryRepository,
    private readonly userPrompts: IUserPromptRepository,
    private readonly sseBroadcaster: SSEBroadcaster,
    private readonly taskService: TaskService
  ) {}

  /**
   * Start or resume a session
   */
  async startSession(params: {
    contentSessionId: string;
    project: string;
    userPrompt?: string;
    workingDirectory?: string;
    // Git worktree support
    repoPath?: string;
    isWorktree?: boolean;
    branch?: string;
    // CAPSLOCK/urgent detection (Issue #233)
    isUrgent?: boolean;
  }): Promise<SdkSessionRecord> {
    // Check for existing session
    let session = await this.sessions.findByContentSessionId(params.contentSessionId);

    // Only count as a real prompt if there's actual user content (not system messages)
    const hasRealPrompt = isRealUserPrompt(params.userPrompt);
    const cleanedPrompt = hasRealPrompt ? extractUserContent(params.userPrompt!) : undefined;

    if (session) {
      // Resume existing session - only increment counter if there's a real prompt
      if (hasRealPrompt) {
        const newCounter = (session.prompt_counter ?? 0) + 1;
        const wasCompleted = session.status === 'completed';

        await this.sessions.update(session.id, {
          promptCounter: newCounter,
          // Reactivate completed sessions
          ...(wasCompleted && { status: 'active' }),
        });
        session = {
          ...session,
          prompt_counter: newCounter,
          ...(wasCompleted && { status: 'active' }),
        };

        // Record the prompt (cleaned of system tags)
        await this.userPrompts.create({
          contentSessionId: params.contentSessionId,
          promptNumber: newCounter,
          promptText: cleanedPrompt!,
          isUrgent: params.isUrgent,
        });

        this.sseBroadcaster.broadcastNewPrompt(
          params.contentSessionId,
          newCounter
        );

        // Note: CLAUDE.md generation is now triggered by observation count in task-dispatcher

        if (wasCompleted) {
          this.sseBroadcaster.broadcastSessionStarted(params.contentSessionId, params.project);
          logger.info(`Reactivated completed session ${session.id} for ${params.project} (prompt ${newCounter})`);
        } else {
          logger.info(`Resuming session ${session.id} for ${params.project} (prompt ${newCounter})`);
        }
      } else {
        logger.debug(`Session ${session.id} touched without prompt`);
      }
      return session;
    }

    // Create new session - use contentSessionId as memorySessionId if not provided
    session = await this.sessions.create({
      contentSessionId: params.contentSessionId,
      memorySessionId: params.contentSessionId,
      project: params.project,
      userPrompt: cleanedPrompt,
      workingDirectory: params.workingDirectory,
      // Git worktree support
      repoPath: params.repoPath,
      isWorktree: params.isWorktree,
      branch: params.branch,
    });

    // Only set prompt counter to 1 if there's a real prompt, otherwise 0
    const initialCounter = hasRealPrompt ? 1 : 0;
    await this.sessions.update(session.id, { promptCounter: initialCounter });
    session = { ...session, prompt_counter: initialCounter };

    // Record the initial prompt if provided (cleaned of system tags)
    if (hasRealPrompt) {
      await this.userPrompts.create({
        contentSessionId: params.contentSessionId,
        promptNumber: 1,
        promptText: cleanedPrompt!,
        isUrgent: params.isUrgent,
      });
    }

    this.sseBroadcaster.broadcastSessionStarted(
      params.contentSessionId,
      params.project
    );

    logger.info(`Created new session ${session.id} for ${params.project}${hasRealPrompt ? ' (prompt 1)' : ' (no prompt yet)'}`);
    return session;
  }

  /**
   * Record a user prompt
   */
  async recordPrompt(params: {
    contentSessionId: string;
    promptNumber: number;
    promptText: string;
  }): Promise<void> {
    // Skip system-generated prompts
    if (!isRealUserPrompt(params.promptText)) {
      logger.debug(`Skipping system prompt ${params.promptNumber} for session ${params.contentSessionId}`);
      return;
    }

    const cleanedText = extractUserContent(params.promptText);
    await this.userPrompts.create({
      contentSessionId: params.contentSessionId,
      promptNumber: params.promptNumber,
      promptText: cleanedText,
    });

    // Update session prompt counter
    const session = await this.sessions.findByContentSessionId(params.contentSessionId);
    if (session) {
      await this.sessions.update(session.id, {
        promptCounter: params.promptNumber,
      });
    }

    this.sseBroadcaster.broadcastNewPrompt(
      params.contentSessionId,
      params.promptNumber
    );

    logger.debug(`Recorded prompt ${params.promptNumber} for session ${params.contentSessionId}`);
  }

  /**
   * Queue observation processing for a tool use
   */
  async queueObservation(params: {
    contentSessionId: string;
    toolName: string;
    toolInput: string;
    toolOutput: string;
    promptNumber?: number;
    gitBranch?: string;
    cwd?: string;
    targetDirectory?: string;
  }): Promise<string> {
    const session = await this.sessions.findByContentSessionId(params.contentSessionId);
    if (!session) {
      throw new Error(`Session not found: ${params.contentSessionId}`);
    }

    const task = await this.taskService.queueObservation({
      sessionId: params.contentSessionId,
      project: session.project,
      toolName: params.toolName,
      toolInput: params.toolInput,
      toolOutput: params.toolOutput,
      promptNumber: params.promptNumber,
      gitBranch: params.gitBranch,
      cwd: params.cwd,
      targetDirectory: params.targetDirectory,
    });

    return task.id;
  }

  /**
   * Complete a session and queue summarization
   */
  async completeSession(contentSessionId: string): Promise<void> {
    const session = await this.sessions.findByContentSessionId(contentSessionId);
    if (!session) {
      logger.warn(`Session not found for completion: ${contentSessionId}`);
      return;
    }

    // Update session status
    await this.sessions.update(session.id, {
      status: 'completed',
      completedAt: Date.now(),
    });

    // Queue summarization
    await this.taskService.queueSummarize({
      sessionId: contentSessionId,
      project: session.project,
    });

    this.sseBroadcaster.broadcastSessionCompleted(contentSessionId);
    logger.info(`Session ${session.id} completed, summarization queued`);
  }

  /**
   * Get session by content session ID
   */
  async getSession(contentSessionId: string): Promise<SdkSessionRecord | null> {
    return this.sessions.findByContentSessionId(contentSessionId);
  }

  /**
   * Get active session for project
   */
  async getActiveSession(project: string): Promise<SdkSessionRecord | null> {
    return this.sessions.getActiveSession(project);
  }

  /**
   * Get observations for a session
   */
  async getSessionObservations(
    memorySessionId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ObservationRecord[]> {
    return this.observations.getBySessionId(memorySessionId, options);
  }

  /**
   * Get summaries for a session
   */
  async getSessionSummaries(memorySessionId: string): Promise<SessionSummaryRecord[]> {
    return this.summaries.getBySessionId(memorySessionId);
  }

  /**
   * List recent sessions
   */
  async listSessions(options: {
    project?: string;
    status?: string | string[];
    limit?: number;
    offset?: number;
  }): Promise<SdkSessionRecord[]> {
    return this.sessions.list(
      {
        project: options.project,
        status: options.status as 'active' | 'completed' | ('active' | 'completed')[],
      },
      {
        limit: options.limit ?? 50,
        offset: options.offset,
      }
    );
  }

  /**
   * Get session count
   */
  async getSessionCount(options?: {
    project?: string;
    status?: string | string[];
  }): Promise<number> {
    return this.sessions.count({
      project: options?.project,
      status: options?.status as 'active' | 'completed' | ('active' | 'completed')[],
    });
  }

  /**
   * Delete a session and all related data
   */
  async deleteSession(contentSessionId: string): Promise<boolean> {
    const session = await this.sessions.findByContentSessionId(contentSessionId);
    if (!session) return false;

    // Delete related data
    if (session.memory_session_id) {
      await this.observations.deleteBySessionId(session.memory_session_id);
    }

    return this.sessions.delete(session.id);
  }

  /**
   * Record a pre-compact event (Issue #73)
   * Called before Claude Code compacts the context
   */
  async recordPreCompact(contentSessionId: string): Promise<void> {
    const session = await this.sessions.findByContentSessionId(contentSessionId);
    if (!session) {
      logger.warn(`Session not found for pre-compact: ${contentSessionId}`);
      return;
    }

    // Broadcast pre-compact event for monitoring/debugging
    this.sseBroadcaster.broadcastPreCompact(contentSessionId, session.project);

    logger.info(`Pre-compact event recorded for session ${session.id} (${session.project})`);
  }

  /**
   * Record a subagent start event (Issue #232)
   * Called when a Task tool subagent starts
   */
  async recordSubagentStart(params: {
    contentSessionId: string;
    subagentId?: string;
    subagentType?: string;
    parentSessionId?: string;
    cwd?: string;
  }): Promise<void> {
    const session = await this.sessions.findByContentSessionId(params.contentSessionId);
    if (!session) {
      logger.warn(`Session not found for subagent start: ${params.contentSessionId}`);
      return;
    }

    // Broadcast subagent start event for monitoring/debugging
    this.sseBroadcaster.broadcast({
      type: 'subagent:start',
      data: {
        sessionId: params.contentSessionId,
        subagentId: params.subagentId,
        subagentType: params.subagentType,
        parentSessionId: params.parentSessionId,
        cwd: params.cwd,
      },
    });

    logger.info(`Subagent started: ${params.subagentId} (type: ${params.subagentType}) in session ${session.id}`);
  }

  /**
   * Record a subagent stop event (Issue #232)
   * Called when a Task tool subagent stops
   */
  async recordSubagentStop(params: {
    contentSessionId: string;
    subagentId?: string;
    subagentType?: string;
  }): Promise<void> {
    const session = await this.sessions.findByContentSessionId(params.contentSessionId);
    if (!session) {
      logger.warn(`Session not found for subagent stop: ${params.contentSessionId}`);
      return;
    }

    // Broadcast subagent stop event for monitoring/debugging
    this.sseBroadcaster.broadcast({
      type: 'subagent:stop',
      data: {
        sessionId: params.contentSessionId,
        subagentId: params.subagentId,
        subagentType: params.subagentType,
      },
    });

    logger.info(`Subagent stopped: ${params.subagentId} (type: ${params.subagentType}) in session ${session.id}`);
  }

  /**
   * Enter plan mode for a session (Issue #317)
   * Called when EnterPlanMode tool is used
   */
  async enterPlanMode(contentSessionId: string): Promise<void> {
    const session = await this.sessions.findByContentSessionId(contentSessionId);
    if (!session) {
      logger.warn(`Session not found for plan mode enter: ${contentSessionId}`);
      return;
    }

    // Update session with plan mode state
    const now = Date.now();
    await this.sessions.update(session.id, {
      isInPlanMode: true,
      planModeEnteredAt: now,
      planModeCount: (session.plan_mode_count ?? 0) + 1,
    });

    logger.info(`Session ${session.id} entered plan mode (count: ${(session.plan_mode_count ?? 0) + 1})`);
  }

  /**
   * Exit plan mode for a session (Issue #317)
   * Called when ExitPlanMode tool is used
   * Returns the duration in plan mode (ms)
   */
  async exitPlanMode(contentSessionId: string): Promise<number> {
    const session = await this.sessions.findByContentSessionId(contentSessionId);
    if (!session) {
      logger.warn(`Session not found for plan mode exit: ${contentSessionId}`);
      return 0;
    }

    // Calculate duration
    const now = Date.now();
    const enteredAt = session.plan_mode_entered_at ?? now;
    const duration = now - enteredAt;

    // Update session - exit plan mode
    await this.sessions.update(session.id, {
      isInPlanMode: false,
      planModeEnteredAt: undefined,
    });

    logger.info(`Session ${session.id} exited plan mode after ${duration}ms`);
    return duration;
  }
}

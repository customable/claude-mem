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
  }): Promise<SdkSessionRecord> {
    // Check for existing session
    let session = await this.sessions.findByContentSessionId(params.contentSessionId);

    if (session) {
      // Resume existing session - increment prompt counter
      const newCounter = (session.prompt_counter ?? 0) + 1;
      await this.sessions.update(session.id, {
        promptCounter: newCounter,
      });
      session = { ...session, prompt_counter: newCounter };

      // Record the prompt if provided
      if (params.userPrompt) {
        await this.userPrompts.create({
          contentSessionId: params.contentSessionId,
          promptNumber: newCounter,
          promptText: params.userPrompt,
        });
      }

      this.sseBroadcaster.broadcastNewPrompt(
        params.contentSessionId,
        newCounter
      );

      logger.info(`Resuming session ${session.id} for ${params.project} (prompt ${newCounter})`);
      return session;
    }

    // Create new session - use contentSessionId as memorySessionId if not provided
    session = await this.sessions.create({
      contentSessionId: params.contentSessionId,
      memorySessionId: params.contentSessionId,
      project: params.project,
      userPrompt: params.userPrompt,
    });

    // Set initial prompt counter to 1 (this is the first prompt)
    await this.sessions.update(session.id, { promptCounter: 1 });
    session = { ...session, prompt_counter: 1 };

    // Record the initial prompt if provided
    if (params.userPrompt) {
      await this.userPrompts.create({
        contentSessionId: params.contentSessionId,
        promptNumber: 1,
        promptText: params.userPrompt,
      });
    }

    this.sseBroadcaster.broadcastSessionStarted(
      params.contentSessionId,
      params.project
    );

    logger.info(`Created new session ${session.id} for ${params.project}`);
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
    await this.userPrompts.create({
      contentSessionId: params.contentSessionId,
      promptNumber: params.promptNumber,
      promptText: params.promptText,
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
}

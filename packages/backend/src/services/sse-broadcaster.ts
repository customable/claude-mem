/**
 * SSE Broadcaster
 *
 * Manages Server-Sent Events connections for real-time UI updates.
 */

import type { Response } from 'express';
import { createLogger } from '@claude-mem/shared';

const logger = createLogger('sse');

/**
 * SSE Event types
 */
export type SSEEventType =
  | 'connected'
  | 'prompt:new'
  | 'session:started'
  | 'session:ended'
  | 'session:pre-compact'
  | 'subagent:start'
  | 'subagent:stop'
  | 'observation:created'
  | 'observation:queued'
  | 'summary:created'
  | 'worker:connected'
  | 'worker:disconnected'
  | 'worker:spawned'
  | 'worker:exited'
  | 'task:queued'
  | 'task:assigned'
  | 'task:completed'
  | 'task:failed'
  | 'task:progress'
  | 'claudemd:ready'
  | 'writer:pause'
  | 'writer:resume';

/**
 * SSE Event payload
 */
export interface SSEEvent {
  type: SSEEventType;
  data?: unknown;
  timestamp?: number;
}

/**
 * SSE Client
 */
interface SSEClient {
  id: string;
  res: Response;
  connectedAt: number;
}

/**
 * SSE Broadcaster Service
 */
export class SSEBroadcaster {
  private clients: Map<string, SSEClient> = new Map();
  private clientCounter = 0;

  /**
   * Add a new SSE client
   */
  addClient(res: Response): string {
    const clientId = `sse-${++this.clientCounter}-${Date.now()}`;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    const client: SSEClient = {
      id: clientId,
      res,
      connectedAt: Date.now(),
    };

    this.clients.set(clientId, client);

    // Handle client disconnect
    res.on('close', () => {
      this.removeClient(clientId);
    });

    // Send initial connection event
    this.sendToClient(clientId, {
      type: 'connected',
      data: { clientId },
    });

    logger.debug(`SSE client connected: ${clientId} (total: ${this.clients.size})`);
    return clientId;
  }

  /**
   * Remove a client
   */
  removeClient(clientId: string): void {
    if (this.clients.delete(clientId)) {
      logger.debug(`SSE client disconnected: ${clientId} (total: ${this.clients.size})`);
    }
  }

  /**
   * Broadcast event to all clients
   */
  broadcast(event: SSEEvent): void {
    const eventWithTimestamp: SSEEvent = {
      ...event,
      timestamp: event.timestamp ?? Date.now(),
    };

    // SSE format - send as generic message (no event: header) so onmessage receives it
    const sseMessage = `data: ${JSON.stringify(eventWithTimestamp)}\n\n`;

    for (const [clientId, client] of this.clients) {
      try {
        if (!client.res.writableEnded) {
          client.res.write(sseMessage);
        } else {
          // Client connection closed
          this.clients.delete(clientId);
        }
      } catch {
        // Remove failed client
        this.clients.delete(clientId);
      }
    }
  }

  /**
   * Send event to specific client
   */
  sendToClient(clientId: string, event: SSEEvent): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    const eventWithTimestamp: SSEEvent = {
      ...event,
      timestamp: event.timestamp ?? Date.now(),
    };

    try {
      if (!client.res.writableEnded) {
        const sseMessage = `data: ${JSON.stringify(eventWithTimestamp)}\n\n`;
        client.res.write(sseMessage);
        return true;
      }
    } catch {
      this.clients.delete(clientId);
    }

    return false;
  }

  /**
   * Broadcast new prompt received
   */
  broadcastNewPrompt(sessionId: string, promptNumber: number): void {
    this.broadcast({
      type: 'prompt:new',
      data: { sessionId, promptNumber },
    });
  }

  /**
   * Broadcast session started
   */
  broadcastSessionStarted(sessionId: string, project: string): void {
    this.broadcast({
      type: 'session:started',
      data: { sessionId, project },
    });
  }

  /**
   * Broadcast session completed
   */
  broadcastSessionCompleted(sessionId: string): void {
    this.broadcast({
      type: 'session:ended',
      data: { sessionId },
    });
  }

  /**
   * Broadcast observation created
   */
  broadcastObservationCreated(observationId: number, sessionId: string): void {
    this.broadcast({
      type: 'observation:created',
      data: { observationId, sessionId },
    });
  }

  /**
   * Broadcast worker connected
   */
  broadcastWorkerConnected(workerId: string, capabilities: string[]): void {
    this.broadcast({
      type: 'worker:connected',
      data: { workerId, capabilities },
    });
  }

  /**
   * Broadcast worker disconnected
   */
  broadcastWorkerDisconnected(workerId: string): void {
    this.broadcast({
      type: 'worker:disconnected',
      data: { workerId },
    });
  }

  /**
   * Broadcast task queued
   */
  broadcastTaskQueued(taskId: string, taskType: string): void {
    this.broadcast({
      type: 'task:queued',
      data: { taskId, taskType },
    });
  }

  /**
   * Broadcast task assigned to worker
   */
  broadcastTaskAssigned(taskId: string, workerId: string, taskType: string): void {
    this.broadcast({
      type: 'task:assigned',
      data: { taskId, workerId, taskType },
    });
  }

  /**
   * Broadcast task completed
   */
  broadcastTaskCompleted(taskId: string): void {
    this.broadcast({
      type: 'task:completed',
      data: { taskId },
    });
  }

  /**
   * Broadcast task progress
   */
  broadcastTaskProgress(taskId: string, workerId: string, progress: number, message?: string): void {
    this.broadcast({
      type: 'task:progress',
      data: { taskId, workerId, progress, message },
    });
  }

  /**
   * Broadcast CLAUDE.md ready for writing
   */
  broadcastClaudeMdReady(data: {
    project: string;
    contentSessionId: string;
    workingDirectory: string;
    content: string;
  }): void {
    this.broadcast({
      type: 'claudemd:ready',
      data,
    });
  }

  /**
   * Broadcast pre-compact event (Issue #73)
   */
  broadcastPreCompact(sessionId: string, project: string): void {
    this.broadcast({
      type: 'session:pre-compact',
      data: { sessionId, project },
    });
  }

  /**
   * Broadcast writer pause event (Issue #288)
   * Tells SSE-Writer to pause writing CLAUDE.md during git operations
   */
  broadcastWriterPause(sessionId: string, reason: string): void {
    this.broadcast({
      type: 'writer:pause',
      data: { sessionId, reason },
    });
    logger.debug(`Writer pause broadcast for session ${sessionId}: ${reason}`);
  }

  /**
   * Broadcast writer resume event (Issue #288)
   * Tells SSE-Writer to resume writing CLAUDE.md after git operations
   */
  broadcastWriterResume(sessionId: string): void {
    this.broadcast({
      type: 'writer:resume',
      data: { sessionId },
    });
    logger.debug(`Writer resume broadcast for session ${sessionId}`);
  }

  /**
   * Close all client connections
   */
  closeAll(): void {
    for (const client of this.clients.values()) {
      try {
        client.res.end();
      } catch {
        // Ignore errors during shutdown
      }
    }
    this.clients.clear();
    logger.info('All SSE clients disconnected');
  }
}

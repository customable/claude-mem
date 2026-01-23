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
  | 'processing_status'
  | 'new_prompt'
  | 'session_started'
  | 'session_completed'
  | 'observation_created'
  | 'observation_queued'
  | 'summary_created'
  | 'worker_connected'
  | 'worker_disconnected'
  | 'task_queued'
  | 'task_completed'
  | 'task_failed';

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

    const data = `data: ${JSON.stringify(eventWithTimestamp)}\n\n`;

    for (const [clientId, client] of this.clients) {
      try {
        if (!client.res.writableEnded) {
          client.res.write(data);
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
        client.res.write(`data: ${JSON.stringify(eventWithTimestamp)}\n\n`);
        return true;
      }
    } catch {
      this.clients.delete(clientId);
    }

    return false;
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Check if any clients are connected
   */
  hasClients(): boolean {
    return this.clients.size > 0;
  }

  /**
   * Broadcast processing status
   */
  broadcastProcessingStatus(status: {
    pendingTasks: number;
    activeSessions: number;
    connectedWorkers: number;
  }): void {
    this.broadcast({
      type: 'processing_status',
      data: status,
    });
  }

  /**
   * Broadcast new prompt received
   */
  broadcastNewPrompt(sessionId: string, promptNumber: number): void {
    this.broadcast({
      type: 'new_prompt',
      data: { sessionId, promptNumber },
    });
  }

  /**
   * Broadcast session started
   */
  broadcastSessionStarted(sessionId: string, project: string): void {
    this.broadcast({
      type: 'session_started',
      data: { sessionId, project },
    });
  }

  /**
   * Broadcast session completed
   */
  broadcastSessionCompleted(sessionId: string): void {
    this.broadcast({
      type: 'session_completed',
      data: { sessionId },
    });
  }

  /**
   * Broadcast observation created
   */
  broadcastObservationCreated(observationId: number, sessionId: string): void {
    this.broadcast({
      type: 'observation_created',
      data: { observationId, sessionId },
    });
  }

  /**
   * Broadcast worker connected
   */
  broadcastWorkerConnected(workerId: string, capabilities: string[]): void {
    this.broadcast({
      type: 'worker_connected',
      data: { workerId, capabilities },
    });
  }

  /**
   * Broadcast worker disconnected
   */
  broadcastWorkerDisconnected(workerId: string): void {
    this.broadcast({
      type: 'worker_disconnected',
      data: { workerId },
    });
  }

  /**
   * Broadcast task queued
   */
  broadcastTaskQueued(taskId: string, taskType: string): void {
    this.broadcast({
      type: 'task_queued',
      data: { taskId, taskType },
    });
  }

  /**
   * Broadcast task completed
   */
  broadcastTaskCompleted(taskId: string): void {
    this.broadcast({
      type: 'task_completed',
      data: { taskId },
    });
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

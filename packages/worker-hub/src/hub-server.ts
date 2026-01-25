/**
 * Hub Server (Issue #263)
 *
 * Standalone WebSocket server for worker connections.
 * Mirrors the backend's WorkerHub but runs independently.
 */

import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { createLogger } from '@claude-mem/shared';
import type {
  WorkerCapability,
  WorkerToBackendMessage,
  BackendToWorkerMessage,
} from '@claude-mem/types';

const logger = createLogger('hub-server');

// Connected worker information
export interface ConnectedWorker {
  id: string;
  ws: WebSocket;
  capabilities: WorkerCapability[];
  metadata: Record<string, unknown>;
  connectedAt: Date;
  lastHeartbeat: Date;
  currentTaskId: string | null;
  authenticated: boolean;
}

// Task assignment info
export interface TaskInfo {
  id: string;
  type: string;
  payload: unknown;
  capability: WorkerCapability;
  assignedAt: Date;
}

export interface HubServerOptions {
  /** Authentication token for workers */
  authToken?: string;
  /** Heartbeat check interval (ms) */
  heartbeatIntervalMs?: number;
  /** Max missed heartbeats before disconnect */
  maxMissedHeartbeats?: number;
}

export interface HubServerEvents {
  onWorkerConnected?: (worker: ConnectedWorker) => void;
  onWorkerDisconnected?: (workerId: string) => void;
  onTaskComplete?: (workerId: string, taskId: string, result: unknown, processingTimeMs: number) => void;
  onTaskError?: (workerId: string, taskId: string, error: string, retryable: boolean) => void;
  onTaskProgress?: (workerId: string, taskId: string, progress: number, message?: string) => void;
}

/**
 * Standalone hub server for worker connections
 */
export class HubServer {
  private wss: WebSocketServer | null = null;
  private workers: Map<string, ConnectedWorker> = new Map();
  private pendingAuth: Map<WebSocket, { timeout: NodeJS.Timeout }> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  private readonly authToken: string;
  private readonly heartbeatIntervalMs: number;
  private readonly maxMissedHeartbeats: number;

  private events: HubServerEvents = {};

  constructor(options: HubServerOptions = {}) {
    this.authToken = options.authToken || '';
    this.heartbeatIntervalMs = options.heartbeatIntervalMs || 30000;
    this.maxMissedHeartbeats = options.maxMissedHeartbeats || 3;
  }

  /**
   * Set event handlers
   */
  on(events: HubServerEvents): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * Attach to an HTTP server
   */
  attach(server: Server, path = '/ws'): void {
    this.wss = new WebSocketServer({ server, path });

    this.wss.on('connection', (ws) => {
      this.handleConnection(ws);
    });

    this.startHeartbeatCheck();
    logger.info(`Hub server attached at ${path}`);
  }

  /**
   * Create standalone server
   */
  listen(port: number, host = '0.0.0.0'): void {
    this.wss = new WebSocketServer({ port, host });

    this.wss.on('connection', (ws) => {
      this.handleConnection(ws);
    });

    this.startHeartbeatCheck();
    logger.info(`Hub server listening on ${host}:${port}`);
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    logger.debug('New WebSocket connection');

    // Set up auth timeout
    const authTimeout = setTimeout(() => {
      logger.warn('Auth timeout, closing connection');
      this.pendingAuth.delete(ws);
      ws.close(4001, 'Authentication timeout');
    }, 10000);

    this.pendingAuth.set(ws, { timeout: authTimeout });

    // Send pending message if auth required
    if (this.authToken) {
      this.sendToSocket(ws, { type: 'connection:pending' });
    }

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as WorkerToBackendMessage;
        this.handleMessage(ws, message);
      } catch (error) {
        const err = error as Error;
        logger.error('Failed to parse message:', { message: err.message });
      }
    });

    ws.on('close', () => {
      this.handleClose(ws);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', { message: error.message });
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(ws: WebSocket, message: WorkerToBackendMessage): void {
    switch (message.type) {
      case 'auth':
        this.handleAuth(ws, message.token);
        break;

      case 'register':
        this.handleRegister(ws, message.capabilities, message.metadata);
        break;

      case 'heartbeat':
        this.handleHeartbeat(message.workerId);
        break;

      case 'task:complete':
        this.handleTaskComplete(message.workerId, message.taskId, message.result, message.processingTimeMs);
        break;

      case 'task:error':
        this.handleTaskError(message.workerId, message.taskId, message.error, message.retryable);
        break;

      case 'task:progress':
        this.handleTaskProgress(message.workerId, message.taskId, message.progress, message.message);
        break;

      case 'shutdown':
        this.handleWorkerShutdown(message.workerId, message.reason);
        break;

      default:
        logger.debug(`Unknown message type: ${(message as { type: string }).type}`);
    }
  }

  /**
   * Handle authentication
   */
  private handleAuth(ws: WebSocket, token?: string): void {
    const pending = this.pendingAuth.get(ws);
    if (!pending) {
      ws.close(4002, 'Unexpected auth message');
      return;
    }

    if (this.authToken && token !== this.authToken) {
      logger.warn('Invalid auth token');
      this.sendToSocket(ws, { type: 'auth:failed', reason: 'Invalid token' });
      clearTimeout(pending.timeout);
      this.pendingAuth.delete(ws);
      ws.close(4003, 'Invalid token');
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingAuth.delete(ws);
    this.sendToSocket(ws, { type: 'auth:success' });
    logger.debug('Auth successful');
  }

  /**
   * Handle worker registration
   */
  private handleRegister(
    ws: WebSocket,
    capabilities: WorkerCapability[],
    metadata?: Record<string, unknown>
  ): void {
    // Allow registration without auth if no token configured
    if (this.authToken && this.pendingAuth.has(ws)) {
      logger.warn('Registration without auth');
      ws.close(4004, 'Authentication required');
      return;
    }

    // Clean up pending auth if present
    const pending = this.pendingAuth.get(ws);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingAuth.delete(ws);
    }

    const workerId = randomUUID();
    const worker: ConnectedWorker = {
      id: workerId,
      ws,
      capabilities,
      metadata: metadata || {},
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      currentTaskId: null,
      authenticated: true,
    };

    this.workers.set(workerId, worker);

    this.sendToSocket(ws, { type: 'registered', workerId });
    logger.info(`Worker ${workerId} registered with capabilities: ${capabilities.join(', ')}`);

    this.events.onWorkerConnected?.(worker);
  }

  /**
   * Handle heartbeat
   */
  private handleHeartbeat(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.lastHeartbeat = new Date();
      this.sendToSocket(worker.ws, { type: 'heartbeat:ack' });
    }
  }

  /**
   * Handle task completion
   */
  private handleTaskComplete(
    workerId: string,
    taskId: string,
    result: unknown,
    processingTimeMs: number
  ): void {
    const worker = this.workers.get(workerId);
    if (worker && worker.currentTaskId === taskId) {
      worker.currentTaskId = null;
    }

    logger.debug(`Task ${taskId} completed by worker ${workerId}`);
    this.events.onTaskComplete?.(workerId, taskId, result, processingTimeMs);
  }

  /**
   * Handle task error
   */
  private handleTaskError(
    workerId: string,
    taskId: string,
    error: string,
    retryable: boolean
  ): void {
    const worker = this.workers.get(workerId);
    if (worker && worker.currentTaskId === taskId) {
      worker.currentTaskId = null;
    }

    logger.debug(`Task ${taskId} failed on worker ${workerId}: ${error}`);
    this.events.onTaskError?.(workerId, taskId, error, retryable);
  }

  /**
   * Handle task progress
   */
  private handleTaskProgress(
    workerId: string,
    taskId: string,
    progress: number,
    message?: string
  ): void {
    this.events.onTaskProgress?.(workerId, taskId, progress, message);
  }

  /**
   * Handle worker shutdown request
   */
  private handleWorkerShutdown(workerId: string, reason?: string): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      logger.info(`Worker ${workerId} shutting down: ${reason || 'No reason'}`);
      worker.ws.close(1000, 'Worker shutdown');
      this.workers.delete(workerId);
      this.events.onWorkerDisconnected?.(workerId);
    }
  }

  /**
   * Handle WebSocket close
   */
  private handleClose(ws: WebSocket): void {
    // Clean up pending auth
    const pending = this.pendingAuth.get(ws);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingAuth.delete(ws);
    }

    // Find and remove worker
    for (const [workerId, worker] of this.workers) {
      if (worker.ws === ws) {
        logger.info(`Worker ${workerId} disconnected`);
        this.workers.delete(workerId);
        this.events.onWorkerDisconnected?.(workerId);
        break;
      }
    }
  }

  /**
   * Start heartbeat check interval
   */
  private startHeartbeatCheck(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const maxAge = this.heartbeatIntervalMs * this.maxMissedHeartbeats;

      for (const [workerId, worker] of this.workers) {
        const age = now - worker.lastHeartbeat.getTime();
        if (age > maxAge) {
          logger.warn(`Worker ${workerId} heartbeat timeout`);
          worker.ws.close(4005, 'Heartbeat timeout');
          this.workers.delete(workerId);
          this.events.onWorkerDisconnected?.(workerId);
        }
      }
    }, this.heartbeatIntervalMs);
  }

  /**
   * Assign a task to a specific worker
   */
  assignTask(
    workerId: string,
    taskId: string,
    taskType: string,
    payload: unknown,
    capability: WorkerCapability
  ): boolean {
    const worker = this.workers.get(workerId);
    if (!worker || worker.currentTaskId) {
      return false;
    }

    worker.currentTaskId = taskId;

    this.sendToSocket(worker.ws, {
      type: 'task:assign',
      task: {
        id: taskId,
        type: taskType,
        payload,
      },
      capability,
    });

    return true;
  }

  /**
   * Find an available worker with the specified capability
   */
  findAvailableWorker(capability: WorkerCapability): ConnectedWorker | null {
    for (const worker of this.workers.values()) {
      if (!worker.currentTaskId && worker.capabilities.includes(capability)) {
        return worker;
      }
    }
    return null;
  }

  /**
   * Get all connected workers
   */
  getWorkers(): ConnectedWorker[] {
    return Array.from(this.workers.values());
  }

  /**
   * Get worker count
   */
  getWorkerCount(): number {
    return this.workers.size;
  }

  /**
   * Get active (busy) worker count
   */
  getActiveWorkerCount(): number {
    let count = 0;
    for (const worker of this.workers.values()) {
      if (worker.currentTaskId) count++;
    }
    return count;
  }

  /**
   * Check if hub has workers
   */
  hasWorkers(): boolean {
    return this.workers.size > 0;
  }

  /**
   * Broadcast message to all workers
   */
  broadcast(message: Record<string, unknown>): void {
    for (const worker of this.workers.values()) {
      this.sendToSocket(worker.ws, message);
    }
  }

  /**
   * Send message to socket
   */
  private sendToSocket(ws: WebSocket, message: BackendToWorkerMessage | Record<string, unknown>): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Shutdown the hub server
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down hub server...');

    // Stop heartbeat check
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Notify and disconnect all workers
    for (const worker of this.workers.values()) {
      this.sendToSocket(worker.ws, { type: 'server:shutdown' });
      worker.ws.close(1001, 'Server shutdown');
    }
    this.workers.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    logger.info('Hub server shutdown complete');
  }
}

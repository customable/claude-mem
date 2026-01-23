/**
 * Worker Hub
 *
 * Manages WebSocket connections from workers.
 * Handles authentication, heartbeats, and connection lifecycle.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { createLogger } from '@claude-mem/shared';
import type {
  WorkerCapability,
  WorkerToBackendMessage,
  BackendToWorkerMessage,
} from '@claude-mem/types';
import type { ConnectedWorker, WorkerStats } from './types.js';

const logger = createLogger('worker-hub');

export interface WorkerHubOptions {
  authToken?: string;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
}

export class WorkerHub {
  private wss: WebSocketServer | null = null;
  private workers: Map<string, ConnectedWorker> = new Map();
  private authenticatedWorkers: Set<string> = new Set();
  private heartbeatInterval: Timer | null = null;
  private workerCounter = 0;

  private readonly authToken: string | undefined;
  private readonly heartbeatIntervalMs: number;
  private readonly heartbeatTimeoutMs: number;

  // Event callbacks
  public onWorkerConnected?: (worker: ConnectedWorker) => void;
  public onWorkerDisconnected?: (workerId: string) => void;
  public onTaskComplete?: (workerId: string, taskId: string, result: unknown) => void;
  public onTaskError?: (workerId: string, taskId: string, error: string) => void;
  public onWorkerReadyForTermination?: (workerId: string) => void;

  constructor(options: WorkerHubOptions = {}) {
    this.authToken = options.authToken;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 30000;
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 60000;
  }

  /**
   * Attach WebSocket server to HTTP server
   */
  attach(server: Server, path = '/ws'): void {
    this.wss = new WebSocketServer({ server, path });

    this.wss.on('connection', (socket, request) => {
      this.handleConnection(socket, request);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error:', { message: error.message, stack: error.stack });
    });

    // Start heartbeat checker
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeats();
    }, this.heartbeatIntervalMs);

    logger.info(`WebSocket server attached at path: ${path}`);
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: WebSocket, request: { url?: string; socket?: { remoteAddress?: string } }): void {
    const workerId = `worker-${++this.workerCounter}-${Date.now()}`;

    // Get remote address to determine if external
    const remoteAddress = request.socket?.remoteAddress || '';
    const isLocalhost = remoteAddress === '127.0.0.1' ||
                        remoteAddress === '::1' ||
                        remoteAddress === '::ffff:127.0.0.1' ||
                        remoteAddress === '';

    logger.info(`New connection from potential worker: ${workerId} (${remoteAddress}, local: ${isLocalhost})`);

    // Store connection info for auth check
    const connectionInfo = { isLocalhost, remoteAddress };

    // Set up message handler
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as WorkerToBackendMessage;
        this.handleMessage(workerId, socket, message, connectionInfo);
      } catch (error) {
        const err = error as Error;
        logger.error(`Failed to parse message from ${workerId}:`, { message: err.message });
        this.sendError(socket, 'Invalid message format');
      }
    });

    socket.on('close', () => {
      this.handleDisconnect(workerId);
    });

    socket.on('error', (error) => {
      logger.error(`Socket error for ${workerId}:`, { message: error.message, stack: error.stack });
    });

    // External connections ALWAYS require auth, localhost only if token is set
    const requiresAuth = !isLocalhost || !!this.authToken;

    // Send connection acknowledgment - worker must authenticate within timeout
    this.send(socket, {
      type: 'connection:pending',
      workerId,
      requiresAuth,
    });
  }

  /**
   * Handle incoming message from worker
   */
  private handleMessage(
    workerId: string,
    socket: WebSocket,
    message: WorkerToBackendMessage,
    connectionInfo: { isLocalhost: boolean; remoteAddress: string }
  ): void {
    switch (message.type) {
      case 'auth':
        this.handleAuth(workerId, socket, message, connectionInfo);
        break;

      case 'register':
        this.handleRegister(workerId, socket, message, connectionInfo);
        break;

      case 'heartbeat':
        this.handleHeartbeat(workerId);
        break;

      case 'task:complete':
        this.handleTaskComplete(workerId, message);
        break;

      case 'task:error':
        this.handleTaskError(workerId, message);
        break;

      case 'task:progress':
        this.handleTaskProgress(workerId, message);
        break;

      default:
        logger.warn(`Unknown message type from ${workerId}: ${(message as { type: string }).type}`);
    }
  }

  /**
   * Handle authentication
   */
  private handleAuth(
    workerId: string,
    socket: WebSocket,
    message: WorkerToBackendMessage & { type: 'auth' },
    connectionInfo: { isLocalhost: boolean; remoteAddress: string }
  ): void {
    // External connections ALWAYS require valid auth token
    if (!connectionInfo.isLocalhost) {
      if (!this.authToken) {
        logger.warn(`External worker ${workerId} rejected - no auth token configured`);
        this.send(socket, { type: 'auth:failed', reason: 'Server has no auth token configured for external connections' });
        socket.close(4001, 'Unauthorized');
        return;
      }
      if (message.token !== this.authToken) {
        logger.warn(`External worker ${workerId} rejected - invalid token`);
        this.send(socket, { type: 'auth:failed', reason: 'Invalid token' });
        socket.close(4001, 'Unauthorized');
        return;
      }
    } else if (this.authToken && message.token !== this.authToken) {
      // Localhost with token configured - still validate
      logger.warn(`Authentication failed for ${workerId}`);
      this.send(socket, { type: 'auth:failed', reason: 'Invalid token' });
      socket.close(4001, 'Unauthorized');
      return;
    }

    // Mark worker as authenticated
    this.authenticatedWorkers.add(workerId);
    this.send(socket, { type: 'auth:success' });
    logger.info(`Worker ${workerId} authenticated (localhost: ${connectionInfo.isLocalhost})`);
  }

  /**
   * Handle worker registration with capabilities
   */
  private handleRegister(
    workerId: string,
    socket: WebSocket,
    message: WorkerToBackendMessage & { type: 'register' },
    connectionInfo: { isLocalhost: boolean; remoteAddress: string }
  ): void {
    // External connections MUST be authenticated
    if (!connectionInfo.isLocalhost && !this.authenticatedWorkers.has(workerId)) {
      this.send(socket, { type: 'error', message: 'External workers must authenticate before registering' });
      socket.close(4001, 'Unauthorized');
      return;
    }

    // Localhost with auth token configured must also authenticate
    if (connectionInfo.isLocalhost && this.authToken && !this.authenticatedWorkers.has(workerId)) {
      this.send(socket, { type: 'error', message: 'Must authenticate before registering' });
      return;
    }

    // Extract capabilities from the register message
    const registerMsg = message as { capabilities: WorkerCapability[]; metadata?: Record<string, unknown> };
    const capabilities = registerMsg.capabilities;
    const worker: ConnectedWorker = {
      id: workerId,
      socket,
      capabilities,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
      currentTaskId: null,
      currentTaskType: null,
      metadata: registerMsg.metadata,
    };

    this.workers.set(workerId, worker);

    this.send(socket, {
      type: 'registered',
      workerId,
      assignedCapabilities: capabilities,
    });

    logger.info(`Worker ${workerId} registered with capabilities: ${capabilities.join(', ')}`);
    this.onWorkerConnected?.(worker);
  }

  /**
   * Handle heartbeat from worker
   */
  private handleHeartbeat(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.lastHeartbeat = Date.now();
      this.send(worker.socket, { type: 'heartbeat:ack' });
    }
  }

  /**
   * Handle task completion
   */
  private handleTaskComplete(
    workerId: string,
    message: WorkerToBackendMessage & { type: 'task:complete' }
  ): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      const wasPendingTermination = worker.pendingTermination;
      worker.currentTaskId = null;
      worker.currentTaskType = null;

      // Notify about pending termination so process manager can act
      if (wasPendingTermination) {
        this.onWorkerReadyForTermination?.(workerId);
      }
    }
    this.onTaskComplete?.(workerId, message.taskId, message.result);
  }

  /**
   * Handle task error
   */
  private handleTaskError(
    workerId: string,
    message: WorkerToBackendMessage & { type: 'task:error' }
  ): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      const wasPendingTermination = worker.pendingTermination;
      worker.currentTaskId = null;
      worker.currentTaskType = null;

      // Notify about pending termination so process manager can act
      if (wasPendingTermination) {
        this.onWorkerReadyForTermination?.(workerId);
      }
    }
    this.onTaskError?.(workerId, message.taskId, message.error);
  }

  /**
   * Handle task progress update
   */
  private handleTaskProgress(
    workerId: string,
    message: WorkerToBackendMessage & { type: 'task:progress' }
  ): void {
    logger.debug(`Task ${message.taskId} progress from ${workerId}: ${message.progress}%`);
    // Could emit event for progress tracking
  }

  /**
   * Handle worker disconnect
   */
  private handleDisconnect(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      this.workers.delete(workerId);
      this.authenticatedWorkers.delete(workerId);
      logger.info(`Worker ${workerId} disconnected`);
      this.onWorkerDisconnected?.(workerId);
    } else {
      // Clean up auth state even if worker wasn't fully registered
      this.authenticatedWorkers.delete(workerId);
    }
  }

  /**
   * Check heartbeats and disconnect stale workers
   */
  private checkHeartbeats(): void {
    const now = Date.now();
    const staleWorkers: string[] = [];

    for (const [workerId, worker] of this.workers) {
      if (now - worker.lastHeartbeat > this.heartbeatTimeoutMs) {
        staleWorkers.push(workerId);
      }
    }

    for (const workerId of staleWorkers) {
      const worker = this.workers.get(workerId);
      if (worker) {
        logger.warn(`Worker ${workerId} timed out, disconnecting`);
        worker.socket.close(4002, 'Heartbeat timeout');
        this.handleDisconnect(workerId);
      }
    }
  }

  /**
   * Assign a task to a specific worker
   */
  assignTask(workerId: string, taskId: string, taskType: string, payload: unknown): boolean {
    const worker = this.workers.get(workerId);
    if (!worker || worker.currentTaskId) {
      return false;
    }

    worker.currentTaskId = taskId;
    worker.currentTaskType = taskType;
    this.send(worker.socket, {
      type: 'task:assign',
      task: {
        id: taskId,
        type: taskType,
        payload,
      },
      capability: taskType, // Use taskType as capability hint
    });

    logger.info(`Assigned task ${taskId} (${taskType}) to worker ${workerId}`);
    return true;
  }

  /**
   * Mark a worker for pending termination
   * Worker will be terminated after current task completes
   */
  markForTermination(workerId: string): boolean {
    const worker = this.workers.get(workerId);
    if (!worker) {
      return false;
    }
    worker.pendingTermination = true;
    logger.info(`Worker ${workerId} marked for termination after task completes`);
    return true;
  }

  /**
   * Check if a worker is busy (has a current task)
   */
  isWorkerBusy(workerId: string): boolean {
    const worker = this.workers.get(workerId);
    return worker ? !!worker.currentTaskId : false;
  }

  /**
   * Find available worker with required capability
   */
  findAvailableWorker(capability: WorkerCapability): ConnectedWorker | null {
    for (const worker of this.workers.values()) {
      if (
        !worker.currentTaskId &&
        worker.capabilities.includes(capability)
      ) {
        return worker;
      }
    }
    return null;
  }

  /**
   * Find available worker with any of the given capabilities
   */
  findAvailableWorkerForAny(capabilities: WorkerCapability[]): ConnectedWorker | null {
    for (const worker of this.workers.values()) {
      if (!worker.currentTaskId) {
        for (const cap of capabilities) {
          if (worker.capabilities.includes(cap)) {
            return worker;
          }
        }
      }
    }
    return null;
  }

  /**
   * Get worker stats
   */
  getStats(): WorkerStats {
    const byCapability: Partial<Record<WorkerCapability, number>> = {};

    for (const worker of this.workers.values()) {
      for (const cap of worker.capabilities) {
        byCapability[cap] = (byCapability[cap] || 0) + 1;
      }
    }

    return {
      totalConnected: this.workers.size,
      byCapability: byCapability as Record<WorkerCapability, number>,
      averageLatency: 0, // TODO: Track latency
    };
  }

  /**
   * Get all connected workers
   */
  getWorkers(): ConnectedWorker[] {
    return Array.from(this.workers.values());
  }

  /**
   * Get worker by ID
   */
  getWorker(workerId: string): ConnectedWorker | undefined {
    return this.workers.get(workerId);
  }

  /**
   * Check if any workers are connected
   */
  hasWorkers(): boolean {
    return this.workers.size > 0;
  }

  /**
   * Send message to worker
   */
  private send(socket: WebSocket, message: BackendToWorkerMessage | Record<string, unknown>): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message
   */
  private sendError(socket: WebSocket, message: string): void {
    this.send(socket, { type: 'error', message });
  }

  /**
   * Broadcast message to all workers
   */
  broadcast(message: BackendToWorkerMessage): void {
    for (const worker of this.workers.values()) {
      this.send(worker.socket, message);
    }
  }

  /**
   * Shutdown the hub
   */
  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all worker connections
    for (const worker of this.workers.values()) {
      worker.socket.close(1001, 'Server shutting down');
    }
    this.workers.clear();

    // Close WebSocket server
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => resolve());
      });
    }

    logger.info('Worker hub shut down');
  }
}

/**
 * Worker Hub
 *
 * Manages WebSocket connections from workers, browsers, and SSE-writers.
 * Handles authentication, heartbeats, channel subscriptions, and connection lifecycle.
 *
 * Issue #264: Extended to support unified WebSocket system with channels.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { createLogger } from '@claude-mem/shared';
import type {
  WorkerCapability,
  WorkerToBackendMessage,
  BackendToWorkerMessage,
  ChannelEvent,
  ChannelPattern,
  WSClientType,
  ClientPermission,
  BrowserAuthMessage,
  SSEWriterAuthMessage,
  SubscribeMessage,
  UnsubscribeMessage,
  AuthSuccessMessage,
  SubscribedMessage,
  EventMessage,
  ServerToClientMessage,
} from '@claude-mem/types';
import { DEFAULT_PERMISSIONS } from '@claude-mem/types';
import type { ConnectedWorker, WorkerStats } from './types.js';
import { ChannelManager } from './channel-manager.js';
import type { SSEWriterClient } from './sse-writer-client.js';
import { shouldDeliverToSSEWriter, SSE_WRITER_CHANNELS } from './sse-writer-client.js';
import type { WorkerTokenService } from '../services/worker-token-service.js';

const logger = createLogger('worker-hub');

export interface WorkerHubOptions {
  authToken?: string;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  /** Token service for database-backed auth (Issue #263) */
  workerTokenService?: WorkerTokenService;
}

/**
 * Browser client connection
 */
interface BrowserClient {
  id: string;
  socket: WebSocket;
  connectedAt: number;
  lastHeartbeat: number;
}

export class WorkerHub {
  private wss: WebSocketServer | null = null;
  private workers: Map<string, ConnectedWorker> = new Map();
  private authenticatedWorkers: Set<string> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private workerCounter = 0;

  // Browser and SSE-Writer clients (Issue #264)
  private browserClients: Map<string, BrowserClient> = new Map();
  private sseWriterClients: Map<string, SSEWriterClient> = new Map();
  private channelManager: ChannelManager = new ChannelManager();
  private clientCounter = 0;

  private readonly authToken: string | undefined;
  private readonly heartbeatIntervalMs: number;
  private readonly heartbeatTimeoutMs: number;
  private workerTokenService: WorkerTokenService | undefined;

  // Pending auth state: stores token validation results before registration
  private pendingTokenAuth: Map<string, { tokenId: string; systemId?: string }> = new Map();

  // Event callbacks
  public onWorkerConnected?: (worker: ConnectedWorker) => void;
  public onWorkerDisconnected?: (workerId: string) => void;
  public onTaskComplete?: (workerId: string, taskId: string, result: unknown) => void;
  public onTaskError?: (workerId: string, taskId: string, error: string) => void;
  public onTaskProgress?: (workerId: string, taskId: string, progress: number, message?: string) => void;
  public onWorkerReadyForTermination?: (workerId: string) => void;

  constructor(options: WorkerHubOptions = {}) {
    this.authToken = options.authToken;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 30000;
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 60000;
    this.workerTokenService = options.workerTokenService;
  }

  /**
   * Set the worker token service (for late binding after DB init)
   */
  setWorkerTokenService(service: WorkerTokenService): void {
    this.workerTokenService = service;
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
    // Generate a temporary pending ID - will be replaced with typed ID on auth
    const pendingId = `pending-${++this.clientCounter}-${Date.now()}`;

    // Get remote address to determine if external
    const remoteAddress = request.socket?.remoteAddress || '';
    const isLocalhost = remoteAddress === '127.0.0.1' ||
                        remoteAddress === '::1' ||
                        remoteAddress === '::ffff:127.0.0.1' ||
                        remoteAddress === '';

    logger.debug(`New connection: ${pendingId} (${remoteAddress}, local: ${isLocalhost})`);

    // Store connection info for auth check
    const connectionInfo = { isLocalhost, remoteAddress, pendingId };

    // Set up message handler
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(connectionInfo.pendingId, socket, message, connectionInfo);
      } catch (error) {
        const err = error as Error;
        logger.error(`Failed to parse message from ${connectionInfo.pendingId}:`, { message: err.message });
        this.sendError(socket, 'Invalid message format');
      }
    });

    socket.on('close', () => {
      this.handleDisconnect(connectionInfo.pendingId);
    });

    socket.on('error', (error) => {
      logger.error(`Socket error for ${connectionInfo.pendingId}:`, { message: error.message, stack: error.stack });
    });

    // External connections ALWAYS require auth, localhost only if token is set
    const requiresAuth = !isLocalhost || !!this.authToken;

    // Send connection acknowledgment - client must authenticate within timeout
    this.send(socket, {
      type: 'connection:pending',
      clientId: pendingId,
      requiresAuth,
    });
  }

  /**
   * Handle incoming message from any client type
   */
  private async handleMessage(
    clientId: string,
    socket: WebSocket,
    message: WorkerToBackendMessage | SubscribeMessage | UnsubscribeMessage | { type: string },
    connectionInfo: { isLocalhost: boolean; remoteAddress: string; pendingId: string }
  ): Promise<void> {
    switch (message.type) {
      case 'auth':
        await this.handleAuth(clientId, socket, message as WorkerToBackendMessage & { type: 'auth' }, connectionInfo);
        break;

      case 'register':
        await this.handleRegister(clientId, socket, message as WorkerToBackendMessage & { type: 'register' }, connectionInfo);
        break;

      case 'heartbeat':
        this.handleHeartbeat(clientId);
        break;

      case 'subscribe':
        this.handleSubscribe(clientId, socket, message as SubscribeMessage);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(clientId, message as UnsubscribeMessage);
        break;

      case 'pong':
        this.handlePong(clientId);
        break;

      case 'task:complete':
        this.handleTaskComplete(clientId, message as WorkerToBackendMessage & { type: 'task:complete' });
        break;

      case 'task:error':
        this.handleTaskError(clientId, message as WorkerToBackendMessage & { type: 'task:error' });
        break;

      case 'task:progress':
        this.handleTaskProgress(clientId, message as WorkerToBackendMessage & { type: 'task:progress' });
        break;

      default:
        logger.warn(`Unknown message type from ${clientId}: ${(message as { type: string }).type}`);
    }
  }

  /**
   * Detect client type from auth message
   */
  private detectClientType(message: { type: 'auth'; clientType?: string; token?: string; capabilities?: unknown }): WSClientType {
    // Explicit SSE-Writer
    if (message.clientType === 'sse-writer') {
      return 'sse-writer';
    }
    // Worker: has token or capabilities
    if (message.token || message.capabilities) {
      return 'worker';
    }
    // Default: browser
    return 'browser';
  }

  /**
   * Handle authentication - routes to client-type-specific handler
   */
  private async handleAuth(
    clientId: string,
    socket: WebSocket,
    message: WorkerToBackendMessage & { type: 'auth' },
    connectionInfo: { isLocalhost: boolean; remoteAddress: string; pendingId: string }
  ): Promise<void> {
    const clientType = this.detectClientType(message as { type: 'auth'; clientType?: string; token?: string; capabilities?: unknown });

    switch (clientType) {
      case 'browser':
        this.handleBrowserAuth(clientId, socket, connectionInfo);
        break;
      case 'sse-writer':
        this.handleSSEWriterAuth(clientId, socket, message as unknown as SSEWriterAuthMessage, connectionInfo);
        break;
      case 'worker':
        await this.handleWorkerAuth(clientId, socket, message, connectionInfo);
        break;
    }
  }

  /**
   * Handle browser client authentication (no token required)
   */
  private handleBrowserAuth(
    clientId: string,
    socket: WebSocket,
    connectionInfo: { isLocalhost: boolean; remoteAddress: string; pendingId: string }
  ): void {
    // Generate final browser client ID
    const browserId = `browser-${++this.clientCounter}-${Date.now().toString(36)}`;

    // Update connection info to use new ID
    connectionInfo.pendingId = browserId;

    const client: BrowserClient = {
      id: browserId,
      socket,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
    };

    this.browserClients.set(browserId, client);

    // Send auth success with permissions
    const response: AuthSuccessMessage = {
      type: 'auth:success',
      clientId: browserId,
      permissions: DEFAULT_PERMISSIONS.browser,
    };
    this.send(socket, response);

    logger.info(`Browser client ${browserId} authenticated (localhost: ${connectionInfo.isLocalhost})`);
  }

  /**
   * Handle SSE-Writer client authentication
   */
  private handleSSEWriterAuth(
    clientId: string,
    socket: WebSocket,
    message: SSEWriterAuthMessage,
    connectionInfo: { isLocalhost: boolean; remoteAddress: string; pendingId: string }
  ): void {
    // Generate final SSE-Writer client ID
    const writerId = `sse-writer-${++this.clientCounter}-${Date.now().toString(36)}`;

    // Update connection info to use new ID
    connectionInfo.pendingId = writerId;

    const client: SSEWriterClient = {
      id: writerId,
      socket,
      sessionId: message.sessionId,
      project: message.project,
      workingDirectory: message.workingDirectory,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
    };

    this.sseWriterClients.set(writerId, client);

    // Auto-subscribe to SSE-Writer channels
    this.channelManager.subscribe(writerId, [...SSE_WRITER_CHANNELS]);

    // Send auth success
    const response: AuthSuccessMessage = {
      type: 'auth:success',
      clientId: writerId,
      permissions: DEFAULT_PERMISSIONS['sse-writer'],
    };
    this.send(socket, response);

    // Send subscription confirmation
    const subscribed: SubscribedMessage = {
      type: 'subscribed',
      channels: [...SSE_WRITER_CHANNELS],
    };
    this.send(socket, subscribed);

    logger.info(`SSE-Writer ${writerId} authenticated for session ${message.sessionId}, project ${message.project}`);
  }

  /**
   * Handle worker authentication (with token validation)
   * Supports both database-backed tokens (Issue #263) and config-based tokens
   */
  private async handleWorkerAuth(
    workerId: string,
    socket: WebSocket,
    message: WorkerToBackendMessage & { type: 'auth' },
    connectionInfo: { isLocalhost: boolean; remoteAddress: string }
  ): Promise<void> {
    const token = message.token;
    const systemId = (message as { systemId?: string }).systemId;

    // Try database-backed token validation first (Issue #263)
    if (this.workerTokenService && token) {
      try {
        const validatedToken = await this.workerTokenService.validateToken(token);
        if (validatedToken) {
          // Store pending auth state for registration
          this.pendingTokenAuth.set(workerId, {
            tokenId: validatedToken.id,
            systemId,
          });
          this.authenticatedWorkers.add(workerId);
          this.send(socket, { type: 'auth:success' });
          logger.info(`Worker ${workerId} authenticated via DB token (${validatedToken.token_prefix}...)`);
          return;
        }
      } catch (error) {
        const err = error as Error;
        logger.error(`DB token validation error for ${workerId}:`, { message: err.message });
        // Fall through to config-based auth
      }
    }

    // Fall back to config-based token validation
    // External connections ALWAYS require valid auth token
    if (!connectionInfo.isLocalhost) {
      if (!this.authToken) {
        logger.warn(`External worker ${workerId} rejected - no auth token configured`);
        this.send(socket, { type: 'auth:failed', reason: 'Server has no auth token configured for external connections' });
        socket.close(4001, 'Unauthorized');
        return;
      }
      if (token !== this.authToken) {
        logger.warn(`External worker ${workerId} rejected - invalid token`);
        this.send(socket, { type: 'auth:failed', reason: 'Invalid token' });
        socket.close(4001, 'Unauthorized');
        return;
      }
    } else if (this.authToken && token !== this.authToken) {
      // Localhost with token configured - still validate
      logger.warn(`Authentication failed for ${workerId}`);
      this.send(socket, { type: 'auth:failed', reason: 'Invalid token' });
      socket.close(4001, 'Unauthorized');
      return;
    }

    // Mark worker as authenticated (config-based)
    this.authenticatedWorkers.add(workerId);
    this.send(socket, { type: 'auth:success' });
    logger.info(`Worker ${workerId} authenticated via config token (localhost: ${connectionInfo.isLocalhost})`);
  }

  /**
   * Handle worker registration with capabilities
   */
  private async handleRegister(
    workerId: string,
    socket: WebSocket,
    message: WorkerToBackendMessage & { type: 'register' },
    connectionInfo: { isLocalhost: boolean; remoteAddress: string }
  ): Promise<void> {
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
    const registerMsg = message as { capabilities: WorkerCapability[]; metadata?: Record<string, unknown>; hostname?: string };
    const capabilities = registerMsg.capabilities;

    // Check for pending token auth (Issue #263)
    const pendingAuth = this.pendingTokenAuth.get(workerId);
    const tokenId = pendingAuth?.tokenId;
    const systemId = pendingAuth?.systemId || workerId;

    const worker: ConnectedWorker = {
      id: workerId,
      socket,
      capabilities,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
      currentTaskId: null,
      currentTaskType: null,
      metadata: registerMsg.metadata,
      latencyHistory: [],
      tokenId,
      systemId,
    };

    // Setup ping/pong for latency tracking
    socket.on('pong', () => {
      if (worker.lastPingTime) {
        const latency = Date.now() - worker.lastPingTime;
        worker.latencyHistory.push(latency);
        // Keep only last 10 measurements
        if (worker.latencyHistory.length > 10) {
          worker.latencyHistory.shift();
        }
        worker.lastPingTime = undefined;
      }
    });

    this.workers.set(workerId, worker);

    // Create worker registration in database if using token-based auth (Issue #263)
    if (tokenId && this.workerTokenService) {
      try {
        await this.workerTokenService.registerWorker(tokenId, systemId, {
          hostname: registerMsg.hostname,
          workerId,
          capabilities: capabilities as string[],
          metadata: registerMsg.metadata,
        });
        logger.debug(`Created DB registration for worker ${workerId}`);
      } catch (error) {
        const err = error as Error;
        logger.error(`Failed to create DB registration for ${workerId}:`, { message: err.message });
        // Continue anyway - worker can still function
      }
    }

    // Clean up pending auth state
    this.pendingTokenAuth.delete(workerId);

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
  private handleHeartbeat(clientId: string): void {
    // Check workers
    const worker = this.workers.get(clientId);
    if (worker) {
      worker.lastHeartbeat = Date.now();
      this.send(worker.socket, { type: 'heartbeat:ack' });
      return;
    }

    // Check browser clients
    const browser = this.browserClients.get(clientId);
    if (browser) {
      browser.lastHeartbeat = Date.now();
      this.send(browser.socket, { type: 'heartbeat:ack' });
      return;
    }

    // Check SSE-Writer clients
    const sseWriter = this.sseWriterClients.get(clientId);
    if (sseWriter) {
      sseWriter.lastHeartbeat = Date.now();
      this.send(sseWriter.socket, { type: 'heartbeat:ack' });
    }
  }

  /**
   * Handle pong response from client
   */
  private handlePong(clientId: string): void {
    const browser = this.browserClients.get(clientId);
    if (browser) {
      browser.lastHeartbeat = Date.now();
      return;
    }

    const sseWriter = this.sseWriterClients.get(clientId);
    if (sseWriter) {
      sseWriter.lastHeartbeat = Date.now();
    }
  }

  /**
   * Handle channel subscription
   */
  private handleSubscribe(clientId: string, socket: WebSocket, message: SubscribeMessage): void {
    const subscribed = this.channelManager.subscribe(clientId, message.channels);

    const response: SubscribedMessage = {
      type: 'subscribed',
      channels: subscribed,
    };
    this.send(socket, response);

    logger.debug(`Client ${clientId} subscribed to: ${subscribed.join(', ')}`);
  }

  /**
   * Handle channel unsubscription
   */
  private handleUnsubscribe(clientId: string, message: UnsubscribeMessage): void {
    this.channelManager.unsubscribe(clientId, message.channels);
    logger.debug(`Client ${clientId} unsubscribed from: ${message.channels.join(', ')}`);
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
    this.onTaskProgress?.(workerId, message.taskId, message.progress, message.message);
  }

  /**
   * Handle client disconnect (any type)
   */
  private handleDisconnect(clientId: string): void {
    // Check if it's a worker
    const worker = this.workers.get(clientId);
    if (worker) {
      this.workers.delete(clientId);
      this.authenticatedWorkers.delete(clientId);
      this.channelManager.removeClient(clientId);
      this.pendingTokenAuth.delete(clientId);

      // Update DB registration if using token-based auth (Issue #263)
      if (worker.systemId && this.workerTokenService) {
        this.workerTokenService.disconnectWorker(worker.systemId).catch((error) => {
          const err = error as Error;
          logger.error(`Failed to update DB registration for ${clientId}:`, { message: err.message });
        });
      }

      logger.info(`Worker ${clientId} disconnected`);
      this.onWorkerDisconnected?.(clientId);
      return;
    }

    // Check if it's a browser client
    const browser = this.browserClients.get(clientId);
    if (browser) {
      this.browserClients.delete(clientId);
      this.channelManager.removeClient(clientId);
      logger.info(`Browser client ${clientId} disconnected`);
      return;
    }

    // Check if it's an SSE-Writer client
    const sseWriter = this.sseWriterClients.get(clientId);
    if (sseWriter) {
      this.sseWriterClients.delete(clientId);
      this.channelManager.removeClient(clientId);
      logger.info(`SSE-Writer ${clientId} disconnected (session: ${sseWriter.sessionId})`);
      return;
    }

    // Clean up auth state for pending connections that never fully registered
    this.authenticatedWorkers.delete(clientId);
    this.pendingTokenAuth.delete(clientId);
  }

  /**
   * Check heartbeats and disconnect stale clients
   */
  private checkHeartbeats(): void {
    const now = Date.now();
    const staleClients: Array<{ id: string; type: 'worker' | 'browser' | 'sse-writer'; socket: WebSocket }> = [];

    // Check workers
    for (const [workerId, worker] of this.workers) {
      if (now - worker.lastHeartbeat > this.heartbeatTimeoutMs) {
        staleClients.push({ id: workerId, type: 'worker', socket: worker.socket });
      } else {
        // Send WebSocket ping for latency measurement
        if (worker.socket.readyState === WebSocket.OPEN) {
          worker.lastPingTime = Date.now();
          worker.socket.ping();
        }
      }
    }

    // Check browser clients
    for (const [clientId, client] of this.browserClients) {
      if (now - client.lastHeartbeat > this.heartbeatTimeoutMs) {
        staleClients.push({ id: clientId, type: 'browser', socket: client.socket });
      } else {
        // Send ping message for browser clients
        if (client.socket.readyState === WebSocket.OPEN) {
          this.send(client.socket, { type: 'ping' });
        }
      }
    }

    // Check SSE-Writer clients
    for (const [clientId, client] of this.sseWriterClients) {
      if (now - client.lastHeartbeat > this.heartbeatTimeoutMs) {
        staleClients.push({ id: clientId, type: 'sse-writer', socket: client.socket });
      } else {
        // Send ping message for SSE-Writer clients
        if (client.socket.readyState === WebSocket.OPEN) {
          this.send(client.socket, { type: 'ping' });
        }
      }
    }

    // Disconnect stale clients
    for (const { id, type, socket } of staleClients) {
      logger.warn(`${type} client ${id} timed out, disconnecting`);
      socket.close(4002, 'Heartbeat timeout');
      this.handleDisconnect(id);
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
      capability: taskType,
    } as Record<string, unknown>);

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
        !worker.pendingTermination &&
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
      if (!worker.currentTaskId && !worker.pendingTermination) {
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

    // Calculate average latency across all workers
    let totalLatency = 0;
    let latencyCount = 0;

    for (const worker of this.workers.values()) {
      if (worker.latencyHistory.length > 0) {
        const workerAvg = worker.latencyHistory.reduce((a, b) => a + b, 0) / worker.latencyHistory.length;
        totalLatency += workerAvg;
        latencyCount++;
      }
    }

    const averageLatency = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0;

    return {
      totalConnected: this.workers.size,
      byCapability: byCapability as Record<WorkerCapability, number>,
      averageLatency,
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
   * Send message to any client
   */
  private send(socket: WebSocket, message: BackendToWorkerMessage | ServerToClientMessage | Record<string, unknown>): void {
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
   * Publish an event to all subscribers of a channel
   *
   * This handles:
   * - Finding all clients subscribed to matching patterns
   * - Server-side filtering for SSE-Writer clients
   * - Delivering the event message
   */
  publish(channel: ChannelEvent, data: unknown): void {
    const subscribers = this.channelManager.getSubscribers(channel);

    if (subscribers.size === 0) {
      logger.debug(`No subscribers for channel ${channel}`);
      return;
    }

    const eventMessage: EventMessage = {
      type: 'event',
      channel,
      data,
      timestamp: Date.now(),
    };

    let delivered = 0;
    let filtered = 0;

    for (const clientId of subscribers) {
      // Get socket for this client
      let socket: WebSocket | undefined;

      // Check SSE-Writer clients (with filtering)
      const sseWriter = this.sseWriterClients.get(clientId);
      if (sseWriter) {
        // Apply server-side filtering for SSE-Writers
        if (!shouldDeliverToSSEWriter(sseWriter, channel, data)) {
          filtered++;
          continue;
        }
        socket = sseWriter.socket;
      }

      // Check browser clients
      if (!socket) {
        const browser = this.browserClients.get(clientId);
        if (browser) {
          socket = browser.socket;
        }
      }

      // Check workers
      if (!socket) {
        const worker = this.workers.get(clientId);
        if (worker) {
          socket = worker.socket;
        }
      }

      // Deliver if we found a socket
      if (socket && socket.readyState === WebSocket.OPEN) {
        this.send(socket, eventMessage);
        delivered++;
      }
    }

    logger.debug(`Published ${channel}: ${delivered} delivered, ${filtered} filtered`);
  }

  /**
   * Get channel manager statistics
   */
  getChannelStats(): { totalPatterns: number; totalClients: number; patternCounts: Record<string, number> } {
    return this.channelManager.getStats();
  }

  /**
   * Get count of connected browser clients
   */
  getBrowserClientCount(): number {
    return this.browserClients.size;
  }

  /**
   * Get count of connected SSE-Writer clients
   */
  getSSEWriterClientCount(): number {
    return this.sseWriterClients.size;
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

    // Close all browser client connections
    for (const client of this.browserClients.values()) {
      client.socket.close(1001, 'Server shutting down');
    }
    this.browserClients.clear();

    // Close all SSE-Writer client connections
    for (const client of this.sseWriterClients.values()) {
      client.socket.close(1001, 'Server shutting down');
    }
    this.sseWriterClients.clear();

    // Close WebSocket server
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => resolve());
      });
    }

    logger.info('Worker hub shut down');
  }
}

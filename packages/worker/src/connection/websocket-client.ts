/**
 * WebSocket Client
 *
 * Connects to the backend WebSocket server.
 * Handles authentication, reconnection, and message routing.
 */

import WebSocket from 'ws';
import { createLogger, loadSettings, WORKER } from '@claude-mem/shared';
import type {
  WorkerCapability,
  WorkerToBackendMessage,
  BackendToWorkerMessage,
  ConnectionState,
} from '@claude-mem/types';

const logger = createLogger('ws-client');

/**
 * Configuration for the WebSocket client
 */
export interface WebSocketClientConfig {
  /** Backend WebSocket URL */
  backendUrl?: string;
  /** Authentication token */
  authToken?: string;
  /** Worker capabilities */
  capabilities: WorkerCapability[];
  /** Reconnect interval in ms */
  reconnectInterval?: number;
  /** Max reconnect attempts */
  maxReconnectAttempts?: number;
  /** Heartbeat interval in ms */
  heartbeatInterval?: number;
  /** Worker metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Events emitted by the WebSocket client
 */
export interface WebSocketClientEvents {
  onConnected?: (workerId: string) => void;
  onDisconnected?: (reason: string) => void;
  onTaskAssigned?: (taskId: string, taskType: string, payload: unknown, capability: WorkerCapability) => void;
  onTaskCancelled?: (taskId: string, reason?: string) => void;
  onError?: (error: Error) => void;
}

/**
 * WebSocket client for worker-backend communication
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private workerId: string | null = null;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly backendUrl: string;
  private readonly authToken: string;
  private readonly capabilities: WorkerCapability[];
  private readonly reconnectInterval: number;
  private readonly maxReconnectAttempts: number;
  private readonly heartbeatInterval: number;
  private readonly metadata: Record<string, unknown>;

  private events: WebSocketClientEvents = {};

  constructor(config: WebSocketClientConfig) {
    const settings = loadSettings();

    // WebSocket is on same port as HTTP at /ws path
    // Use localhost when BACKEND_HOST is 0.0.0.0 (bind address, not connection address)
    const connectionHost = settings.BACKEND_HOST === '0.0.0.0' ? '127.0.0.1' : settings.BACKEND_HOST;
    this.backendUrl = config.backendUrl || `ws://${connectionHost}:${settings.BACKEND_PORT}/ws`;
    this.authToken = config.authToken || settings.WORKER_AUTH_TOKEN || '';
    this.capabilities = config.capabilities;
    this.reconnectInterval = config.reconnectInterval || WORKER.RECONNECT_INTERVAL;
    this.maxReconnectAttempts = config.maxReconnectAttempts || WORKER.MAX_RECONNECT_ATTEMPTS;
    this.heartbeatInterval = config.heartbeatInterval || WORKER.HEARTBEAT_INTERVAL;
    this.metadata = config.metadata || {};
  }

  /**
   * Set event handlers
   */
  on(events: WebSocketClientEvents): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get assigned worker ID
   */
  getWorkerId(): string | null {
    return this.workerId;
  }

  /**
   * Connect to the backend
   */
  connect(): void {
    if (this.state === 'connecting' || this.state === 'connected') {
      return;
    }

    this.state = 'connecting';
    logger.info(`Connecting to backend at ${this.backendUrl}`);

    try {
      this.ws = new WebSocket(this.backendUrl);
      this.setupSocketHandlers();
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to create WebSocket:', { message: err.message });
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the backend
   */
  disconnect(reason = 'Client disconnect'): void {
    this.stopHeartbeat();
    this.clearReconnectTimer();

    if (this.ws) {
      // Send shutdown message if connected
      if (this.state === 'connected' && this.workerId) {
        this.send({
          type: 'shutdown',
          workerId: this.workerId,
          reason,
        });
      }

      this.ws.close(1000, reason);
      this.ws = null;
    }

    this.state = 'disconnected';
    this.workerId = null;
    logger.info(`Disconnected: ${reason}`);
  }

  /**
   * Send task completion
   */
  sendTaskComplete(taskId: string, result: unknown, processingTimeMs: number): void {
    if (!this.workerId) return;

    this.send({
      type: 'task:complete',
      taskId,
      workerId: this.workerId,
      result,
      processingTimeMs,
    });
  }

  /**
   * Send task error
   */
  sendTaskError(taskId: string, error: string, retryable = true): void {
    if (!this.workerId) return;

    this.send({
      type: 'task:error',
      taskId,
      workerId: this.workerId,
      error,
      retryable,
    });
  }

  /**
   * Send task progress
   */
  sendTaskProgress(taskId: string, progress: number, message?: string): void {
    if (!this.workerId) return;

    this.send({
      type: 'task:progress',
      taskId,
      workerId: this.workerId,
      progress,
      message,
    });
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.on('open', () => {
      logger.info('WebSocket connection opened');
      this.state = 'authenticating';
      this.reconnectAttempts = 0;

      // Send authentication
      if (this.authToken) {
        this.send({ type: 'auth', token: this.authToken });
      } else {
        // No auth required, send registration directly
        this.sendRegistration();
      }
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as BackendToWorkerMessage | Record<string, unknown>;
        this.handleMessage(message);
      } catch (error) {
        const err = error as Error;
        logger.error('Failed to parse message:', { message: err.message });
      }
    });

    this.ws.on('close', (code, reason) => {
      logger.info(`WebSocket closed: ${code} - ${reason.toString()}`);
      this.handleDisconnect(reason.toString());
    });

    this.ws.on('error', (error) => {
      logger.error('WebSocket error:', { message: error.message });
      this.events.onError?.(error);
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: BackendToWorkerMessage | Record<string, unknown>): void {
    const type = (message as { type: string }).type;

    switch (type) {
      case 'connection:pending':
        // Backend acknowledged connection, waiting for auth
        logger.debug('Connection pending, authentication required');
        break;

      case 'auth:success':
        logger.info('Authentication successful');
        this.sendRegistration();
        break;

      case 'auth:failed':
        logger.error('Authentication failed:', { reason: (message as { reason?: string }).reason });
        this.disconnect('Authentication failed');
        break;

      case 'registered':
        this.handleRegistered(message as { workerId: string });
        break;

      case 'heartbeat:ack':
        // Heartbeat acknowledged
        break;

      case 'task:assign':
        this.handleTaskAssign(message as BackendToWorkerMessage & { type: 'task:assign' });
        break;

      case 'task:cancel':
        this.handleTaskCancel(message as BackendToWorkerMessage & { type: 'task:cancel' });
        break;

      case 'server:shutdown':
        logger.info('Server is shutting down');
        this.disconnect('Server shutdown');
        break;

      case 'error':
        logger.error('Server error:', { message: (message as { message?: string }).message });
        break;

      default:
        logger.debug(`Unknown message type: ${type}`);
    }
  }

  /**
   * Send registration message
   */
  private sendRegistration(): void {
    this.send({
      type: 'register',
      capabilities: this.capabilities,
      metadata: this.metadata,
    });
  }

  /**
   * Handle successful registration
   */
  private handleRegistered(message: { workerId: string }): void {
    this.workerId = message.workerId;
    this.state = 'connected';
    logger.info(`Registered as worker ${this.workerId}`);

    // Start heartbeat
    this.startHeartbeat();

    this.events.onConnected?.(this.workerId);
  }

  /**
   * Handle task assignment
   */
  private handleTaskAssign(message: BackendToWorkerMessage & { type: 'task:assign' }): void {
    const { task, capability } = message;
    logger.info(`Received task ${task.id} (${task.type})`);

    this.events.onTaskAssigned?.(task.id, task.type, task.payload, capability);
  }

  /**
   * Handle task cancellation
   */
  private handleTaskCancel(message: BackendToWorkerMessage & { type: 'task:cancel' }): void {
    const { taskId, reason } = message;
    logger.info(`Task ${taskId} cancelled: ${reason || 'No reason'}`);

    this.events.onTaskCancelled?.(taskId, reason);
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(reason: string): void {
    this.stopHeartbeat();
    this.ws = null;

    const wasConnected = this.state === 'connected';
    this.state = 'disconnected';
    this.workerId = null;

    if (wasConnected) {
      this.events.onDisconnected?.(reason);
    }

    // Attempt reconnect
    this.scheduleReconnect();
  }

  /**
   * Start heartbeat timer
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.workerId) {
        this.send({
          type: 'heartbeat',
          workerId: this.workerId,
          currentTasks: [], // TODO: Track current tasks
        });
      }
    }, this.heartbeatInterval);
  }

  /**
   * Stop heartbeat timer
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`Max reconnect attempts (${this.maxReconnectAttempts}) reached`);
      this.state = 'error';
      return;
    }

    this.state = 'reconnecting';
    this.reconnectAttempts++;

    const delay = this.reconnectInterval * Math.min(this.reconnectAttempts, 5);
    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Send message to backend
   */
  private send(message: WorkerToBackendMessage | Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

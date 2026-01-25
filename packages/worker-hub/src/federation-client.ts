/**
 * Federation Client (Issue #263)
 *
 * Connects to the backend as a federated hub.
 * Reports health status, receives task routing, and forwards results.
 */

import WebSocket from 'ws';
import { createLogger, loadSettings } from '@claude-mem/shared';
import type { HubStatus, WorkerCapability } from '@claude-mem/types';

const logger = createLogger('federation-client');

// Messages from hub to backend
export type HubToBackendMessage =
  | { type: 'hub:register'; name: string; region?: string; labels?: Record<string, string>; capabilities?: string[] }
  | { type: 'hub:health'; status: HubStatus; connectedWorkers: number; activeWorkers: number; avgLatencyMs?: number; capabilities?: string[] }
  | { type: 'hub:task:complete'; taskId: string; result: unknown; processingTimeMs: number }
  | { type: 'hub:task:error'; taskId: string; error: string; retryable: boolean }
  | { type: 'hub:task:progress'; taskId: string; progress: number; message?: string }
  | { type: 'hub:shutdown'; reason?: string };

// Messages from backend to hub
export type BackendToHubMessage =
  | { type: 'hub:registered'; hubId: string }
  | { type: 'hub:auth:success' }
  | { type: 'hub:auth:failed'; reason: string }
  | { type: 'hub:task:assign'; taskId: string; taskType: string; payload: unknown; capability: WorkerCapability }
  | { type: 'hub:task:cancel'; taskId: string; reason?: string }
  | { type: 'hub:heartbeat:ack' }
  | { type: 'backend:shutdown' };

export interface FederationClientConfig {
  /** Backend WebSocket URL (defaults to settings) */
  backendUrl?: string;
  /** Hub authentication token */
  hubToken?: string;
  /** Hub name (for display in backend) */
  name: string;
  /** Hub region (for regional routing) */
  region?: string;
  /** Hub labels (for label-based routing) */
  labels?: Record<string, string>;
  /** Initial capabilities (updated from workers) */
  capabilities?: string[];
  /** Reconnect interval (ms) */
  reconnectIntervalMs?: number;
  /** Max reconnect attempts */
  maxReconnectAttempts?: number;
  /** Health report interval (ms) */
  healthIntervalMs?: number;
}

export interface FederationClientEvents {
  onConnected?: (hubId: string) => void;
  onDisconnected?: (reason: string) => void;
  onTaskAssigned?: (taskId: string, taskType: string, payload: unknown, capability: WorkerCapability) => void;
  onTaskCancelled?: (taskId: string, reason?: string) => void;
  onError?: (error: Error) => void;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'reconnecting' | 'error';

/**
 * Client for connecting to backend as a federated hub
 */
export class FederationClient {
  private ws: WebSocket | null = null;
  private hubId: string | null = null;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private healthTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  private readonly backendUrl: string;
  private readonly hubToken: string;
  private readonly name: string;
  private readonly region?: string;
  private readonly labels?: Record<string, string>;
  private capabilities: string[];
  private readonly reconnectIntervalMs: number;
  private readonly maxReconnectAttempts: number;
  private readonly healthIntervalMs: number;

  // Health metrics (updated by HubServer)
  private connectedWorkers = 0;
  private activeWorkers = 0;
  private avgLatencyMs?: number;
  private hubStatus: HubStatus = 'healthy';

  private events: FederationClientEvents = {};

  constructor(config: FederationClientConfig) {
    const settings = loadSettings();

    // Use localhost when BACKEND_HOST is 0.0.0.0 (bind address, not connection address)
    const connectionHost = settings.BACKEND_HOST === '0.0.0.0' ? '127.0.0.1' : settings.BACKEND_HOST;
    this.backendUrl = config.backendUrl || `ws://${connectionHost}:${settings.BACKEND_PORT}/ws/hub`;
    this.hubToken = config.hubToken || '';
    this.name = config.name;
    this.region = config.region;
    this.labels = config.labels;
    this.capabilities = config.capabilities || [];
    this.reconnectIntervalMs = config.reconnectIntervalMs || 5000;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 10;
    this.healthIntervalMs = config.healthIntervalMs || 30000;
  }

  /**
   * Set event handlers
   */
  on(events: FederationClientEvents): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get hub ID (assigned by backend)
   */
  getHubId(): string | null {
    return this.hubId;
  }

  /**
   * Update health metrics (called by HubServer)
   */
  updateHealth(
    connectedWorkers: number,
    activeWorkers: number,
    avgLatencyMs?: number,
    capabilities?: string[]
  ): void {
    this.connectedWorkers = connectedWorkers;
    this.activeWorkers = activeWorkers;
    this.avgLatencyMs = avgLatencyMs;
    if (capabilities) {
      this.capabilities = capabilities;
    }

    // Update status based on metrics
    if (connectedWorkers === 0) {
      this.hubStatus = 'degraded';
    } else if (avgLatencyMs && avgLatencyMs > 5000) {
      this.hubStatus = 'degraded';
    } else {
      this.hubStatus = 'healthy';
    }
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
  disconnect(reason = 'Hub disconnect'): void {
    this.stopHealthReporting();
    this.clearReconnectTimer();

    if (this.ws) {
      if (this.state === 'connected' && this.hubId) {
        this.send({ type: 'hub:shutdown', reason });
      }
      this.ws.close(1000, reason);
      this.ws = null;
    }

    this.state = 'disconnected';
    this.hubId = null;
    logger.info(`Disconnected: ${reason}`);
  }

  /**
   * Send task completion to backend
   */
  sendTaskComplete(taskId: string, result: unknown, processingTimeMs: number): void {
    this.send({
      type: 'hub:task:complete',
      taskId,
      result,
      processingTimeMs,
    });
  }

  /**
   * Send task error to backend
   */
  sendTaskError(taskId: string, error: string, retryable: boolean): void {
    this.send({
      type: 'hub:task:error',
      taskId,
      error,
      retryable,
    });
  }

  /**
   * Send task progress to backend
   */
  sendTaskProgress(taskId: string, progress: number, message?: string): void {
    this.send({
      type: 'hub:task:progress',
      taskId,
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

      // Send authentication if token provided
      if (this.hubToken) {
        this.send({ type: 'auth', token: this.hubToken } as Record<string, unknown>);
      } else {
        // No auth required, send registration
        this.sendRegistration();
      }
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as BackendToHubMessage;
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
  private handleMessage(message: BackendToHubMessage): void {
    switch (message.type) {
      case 'hub:auth:success':
        logger.info('Authentication successful');
        this.sendRegistration();
        break;

      case 'hub:auth:failed':
        logger.error('Authentication failed:', { reason: message.reason });
        this.disconnect('Authentication failed');
        break;

      case 'hub:registered':
        this.handleRegistered(message.hubId);
        break;

      case 'hub:heartbeat:ack':
        // Health report acknowledged
        break;

      case 'hub:task:assign':
        this.handleTaskAssign(message);
        break;

      case 'hub:task:cancel':
        this.handleTaskCancel(message);
        break;

      case 'backend:shutdown':
        logger.info('Backend is shutting down');
        this.disconnect('Backend shutdown');
        break;

      default:
        logger.debug(`Unknown message type: ${(message as { type: string }).type}`);
    }
  }

  /**
   * Send registration message
   */
  private sendRegistration(): void {
    this.send({
      type: 'hub:register',
      name: this.name,
      region: this.region,
      labels: this.labels,
      capabilities: this.capabilities,
    });
  }

  /**
   * Handle successful registration
   */
  private handleRegistered(hubId: string): void {
    this.hubId = hubId;
    this.state = 'connected';
    logger.info(`Registered as hub ${hubId}`);

    // Start health reporting
    this.startHealthReporting();

    this.events.onConnected?.(hubId);
  }

  /**
   * Handle task assignment from backend
   */
  private handleTaskAssign(message: BackendToHubMessage & { type: 'hub:task:assign' }): void {
    const { taskId, taskType, payload, capability } = message;
    logger.info(`Received task ${taskId} (${taskType})`);

    this.events.onTaskAssigned?.(taskId, taskType, payload, capability);
  }

  /**
   * Handle task cancellation
   */
  private handleTaskCancel(message: BackendToHubMessage & { type: 'hub:task:cancel' }): void {
    const { taskId, reason } = message;
    logger.info(`Task ${taskId} cancelled: ${reason || 'No reason'}`);

    this.events.onTaskCancelled?.(taskId, reason);
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(reason: string): void {
    this.stopHealthReporting();
    this.ws = null;

    const wasConnected = this.state === 'connected';
    this.state = 'disconnected';
    this.hubId = null;

    if (wasConnected) {
      this.events.onDisconnected?.(reason);
    }

    // Attempt reconnect
    this.scheduleReconnect();
  }

  /**
   * Start periodic health reporting
   */
  private startHealthReporting(): void {
    this.stopHealthReporting();

    // Send initial health report
    this.sendHealthReport();

    // Schedule periodic reports
    this.healthTimer = setInterval(() => {
      this.sendHealthReport();
    }, this.healthIntervalMs);
  }

  /**
   * Stop health reporting
   */
  private stopHealthReporting(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  /**
   * Send health report to backend
   */
  private sendHealthReport(): void {
    this.send({
      type: 'hub:health',
      status: this.hubStatus,
      connectedWorkers: this.connectedWorkers,
      activeWorkers: this.activeWorkers,
      avgLatencyMs: this.avgLatencyMs,
      capabilities: this.capabilities,
    });
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

    const delay = this.reconnectIntervalMs * Math.min(this.reconnectAttempts, 5);
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
  private send(message: HubToBackendMessage | Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

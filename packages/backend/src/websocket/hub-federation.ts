/**
 * Hub Federation Handler (Issue #263)
 *
 * WebSocket handler for external hubs to federate with the backend.
 * External hubs connect here to:
 * - Register themselves
 * - Report health status
 * - Receive task assignments
 * - Report task results
 */

import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { createLogger } from '@claude-mem/shared';
import type { HubStatus, WorkerCapability } from '@claude-mem/types';
import type { HubRegistry } from '../services/hub-registry.js';

const logger = createLogger('hub-federation');

// Messages from hub to backend
type HubToBackendMessage =
  | { type: 'auth'; token?: string }
  | { type: 'hub:register'; name: string; region?: string; labels?: Record<string, string>; capabilities?: string[] }
  | { type: 'hub:health'; status: HubStatus; connectedWorkers: number; activeWorkers: number; avgLatencyMs?: number; capabilities?: string[] }
  | { type: 'hub:task:complete'; taskId: string; result: unknown; processingTimeMs: number }
  | { type: 'hub:task:error'; taskId: string; error: string; retryable: boolean }
  | { type: 'hub:task:progress'; taskId: string; progress: number; message?: string }
  | { type: 'hub:shutdown'; reason?: string };

// Messages from backend to hub
type BackendToHubMessage =
  | { type: 'hub:registered'; hubId: string }
  | { type: 'hub:auth:success' }
  | { type: 'hub:auth:failed'; reason: string }
  | { type: 'hub:task:assign'; taskId: string; taskType: string; payload: unknown; capability: WorkerCapability }
  | { type: 'hub:task:cancel'; taskId: string; reason?: string }
  | { type: 'hub:heartbeat:ack' }
  | { type: 'backend:shutdown' };

// Connected hub info
interface ConnectedHub {
  id: string;
  ws: WebSocket;
  name: string;
  region?: string;
  labels?: Record<string, string>;
  capabilities: string[];
  status: HubStatus;
  connectedWorkers: number;
  activeWorkers: number;
  avgLatencyMs?: number;
  connectedAt: Date;
  lastHealthReport: Date;
  authenticated: boolean;
}

export interface HubFederationOptions {
  /** Token for hub authentication */
  hubToken?: string;
  /** Health check interval (ms) */
  healthCheckIntervalMs?: number;
  /** Max missed health reports before marking offline */
  maxMissedReports?: number;
}

export interface HubFederationEvents {
  onHubConnected?: (hub: ConnectedHub) => void;
  onHubDisconnected?: (hubId: string) => void;
  onTaskComplete?: (hubId: string, taskId: string, result: unknown, processingTimeMs: number) => void;
  onTaskError?: (hubId: string, taskId: string, error: string, retryable: boolean) => void;
  onTaskProgress?: (hubId: string, taskId: string, progress: number, message?: string) => void;
}

/**
 * Hub federation handler for the backend
 */
export class HubFederation {
  private wss: WebSocketServer | null = null;
  private hubs: Map<string, ConnectedHub> = new Map();
  private pendingAuth: Map<WebSocket, { timeout: NodeJS.Timeout }> = new Map();
  private healthCheckTimer: NodeJS.Timeout | null = null;

  private readonly hubToken: string;
  private readonly healthCheckIntervalMs: number;
  private readonly maxMissedReports: number;

  private hubRegistry: HubRegistry | null = null;
  private events: HubFederationEvents = {};

  constructor(options: HubFederationOptions = {}) {
    this.hubToken = options.hubToken || '';
    this.healthCheckIntervalMs = options.healthCheckIntervalMs || 60000;
    this.maxMissedReports = options.maxMissedReports || 3;
  }

  /**
   * Set hub registry for persistence
   */
  setHubRegistry(registry: HubRegistry): void {
    this.hubRegistry = registry;
  }

  /**
   * Set event handlers
   */
  on(events: HubFederationEvents): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * Attach to an HTTP server
   * Uses noServer mode to avoid conflicts with multiple WSS on same server
   */
  attach(server: Server, path = '/ws/hub'): void {
    this.wss = new WebSocketServer({
      noServer: true,
      // Disable perMessageDeflate to avoid RSV1 protocol errors
      perMessageDeflate: false,
    });

    // Handle upgrade events manually - route based on path
    server.on('upgrade', (request, socket, head) => {
      const pathname = request.url ? new URL(request.url, 'http://localhost').pathname : '';

      // Only handle our path
      if (pathname === path) {
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.wss!.emit('connection', ws, request);
        });
      }
      // Don't handle other paths - let other handlers deal with them
    });

    this.wss.on('connection', (ws) => {
      this.handleConnection(ws);
    });

    this.startHealthCheck();
    logger.info(`Hub federation attached at ${path}`);
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    logger.debug('New hub connection');

    // Set up auth timeout
    const authTimeout = setTimeout(() => {
      logger.warn('Hub auth timeout, closing connection');
      this.pendingAuth.delete(ws);
      ws.close(4001, 'Authentication timeout');
    }, 10000);

    this.pendingAuth.set(ws, { timeout: authTimeout });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as HubToBackendMessage;
        this.handleMessage(ws, message);
      } catch (error) {
        const err = error as Error;
        logger.error('Failed to parse hub message:', { message: err.message });
      }
    });

    ws.on('close', () => {
      this.handleClose(ws);
    });

    ws.on('error', (error) => {
      logger.error('Hub WebSocket error:', { message: error.message });
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(ws: WebSocket, message: HubToBackendMessage): void {
    switch (message.type) {
      case 'auth':
        this.handleAuth(ws, message.token);
        break;

      case 'hub:register':
        this.handleRegister(ws, message);
        break;

      case 'hub:health':
        this.handleHealth(ws, message);
        break;

      case 'hub:task:complete':
        this.handleTaskComplete(ws, message);
        break;

      case 'hub:task:error':
        this.handleTaskError(ws, message);
        break;

      case 'hub:task:progress':
        this.handleTaskProgress(ws, message);
        break;

      case 'hub:shutdown':
        this.handleHubShutdown(ws, message.reason);
        break;

      default:
        logger.debug(`Unknown hub message type: ${(message as { type: string }).type}`);
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

    if (this.hubToken && token !== this.hubToken) {
      logger.warn('Invalid hub token');
      this.sendToSocket(ws, { type: 'hub:auth:failed', reason: 'Invalid token' });
      clearTimeout(pending.timeout);
      this.pendingAuth.delete(ws);
      ws.close(4003, 'Invalid token');
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingAuth.delete(ws);
    this.sendToSocket(ws, { type: 'hub:auth:success' });
    logger.debug('Hub auth successful');
  }

  /**
   * Handle hub registration
   */
  private async handleRegister(
    ws: WebSocket,
    message: HubToBackendMessage & { type: 'hub:register' }
  ): Promise<void> {
    // Allow registration without auth if no token configured
    if (this.hubToken && this.pendingAuth.has(ws)) {
      logger.warn('Hub registration without auth');
      ws.close(4004, 'Authentication required');
      return;
    }

    // Clean up pending auth if present
    const pending = this.pendingAuth.get(ws);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingAuth.delete(ws);
    }

    const hubId = randomUUID();
    const hub: ConnectedHub = {
      id: hubId,
      ws,
      name: message.name,
      region: message.region,
      labels: message.labels,
      capabilities: message.capabilities || [],
      status: 'healthy',
      connectedWorkers: 0,
      activeWorkers: 0,
      connectedAt: new Date(),
      lastHealthReport: new Date(),
      authenticated: true,
    };

    this.hubs.set(hubId, hub);

    // Register in hub registry for persistence and routing
    if (this.hubRegistry) {
      try {
        await this.hubRegistry.registerHub({
          name: message.name,
          type: 'external',
          priority: 50, // Default priority for external hubs
          weight: 100,
          region: message.region,
          labels: message.labels,
        });
      } catch (error) {
        const err = error as Error;
        logger.warn(`Failed to persist hub registration: ${err.message}`);
      }
    }

    this.sendToSocket(ws, { type: 'hub:registered', hubId });
    logger.info(`Hub ${hubId} (${message.name}) registered`);

    this.events.onHubConnected?.(hub);
  }

  /**
   * Handle health report
   */
  private async handleHealth(
    ws: WebSocket,
    message: HubToBackendMessage & { type: 'hub:health' }
  ): Promise<void> {
    const hub = this.findHubBySocket(ws);
    if (!hub) {
      logger.warn('Health report from unknown hub');
      return;
    }

    hub.status = message.status;
    hub.connectedWorkers = message.connectedWorkers;
    hub.activeWorkers = message.activeWorkers;
    hub.avgLatencyMs = message.avgLatencyMs;
    hub.lastHealthReport = new Date();

    if (message.capabilities) {
      hub.capabilities = message.capabilities;
    }

    // Update hub registry
    if (this.hubRegistry) {
      try {
        await this.hubRegistry.updateHubHealth(hub.id, {
          status: message.status,
          connectedWorkers: message.connectedWorkers,
          activeWorkers: message.activeWorkers,
          avgLatencyMs: message.avgLatencyMs,
          capabilities: message.capabilities,
        });
      } catch (error) {
        const err = error as Error;
        logger.warn(`Failed to update hub health: ${err.message}`);
      }
    }

    this.sendToSocket(ws, { type: 'hub:heartbeat:ack' });
  }

  /**
   * Handle task completion
   */
  private handleTaskComplete(
    ws: WebSocket,
    message: HubToBackendMessage & { type: 'hub:task:complete' }
  ): void {
    const hub = this.findHubBySocket(ws);
    if (!hub) {
      logger.warn('Task complete from unknown hub');
      return;
    }

    this.events.onTaskComplete?.(
      hub.id,
      message.taskId,
      message.result,
      message.processingTimeMs
    );
  }

  /**
   * Handle task error
   */
  private handleTaskError(
    ws: WebSocket,
    message: HubToBackendMessage & { type: 'hub:task:error' }
  ): void {
    const hub = this.findHubBySocket(ws);
    if (!hub) {
      logger.warn('Task error from unknown hub');
      return;
    }

    this.events.onTaskError?.(
      hub.id,
      message.taskId,
      message.error,
      message.retryable
    );
  }

  /**
   * Handle task progress
   */
  private handleTaskProgress(
    ws: WebSocket,
    message: HubToBackendMessage & { type: 'hub:task:progress' }
  ): void {
    const hub = this.findHubBySocket(ws);
    if (!hub) {
      return;
    }

    this.events.onTaskProgress?.(
      hub.id,
      message.taskId,
      message.progress,
      message.message
    );
  }

  /**
   * Handle hub shutdown request
   */
  private async handleHubShutdown(ws: WebSocket, reason?: string): Promise<void> {
    const hub = this.findHubBySocket(ws);
    if (hub) {
      logger.info(`Hub ${hub.id} (${hub.name}) shutting down: ${reason || 'No reason'}`);

      // Mark as offline in registry
      if (this.hubRegistry) {
        try {
          await this.hubRegistry.updateHub(hub.id, { status: 'offline' });
        } catch (error) {
          const err = error as Error;
          logger.warn(`Failed to update hub status: ${err.message}`);
        }
      }

      ws.close(1000, 'Hub shutdown');
      this.hubs.delete(hub.id);
      this.events.onHubDisconnected?.(hub.id);
    }
  }

  /**
   * Handle WebSocket close
   */
  private async handleClose(ws: WebSocket): Promise<void> {
    // Clean up pending auth
    const pending = this.pendingAuth.get(ws);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingAuth.delete(ws);
    }

    // Find and remove hub
    for (const [hubId, hub] of this.hubs) {
      if (hub.ws === ws) {
        logger.info(`Hub ${hubId} (${hub.name}) disconnected`);

        // Mark as offline in registry
        if (this.hubRegistry) {
          try {
            await this.hubRegistry.updateHub(hubId, { status: 'offline' });
          } catch (error) {
            const err = error as Error;
            logger.warn(`Failed to update hub status: ${err.message}`);
          }
        }

        this.hubs.delete(hubId);
        this.events.onHubDisconnected?.(hubId);
        break;
      }
    }
  }

  /**
   * Find hub by WebSocket
   */
  private findHubBySocket(ws: WebSocket): ConnectedHub | null {
    for (const hub of this.hubs.values()) {
      if (hub.ws === ws) {
        return hub;
      }
    }
    return null;
  }

  /**
   * Start health check interval
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      const now = Date.now();
      const maxAge = this.healthCheckIntervalMs * this.maxMissedReports;

      for (const [hubId, hub] of this.hubs) {
        const age = now - hub.lastHealthReport.getTime();
        if (age > maxAge) {
          logger.warn(`Hub ${hubId} (${hub.name}) health timeout`);

          // Mark as unhealthy in registry
          if (this.hubRegistry) {
            try {
              await this.hubRegistry.updateHub(hubId, { status: 'unhealthy' });
            } catch (error) {
              const err = error as Error;
              logger.warn(`Failed to update hub status: ${err.message}`);
            }
          }

          hub.ws.close(4005, 'Health timeout');
          this.hubs.delete(hubId);
          this.events.onHubDisconnected?.(hubId);
        }
      }
    }, this.healthCheckIntervalMs);
  }

  /**
   * Assign a task to a specific hub
   */
  assignTask(
    hubId: string,
    taskId: string,
    taskType: string,
    payload: unknown,
    capability: WorkerCapability
  ): boolean {
    const hub = this.hubs.get(hubId);
    if (!hub || hub.status === 'offline') {
      return false;
    }

    this.sendToSocket(hub.ws, {
      type: 'hub:task:assign',
      taskId,
      taskType,
      payload,
      capability,
    });

    return true;
  }

  /**
   * Cancel a task on a hub
   */
  cancelTask(hubId: string, taskId: string, reason?: string): void {
    const hub = this.hubs.get(hubId);
    if (!hub) return;

    this.sendToSocket(hub.ws, {
      type: 'hub:task:cancel',
      taskId,
      reason,
    });
  }

  /**
   * Get all connected hubs
   */
  getHubs(): ConnectedHub[] {
    return Array.from(this.hubs.values());
  }

  /**
   * Get hub by ID
   */
  getHub(hubId: string): ConnectedHub | undefined {
    return this.hubs.get(hubId);
  }

  /**
   * Check if any hubs are connected
   */
  hasHubs(): boolean {
    return this.hubs.size > 0;
  }

  /**
   * Send message to socket
   */
  private sendToSocket(ws: WebSocket, message: BackendToHubMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Shutdown federation handler
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down hub federation...');

    // Stop health check
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Notify and disconnect all hubs
    for (const hub of this.hubs.values()) {
      this.sendToSocket(hub.ws, { type: 'backend:shutdown' });
      hub.ws.close(1001, 'Backend shutdown');
    }
    this.hubs.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    logger.info('Hub federation shutdown complete');
  }
}

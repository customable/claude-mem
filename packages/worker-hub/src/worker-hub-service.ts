/**
 * Worker Hub Service (Issue #263)
 *
 * Main orchestrator for a standalone worker hub.
 * - Accepts worker connections (HubServer)
 * - Federates with backend (FederationClient)
 * - Routes tasks between workers and backend
 */

import http from 'http';
import { createLogger, loadSettings, VERSION } from '@claude-mem/shared';
import type { WorkerCapability } from '@claude-mem/types';
import { HubServer, type ConnectedWorker } from './hub-server.js';
import { FederationClient } from './federation-client.js';

const logger = createLogger('worker-hub-service');

export interface WorkerHubServiceConfig {
  /** Port for worker connections */
  port?: number;
  /** Bind address */
  host?: string;
  /** Hub name (for display in backend) */
  name?: string;
  /** Hub region (for regional routing) */
  region?: string;
  /** Hub labels (for label-based routing) */
  labels?: Record<string, string>;
  /** Worker auth token (for workers connecting to this hub) */
  workerAuthToken?: string;
  /** Backend URL (for federation) */
  backendUrl?: string;
  /** Hub token (for authenticating with backend) */
  hubToken?: string;
  /** Enable federation (connect to backend) */
  federate?: boolean;
}

// Task tracking
interface PendingTask {
  taskId: string;
  taskType: string;
  payload: unknown;
  capability: WorkerCapability;
  workerId: string | null;
  startTime: number;
}

/**
 * Standalone worker hub service
 */
export class WorkerHubService {
  private readonly config: Required<Pick<WorkerHubServiceConfig, 'port' | 'host' | 'name' | 'federate'>> & WorkerHubServiceConfig;
  private server: http.Server | null = null;
  private hubServer: HubServer | null = null;
  private federationClient: FederationClient | null = null;
  private isRunning = false;

  // Track pending tasks
  private pendingTasks: Map<string, PendingTask> = new Map();

  // Latency tracking for health reports
  private latencyHistory: number[] = [];
  private readonly maxLatencyHistory = 100;

  constructor(config: WorkerHubServiceConfig = {}) {
    const settings = loadSettings();

    this.config = {
      port: config.port || parseInt(process.env.HUB_PORT || '37778', 10),
      host: config.host || process.env.HUB_HOST || '0.0.0.0',
      name: config.name || process.env.HUB_NAME || `Hub-${Math.random().toString(36).slice(2, 8)}`,
      region: config.region || process.env.HUB_REGION,
      labels: config.labels,
      workerAuthToken: config.workerAuthToken || settings.WORKER_AUTH_TOKEN,
      backendUrl: config.backendUrl,
      hubToken: config.hubToken || process.env.HUB_TOKEN,
      federate: config.federate ?? true,
    };
  }

  /**
   * Start the worker hub service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Worker hub service is already running');
      return;
    }

    this.isRunning = true;
    logger.info(`Starting worker hub service v${VERSION}`);
    logger.info(`Hub name: ${this.config.name}`);
    if (this.config.region) {
      logger.info(`Hub region: ${this.config.region}`);
    }

    try {
      // Create HTTP server
      this.server = http.createServer((req, res) => {
        // Simple health check endpoint
        if (req.url === '/health') {
          const health = this.getHealth();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(health));
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });

      // Initialize hub server for worker connections
      this.hubServer = new HubServer({
        authToken: this.config.workerAuthToken,
      });

      // Wire up hub server events
      this.hubServer.on({
        onWorkerConnected: this.handleWorkerConnected.bind(this),
        onWorkerDisconnected: this.handleWorkerDisconnected.bind(this),
        onTaskComplete: this.handleTaskComplete.bind(this),
        onTaskError: this.handleTaskError.bind(this),
        onTaskProgress: this.handleTaskProgress.bind(this),
      });

      // Attach hub server to HTTP server
      this.hubServer.attach(this.server, '/ws');

      // Start HTTP server
      await new Promise<void>((resolve, reject) => {
        this.server!.listen(this.config.port, this.config.host, () => {
          logger.info(`Hub server listening on ${this.config.host}:${this.config.port}`);
          resolve();
        });
        this.server!.on('error', reject);
      });

      // Initialize federation if enabled
      if (this.config.federate) {
        await this.initializeFederation();
      }

      // Setup signal handlers
      this.setupSignalHandlers();

    } catch (error) {
      const err = error as Error;
      logger.error('Failed to start worker hub service:', { message: err.message });
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Initialize federation with backend
   */
  private async initializeFederation(): Promise<void> {
    this.federationClient = new FederationClient({
      backendUrl: this.config.backendUrl,
      hubToken: this.config.hubToken,
      name: this.config.name,
      region: this.config.region,
      labels: this.config.labels,
      capabilities: this.getAggregatedCapabilities(),
    });

    // Wire up federation events
    this.federationClient.on({
      onConnected: (hubId) => {
        logger.info(`Federated with backend as hub ${hubId}`);
      },
      onDisconnected: (reason) => {
        logger.warn(`Lost federation: ${reason}`);
      },
      onTaskAssigned: this.handleFederatedTaskAssigned.bind(this),
      onTaskCancelled: this.handleFederatedTaskCancelled.bind(this),
      onError: (error) => {
        logger.error('Federation error:', { message: error.message });
      },
    });

    // Connect to backend
    this.federationClient.connect();
  }

  /**
   * Stop the worker hub service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    logger.info('Stopping worker hub service...');
    this.isRunning = false;

    // Disconnect from backend
    if (this.federationClient) {
      this.federationClient.disconnect('Hub shutdown');
      this.federationClient = null;
    }

    // Shutdown hub server
    if (this.hubServer) {
      await this.hubServer.shutdown();
      this.hubServer = null;
    }

    // Close HTTP server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }

    logger.info('Worker hub service stopped');
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  /**
   * Handle worker connection
   */
  private handleWorkerConnected(worker: ConnectedWorker): void {
    logger.info(`Worker ${worker.id} connected with capabilities: ${worker.capabilities.join(', ')}`);

    // Update federation health
    this.updateFederationHealth();
  }

  /**
   * Handle worker disconnection
   */
  private handleWorkerDisconnected(workerId: string): void {
    logger.info(`Worker ${workerId} disconnected`);

    // Check if worker had pending tasks
    for (const [taskId, task] of this.pendingTasks) {
      if (task.workerId === workerId) {
        logger.warn(`Task ${taskId} was assigned to disconnected worker ${workerId}`);

        // Report error to backend if federated
        if (this.federationClient) {
          this.federationClient.sendTaskError(
            taskId,
            'Worker disconnected',
            true // retryable
          );
        }

        this.pendingTasks.delete(taskId);
      }
    }

    // Update federation health
    this.updateFederationHealth();
  }

  /**
   * Handle task completion from worker
   */
  private handleTaskComplete(
    workerId: string,
    taskId: string,
    result: unknown,
    processingTimeMs: number
  ): void {
    const task = this.pendingTasks.get(taskId);
    if (!task) {
      logger.warn(`Task ${taskId} not found in pending tasks`);
      return;
    }

    this.pendingTasks.delete(taskId);

    // Track latency
    this.recordLatency(processingTimeMs);

    logger.info(`Task ${taskId} completed by worker ${workerId} in ${processingTimeMs}ms`);

    // Forward to backend if federated
    if (this.federationClient) {
      this.federationClient.sendTaskComplete(taskId, result, processingTimeMs);
    }
  }

  /**
   * Handle task error from worker
   */
  private handleTaskError(
    workerId: string,
    taskId: string,
    error: string,
    retryable: boolean
  ): void {
    const task = this.pendingTasks.get(taskId);
    if (!task) {
      logger.warn(`Task ${taskId} not found in pending tasks`);
      return;
    }

    this.pendingTasks.delete(taskId);

    logger.warn(`Task ${taskId} failed on worker ${workerId}: ${error}`);

    // Forward to backend if federated
    if (this.federationClient) {
      this.federationClient.sendTaskError(taskId, error, retryable);
    }
  }

  /**
   * Handle task progress from worker
   */
  private handleTaskProgress(
    workerId: string,
    taskId: string,
    progress: number,
    message?: string
  ): void {
    // Forward to backend if federated
    if (this.federationClient) {
      this.federationClient.sendTaskProgress(taskId, progress, message);
    }
  }

  /**
   * Handle task assigned by backend (federation)
   */
  private handleFederatedTaskAssigned(
    taskId: string,
    taskType: string,
    payload: unknown,
    capability: WorkerCapability
  ): void {
    if (!this.hubServer) {
      logger.error('Hub server not initialized');
      this.federationClient?.sendTaskError(taskId, 'Hub server not ready', true);
      return;
    }

    // Find available worker
    const worker = this.hubServer.findAvailableWorker(capability);
    if (!worker) {
      logger.warn(`No available worker for capability: ${capability}`);
      this.federationClient?.sendTaskError(taskId, `No worker available for ${capability}`, true);
      return;
    }

    // Track task
    this.pendingTasks.set(taskId, {
      taskId,
      taskType,
      payload,
      capability,
      workerId: worker.id,
      startTime: Date.now(),
    });

    // Assign to worker
    const success = this.hubServer.assignTask(
      worker.id,
      taskId,
      taskType,
      payload,
      capability
    );

    if (!success) {
      this.pendingTasks.delete(taskId);
      this.federationClient?.sendTaskError(taskId, 'Failed to assign task to worker', true);
    } else {
      logger.debug(`Task ${taskId} assigned to worker ${worker.id}`);
    }
  }

  /**
   * Handle task cancelled by backend (federation)
   */
  private handleFederatedTaskCancelled(taskId: string, reason?: string): void {
    const task = this.pendingTasks.get(taskId);
    if (!task) {
      logger.warn(`Task ${taskId} not found for cancellation`);
      return;
    }

    logger.info(`Task ${taskId} cancelled: ${reason || 'No reason'}`);
    this.pendingTasks.delete(taskId);

    // TODO: Notify worker to cancel task
  }

  /**
   * Update federation health metrics
   */
  private updateFederationHealth(): void {
    if (!this.federationClient || !this.hubServer) return;

    this.federationClient.updateHealth(
      this.hubServer.getWorkerCount(),
      this.hubServer.getActiveWorkerCount(),
      this.getAverageLatency(),
      this.getAggregatedCapabilities()
    );
  }

  /**
   * Get aggregated capabilities from all workers
   */
  private getAggregatedCapabilities(): string[] {
    if (!this.hubServer) return [];

    const capabilities = new Set<string>();
    for (const worker of this.hubServer.getWorkers()) {
      for (const cap of worker.capabilities) {
        capabilities.add(cap);
      }
    }
    return Array.from(capabilities);
  }

  /**
   * Record task latency
   */
  private recordLatency(ms: number): void {
    this.latencyHistory.push(ms);
    if (this.latencyHistory.length > this.maxLatencyHistory) {
      this.latencyHistory.shift();
    }
  }

  /**
   * Get average latency
   */
  private getAverageLatency(): number | undefined {
    if (this.latencyHistory.length === 0) return undefined;
    const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencyHistory.length);
  }

  /**
   * Get hub health info
   */
  getHealth(): {
    name: string;
    region?: string;
    status: string;
    connectedWorkers: number;
    activeWorkers: number;
    pendingTasks: number;
    avgLatencyMs?: number;
    federationStatus: string;
    capabilities: string[];
  } {
    return {
      name: this.config.name,
      region: this.config.region,
      status: this.isRunning ? 'running' : 'stopped',
      connectedWorkers: this.hubServer?.getWorkerCount() || 0,
      activeWorkers: this.hubServer?.getActiveWorkerCount() || 0,
      pendingTasks: this.pendingTasks.size,
      avgLatencyMs: this.getAverageLatency(),
      federationStatus: this.federationClient?.getState() || 'disabled',
      capabilities: this.getAggregatedCapabilities(),
    };
  }
}

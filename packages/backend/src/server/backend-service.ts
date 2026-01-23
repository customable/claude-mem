/**
 * Backend Service
 *
 * Main orchestrator for the backend server.
 * Manages initialization, services, and shutdown.
 */

import http from 'http';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { createLogger, loadSettings, type Settings } from '@claude-mem/shared';
import {
  SQLiteConnection,
  SQLiteUnitOfWork,
  MigrationRunner,
  migrations,
} from '@claude-mem/database';
import { createApp, finalizeApp } from './app.js';
import { WorkerHub } from '../websocket/worker-hub.js';
import { TaskDispatcher } from '../websocket/task-dispatcher.js';
import { SSEBroadcaster, TaskService, SessionService, WorkerProcessManager } from '../services/index.js';
import {
  HealthRouter,
  HooksRouter,
  DataRouter,
  StreamRouter,
  WorkersRouter,
  LogsRouter,
  SettingsRouter,
  SearchRouter,
} from '../routes/index.js';

const logger = createLogger('backend');

export interface BackendServiceOptions {
  /** HTTP port */
  port?: number;
  /** Bind address */
  host?: string;
  /** Path to database file */
  dbPath?: string;
  /** Auth token for remote access */
  authToken?: string;
  /** Worker auth token */
  workerAuthToken?: string;
}

export class BackendService {
  private readonly options: Required<BackendServiceOptions>;
  private readonly settings: Settings;

  private server: http.Server | null = null;
  private app: ReturnType<typeof createApp> | null = null;
  private dbConnection: SQLiteConnection | null = null;
  private unitOfWork: SQLiteUnitOfWork | null = null;

  // Services
  private workerHub: WorkerHub | null = null;
  private taskDispatcher: TaskDispatcher | null = null;
  private sseBroadcaster: SSEBroadcaster | null = null;
  private taskService: TaskService | null = null;
  private sessionService: SessionService | null = null;
  private workerProcessManager: WorkerProcessManager | null = null;

  // Initialization state
  private coreReady = false;
  private fullyInitialized = false;
  private shutdownRequested = false;

  constructor(options: BackendServiceOptions = {}) {
    this.settings = loadSettings();

    this.options = {
      port: options.port ?? this.settings.BACKEND_PORT ?? 37777,
      host: options.host ?? this.settings.BACKEND_BIND ?? '127.0.0.1',
      dbPath: options.dbPath ?? this.settings.DATABASE_PATH,
      authToken: options.authToken ?? this.settings.REMOTE_TOKEN,
      workerAuthToken: options.workerAuthToken ?? this.settings.WORKER_AUTH_TOKEN,
    };

    // Setup signal handlers
    this.setupSignalHandlers();
  }

  /**
   * Start the backend service
   */
  async start(): Promise<void> {
    logger.info('Starting backend service...');

    try {
      // Create Express app
      this.app = createApp({
        authToken: this.options.authToken,
      });

      // Create HTTP server
      this.server = http.createServer(this.app);

      // Initialize WebSocket hub
      this.workerHub = new WorkerHub({
        authToken: this.options.workerAuthToken,
      });
      this.workerHub.attach(this.server, '/ws');

      // Wire up worker hub events to SSE broadcaster
      this.sseBroadcaster = new SSEBroadcaster();
      this.workerHub.onWorkerConnected = (worker) => {
        this.sseBroadcaster?.broadcastWorkerConnected(worker.id, worker.capabilities);
      };
      this.workerHub.onWorkerDisconnected = (workerId) => {
        this.sseBroadcaster?.broadcastWorkerDisconnected(workerId);
      };

      // Initialize worker process manager for spawning workers
      this.workerProcessManager = new WorkerProcessManager(
        this.options.host,
        this.options.port,
        this.options.workerAuthToken
      );

      // Wire up process manager events to SSE broadcaster
      this.workerProcessManager.on('worker:spawned', ({ id, pid }) => {
        this.sseBroadcaster?.broadcast({
          type: 'worker:spawned',
          data: { spawnedId: id, pid },
        });
      });
      this.workerProcessManager.on('worker:exited', ({ id, pid, code }) => {
        this.sseBroadcaster?.broadcast({
          type: 'worker:exited',
          data: { spawnedId: id, pid, code },
        });
      });

      // Start HTTP server immediately (health checks work before full init)
      await this.startHttpServer();

      // Background initialization
      await this.initializeInBackground();
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to start backend:', { message: err.message, stack: err.stack });
      throw error;
    }
  }

  /**
   * Start HTTP server
   */
  private async startHttpServer(): Promise<void> {
    if (!this.app) return;

    // Register early routes (health checks)
    this.app.use('/api', new HealthRouter({
      workerHub: this.workerHub!,
      taskQueue: { countByStatus: async () => ({
        pending: 0, assigned: 0, processing: 0, completed: 0, failed: 0, timeout: 0
      })} as any,
      getInitializationStatus: () => ({
        coreReady: this.coreReady,
        fullyInitialized: this.fullyInitialized,
      }),
      onRestart: () => this.restart(),
    }).router);

    // Stream route (SSE)
    this.app.use('/api/stream', new StreamRouter({
      sseBroadcaster: this.sseBroadcaster!,
    }).router);

    // Workers route
    this.app.use('/api/workers', new WorkersRouter({
      workerHub: this.workerHub!,
      workerProcessManager: this.workerProcessManager!,
    }).router);

    // Logs route
    this.app.use('/api/logs', new LogsRouter().router);

    // Settings route
    this.app.use('/api/settings', new SettingsRouter().router);

    // Serve static UI files (if available)
    this.serveStaticUI();

    // Start listening
    await new Promise<void>((resolve, reject) => {
      this.server!.listen(this.options.port, this.options.host, () => {
        logger.info(`HTTP server listening on ${this.options.host}:${this.options.port}`);
        resolve();
      });
      this.server!.on('error', reject);
    });
  }

  /**
   * Initialize services in background
   */
  private async initializeInBackground(): Promise<void> {
    try {
      // Initialize database
      logger.info('Initializing database...');
      this.dbConnection = new SQLiteConnection({
        type: 'sqlite',
        path: this.options.dbPath,
      });
      await this.dbConnection.initialize();

      // Run migrations
      const migrationRunner = new MigrationRunner(this.dbConnection.getRawConnection());
      migrationRunner.runAllMigrations();

      // Create unit of work
      this.unitOfWork = new SQLiteUnitOfWork(this.dbConnection.getRawConnection());

      // Core is ready - hooks can now proceed
      this.coreReady = true;
      logger.info('Core systems ready');

      // Initialize services
      this.taskService = new TaskService(
        this.unitOfWork.taskQueue,
        this.sseBroadcaster!,
        this.unitOfWork.observations,
        this.unitOfWork.sessions,
        this.unitOfWork.summaries
      );

      this.sessionService = new SessionService(
        this.unitOfWork.sessions,
        this.unitOfWork.observations,
        this.unitOfWork.summaries,
        this.unitOfWork.userPrompts,
        this.sseBroadcaster!,
        this.taskService
      );

      // Initialize task dispatcher
      this.taskDispatcher = new TaskDispatcher(
        this.workerHub!,
        this.unitOfWork.taskQueue,
        {
          sseBroadcaster: this.sseBroadcaster!,
          observations: this.unitOfWork.observations,
          sessions: this.unitOfWork.sessions,
          summaries: this.unitOfWork.summaries,
          taskService: this.taskService,
          claudemd: this.unitOfWork.claudemd,
        }
      );
      this.taskDispatcher.start();

      // Register remaining routes
      this.registerRoutes();

      // Fully initialized
      this.fullyInitialized = true;
      logger.info('Backend fully initialized');

      // Start periodic cleanup
      this.startPeriodicCleanup();

      // Auto-spawn workers if configured
      await this.autoSpawnWorkers();
    } catch (error) {
      const err = error as Error;
      logger.error('Background initialization failed:', { message: err.message, stack: err.stack });
      // Don't throw - server continues running with limited functionality
    }
  }

  /**
   * Register API routes after initialization
   */
  private registerRoutes(): void {
    if (!this.app) return;

    // Hooks routes
    this.app.use('/api/hooks', new HooksRouter({
      sessionService: this.sessionService!,
      taskService: this.taskService!,
    }).router);

    // Data routes
    this.app.use('/api/data', new DataRouter({
      sessionService: this.sessionService!,
      taskService: this.taskService!,
      observations: this.unitOfWork!.observations,
      summaries: this.unitOfWork!.summaries,
      sessions: this.unitOfWork!.sessions,
    }).router);

    // Search routes
    this.app.use('/api/search', new SearchRouter({
      observations: this.unitOfWork!.observations,
    }).router);

    // Finalize app (error handlers)
    finalizeApp(this.app);
  }

  /**
   * Serve static UI files if available
   */
  private serveStaticUI(): void {
    if (!this.app) return;

    // Try multiple possible UI locations
    const possiblePaths = [
      // Docker: UI built into backend image
      join(dirname(fileURLToPath(import.meta.url)), '../../ui/dist'),
      // Development: sibling package
      join(dirname(fileURLToPath(import.meta.url)), '../../../ui/dist'),
      // Plugin: bundled UI
      join(dirname(fileURLToPath(import.meta.url)), '../../../../ui/dist'),
    ];

    for (const uiPath of possiblePaths) {
      if (existsSync(uiPath)) {
        logger.info(`Serving UI from: ${uiPath}`);

        // Serve static files
        this.app.use(express.static(uiPath));

        // SPA fallback - serve index.html for all non-API routes
        this.app.get('*', (req, res, next) => {
          // Skip API routes
          if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
            return next();
          }
          res.sendFile(join(uiPath, 'index.html'));
        });

        return;
      }
    }

    logger.debug('No UI dist folder found, skipping static file serving');
  }

  /**
   * Start periodic cleanup tasks
   */
  private startPeriodicCleanup(): void {
    // Cleanup old tasks every 5 minutes
    setInterval(async () => {
      try {
        if (this.taskService) {
          await this.taskService.cleanup();
        }
        if (this.taskDispatcher) {
          await this.taskDispatcher.checkTimeouts();
        }
      } catch (error) {
        const err = error as Error;
        logger.error('Periodic cleanup error:', { message: err.message });
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Auto-spawn workers on startup if configured
   */
  private async autoSpawnWorkers(): Promise<void> {
    if (!this.settings.AUTO_SPAWN_WORKERS) {
      return;
    }

    if (!this.workerProcessManager?.canSpawnWorkers()) {
      logger.warn('Auto-spawn enabled but worker binary not found');
      return;
    }

    const count = this.settings.AUTO_SPAWN_WORKER_COUNT || 2;
    const providersStr = this.settings.AUTO_SPAWN_PROVIDERS || '';
    const providers = providersStr.split(',').filter(Boolean);

    logger.info(`Auto-spawning ${count} workers...`);

    for (let i = 0; i < count; i++) {
      try {
        // Cycle through providers if specified, otherwise use default
        const provider = providers.length > 0
          ? providers[i % providers.length]
          : undefined;

        const result = await this.workerProcessManager!.spawn({ provider });
        logger.info(`Auto-spawned worker ${result.id} (PID: ${result.pid}, provider: ${result.provider})`);
      } catch (error) {
        const err = error as Error;
        logger.error(`Failed to auto-spawn worker ${i + 1}:`, { message: err.message });
      }
    }
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.shutdownRequested) return;
      this.shutdownRequested = true;

      logger.info(`Received ${signal}, shutting down...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  /**
   * Stop the backend service
   */
  async stop(): Promise<void> {
    logger.info('Stopping backend service...');

    // Stop task dispatcher
    if (this.taskDispatcher) {
      this.taskDispatcher.stop();
    }

    // Terminate all spawned workers
    if (this.workerProcessManager) {
      await this.workerProcessManager.terminateAll();
    }

    // Close SSE connections
    if (this.sseBroadcaster) {
      this.sseBroadcaster.closeAll();
    }

    // Shutdown worker hub
    if (this.workerHub) {
      await this.workerHub.shutdown();
    }

    // Close HTTP server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
    }

    // Close database
    if (this.dbConnection) {
      await this.dbConnection.close();
    }

    logger.info('Backend service stopped');
  }

  /**
   * Get initialization status
   */
  getStatus(): { coreReady: boolean; fullyInitialized: boolean } {
    return {
      coreReady: this.coreReady,
      fullyInitialized: this.fullyInitialized,
    };
  }

  /**
   * Restart the backend service
   * Stops cleanly and exits with code 0 for process manager to restart
   */
  async restart(): Promise<void> {
    logger.info('Restart requested, shutting down for restart...');
    await this.stop();
    // Exit with code 0 - process managers like systemd or pm2 will restart
    // For development, the process will just stop
    process.exit(0);
  }
}

/**
 * Backend Service
 *
 * Main orchestrator for the backend server.
 * Manages initialization, services, and shutdown.
 */

import http from 'http';
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
import { SSEBroadcaster, TaskService, SessionService } from '../services/index.js';
import {
  HealthRouter,
  HooksRouter,
  DataRouter,
  StreamRouter,
  WorkersRouter,
  LogsRouter,
  SettingsRouter,
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

      // Start HTTP server immediately (health checks work before full init)
      await this.startHttpServer();

      // Background initialization
      this.initializeInBackground();
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
    }).router);

    // Stream route (SSE)
    this.app.use('/api/stream', new StreamRouter({
      sseBroadcaster: this.sseBroadcaster!,
    }).router);

    // Workers route
    this.app.use('/api/workers', new WorkersRouter({
      workerHub: this.workerHub!,
    }).router);

    // Logs route
    this.app.use('/api/logs', new LogsRouter().router);

    // Settings route
    this.app.use('/api/settings', new SettingsRouter().router);

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
        this.sseBroadcaster!
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
        this.unitOfWork.taskQueue
      );
      this.taskDispatcher.start();

      // Register remaining routes
      this.registerRoutes();

      // Fully initialized
      this.fullyInitialized = true;
      logger.info('Backend fully initialized');

      // Start periodic cleanup
      this.startPeriodicCleanup();
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
    }).router);

    // Finalize app (error handlers)
    finalizeApp(this.app);
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
}

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
import { mikroOrm } from '@claude-mem/database';
import type { IUnitOfWork } from '@claude-mem/types';
import { createApp, finalizeApp } from './app.js';
import { WorkerHub } from '../websocket/worker-hub.js';
import { TaskDispatcher } from '../websocket/task-dispatcher.js';
import { SSEBroadcaster, TaskService, SessionService, WorkerProcessManager, InsightsService, LazyProcessingService, DecisionService, SleepAgentService, SuggestionService, PluginManager, createPluginManager, ShareService, createShareService, CleanupService, createCleanupService } from '../services/index.js';
import {
  HealthRouter,
  HooksRouter,
  DataRouter,
  StreamRouter,
  WorkersRouter,
  LogsRouter,
  SettingsRouter,
  SearchRouter,
  ExportRouter,
  ImportRouter,
  InsightsRouter,
  LazyRouter,
  DecisionsRouter,
  SleepAgentRouter,
  SuggestionsRouter,
  PluginsRouter,
  ShareRouter,
  CleanupRouter,
  MetricsRouter,
} from '../routes/index.js';
import {
  expensiveLimiter,
  searchLimiter,
  workerSpawnLimiter,
  adminLimiter,
} from '../middleware/index.js';

const logger = createLogger('backend');

export interface BackendServiceOptions {
  /** HTTP port */
  port?: number;
  /** Bind address */
  host?: string;
  /** Path to database file (SQLite) */
  dbPath?: string;
  /** Auth token for remote access */
  authToken?: string;
  /** Worker auth token */
  workerAuthToken?: string;
  /** Database type: sqlite, postgresql, mysql */
  databaseType?: 'sqlite' | 'postgresql' | 'mysql';
  /** PostgreSQL/MySQL host */
  databaseHost?: string;
  /** PostgreSQL/MySQL port */
  databasePort?: number;
  /** PostgreSQL/MySQL username */
  databaseUser?: string;
  /** PostgreSQL/MySQL password */
  databasePassword?: string;
  /** PostgreSQL/MySQL database name */
  databaseName?: string;
}

export class BackendService {
  private readonly options: Required<Omit<BackendServiceOptions, 'databaseType' | 'databaseHost' | 'databasePort' | 'databaseUser' | 'databasePassword' | 'databaseName'>> & Partial<Pick<BackendServiceOptions, 'databaseType' | 'databaseHost' | 'databasePort' | 'databaseUser' | 'databasePassword' | 'databaseName'>>;
  private readonly settings: Settings;

  private server: http.Server | null = null;
  private app: ReturnType<typeof createApp> | null = null;
  private database: mikroOrm.MikroOrmDatabase | null = null;
  private unitOfWork: IUnitOfWork | null = null;

  // Services
  private workerHub: WorkerHub | null = null;
  private taskDispatcher: TaskDispatcher | null = null;
  private sseBroadcaster: SSEBroadcaster | null = null;
  private taskService: TaskService | null = null;
  private sessionService: SessionService | null = null;
  private workerProcessManager: WorkerProcessManager | null = null;
  private insightsService: InsightsService | null = null;
  private lazyProcessingService: LazyProcessingService | null = null;
  private decisionService: DecisionService | null = null;
  private sleepAgentService: SleepAgentService | null = null;
  private suggestionService: SuggestionService | null = null;
  private pluginManager: PluginManager | null = null;
  private shareService: ShareService | null = null;
  private cleanupService: CleanupService | null = null;

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
      // MikroORM database settings
      databaseType: options.databaseType ?? (this.settings.DATABASE_TYPE === 'postgres' ? 'postgresql' : 'sqlite'),
      databaseHost: options.databaseHost ?? this.settings.DATABASE_HOST,
      databasePort: options.databasePort ?? this.settings.DATABASE_PORT,
      databaseUser: options.databaseUser ?? this.settings.DATABASE_USER,
      databasePassword: options.databasePassword ?? this.settings.DATABASE_PASSWORD,
      databaseName: options.databaseName ?? this.settings.DATABASE_NAME,
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

      // Initialize SSE broadcaster (TaskDispatcher will wire up worker events)
      this.sseBroadcaster = new SSEBroadcaster();

      // Handle worker ready for termination (not overridden by TaskDispatcher)
      this.workerHub.onWorkerReadyForTermination = (workerId) => {
        // Execute pending termination when worker finishes its task
        this.workerProcessManager?.executePendingTermination(workerId).catch((err) => {
          logger.error('Failed to execute pending termination:', { message: (err as Error).message });
        });
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
      // Initialize MikroORM database
      const dbType = this.options.databaseType || 'sqlite';
      logger.info(`Initializing MikroORM database (type: ${dbType})...`);

      this.database = await mikroOrm.createMikroOrmDatabase({
        type: dbType,
        dbPath: dbType === 'sqlite' ? this.options.dbPath : undefined,
        host: this.options.databaseHost,
        port: this.options.databasePort,
        user: this.options.databaseUser,
        password: this.options.databasePassword,
        dbName: this.options.databaseName,
      });

      // Get unit of work
      this.unitOfWork = this.database.unitOfWork;

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

      this.insightsService = new InsightsService(
        this.unitOfWork.dailyStats,
        this.unitOfWork.technologyUsage,
        this.unitOfWork.achievements,
        this.unitOfWork.observations
      );

      // Initialize decision service for conflict detection
      this.decisionService = new DecisionService({
        uow: this.unitOfWork,
      });

      // Initialize lazy processing service
      this.lazyProcessingService = new LazyProcessingService({
        uow: this.unitOfWork,
        // processMessage can be wired up later for actual message processing
      });

      // Start scheduled batch processing if enabled
      this.lazyProcessingService.startScheduledProcessing();

      // Initialize sleep agent service for memory consolidation
      this.sleepAgentService = new SleepAgentService({
        uow: this.unitOfWork,
      });

      // Start scheduled consolidation if enabled
      this.sleepAgentService.startScheduled();

      // Initialize suggestion service for AI-powered memory suggestions
      this.suggestionService = new SuggestionService({
        observations: this.unitOfWork.observations,
      });

      // Initialize plugin manager and load plugins
      this.pluginManager = createPluginManager();
      await this.pluginManager.loadPlugins();

      // Initialize share service for memory sharing and collaboration
      this.shareService = createShareService({
        observations: this.unitOfWork.observations,
        summaries: this.unitOfWork.summaries,
        sessions: this.unitOfWork.sessions,
      });

      // Initialize cleanup service for process/memory leak prevention (Issue #101)
      this.cleanupService = createCleanupService({
        sessions: this.unitOfWork.sessions,
        taskQueue: this.unitOfWork.taskQueue,
        workerProcessManager: this.workerProcessManager!,
      });

      // Initialize task dispatcher
      this.taskDispatcher = new TaskDispatcher(
        this.workerHub!,
        this.unitOfWork.taskQueue,
        {
          sseBroadcaster: this.sseBroadcaster!,
          observations: this.unitOfWork.observations,
          sessions: this.unitOfWork.sessions,
          summaries: this.unitOfWork.summaries,
          documents: this.unitOfWork.documents,
          taskService: this.taskService,
          claudemd: this.unitOfWork.claudemd,
          codeSnippets: this.unitOfWork.codeSnippets,
          onWorkerLinked: (spawnedId, hubWorkerId) => {
            this.workerProcessManager?.linkToHubWorker(spawnedId, hubWorkerId);
          },
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

    // Apply specific rate limiters to expensive routes (Issue #205)
    this.app.use('/api/search', searchLimiter);
    this.app.use('/api/data/analytics', expensiveLimiter);
    this.app.use('/api/export', expensiveLimiter);
    this.app.use('/api/import', expensiveLimiter);
    this.app.use('/api/insights', expensiveLimiter);
    this.app.use('/api/sleep-agent', expensiveLimiter);
    this.app.use('/api/workers/spawn', workerSpawnLimiter);
    this.app.use('/api/admin', adminLimiter);
    this.app.use('/api/cleanup', adminLimiter);

    // Hooks routes
    this.app.use('/api/hooks', new HooksRouter({
      sessionService: this.sessionService!,
      taskService: this.taskService!,
      claudemd: this.unitOfWork!.claudemd,
    }).router);

    // Data routes
    this.app.use('/api/data', new DataRouter({
      sessionService: this.sessionService!,
      taskService: this.taskService!,
      observations: this.unitOfWork!.observations,
      summaries: this.unitOfWork!.summaries,
      sessions: this.unitOfWork!.sessions,
      documents: this.unitOfWork!.documents,
      userPrompts: this.unitOfWork!.userPrompts,
      codeSnippets: this.unitOfWork!.codeSnippets,
      observationLinks: this.unitOfWork!.observationLinks,
      observationTemplates: this.unitOfWork!.observationTemplates,
      projectSettings: this.unitOfWork!.projectSettings,
    }).router);

    // Search routes
    this.app.use('/api/search', new SearchRouter({
      observations: this.unitOfWork!.observations,
    }).router);

    // Export routes
    this.app.use('/api/export', new ExportRouter({
      sessionService: this.sessionService!,
      observations: this.unitOfWork!.observations,
      summaries: this.unitOfWork!.summaries,
      sessions: this.unitOfWork!.sessions,
    }).router);

    // Import routes
    this.app.use('/api/import', new ImportRouter({
      observations: this.unitOfWork!.observations,
      summaries: this.unitOfWork!.summaries,
      sessions: this.unitOfWork!.sessions,
    }).router);

    // Insights routes
    this.app.use('/api/insights', new InsightsRouter({
      insightsService: this.insightsService!,
    }).router);

    // Lazy mode routes
    this.app.use('/api/lazy', new LazyRouter({
      lazyService: this.lazyProcessingService!,
    }).router);

    // Decisions routes (conflict detection)
    this.app.use('/api/decisions', new DecisionsRouter({
      decisionService: this.decisionService!,
    }).router);

    // Sleep agent routes (memory consolidation)
    this.app.use('/api/sleep-agent', new SleepAgentRouter({
      sleepAgentService: this.sleepAgentService!,
    }).router);

    // Suggestions routes (AI-powered memory suggestions)
    this.app.use('/api/suggestions', new SuggestionsRouter({
      suggestionService: this.suggestionService!,
    }).router);

    // Plugins routes (custom observation processors)
    this.app.use('/api/plugins', new PluginsRouter({
      pluginManager: this.pluginManager!,
    }).router);

    // Share routes (memory sharing and collaboration)
    this.app.use('/api/share', new ShareRouter({
      shareService: this.shareService!,
    }).router);

    // Cleanup routes (process/memory leak prevention - Issue #101)
    this.app.use('/api/cleanup', new CleanupRouter({
      cleanupService: this.cleanupService!,
    }).router);

    // Metrics endpoint (Issue #209)
    this.app.use('/metrics', new MetricsRouter({
      unitOfWork: this.unitOfWork!,
      workerHub: this.workerHub!,
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
        // Express 5 requires named wildcards
        this.app.get('/{*path}', (req, res, next) => {
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
    // Start automatic cleanup service (handles stale sessions, orphaned workers - Issue #101)
    if (this.cleanupService) {
      this.cleanupService.startAutoCleanup();
    }

    // Task-specific cleanup every 5 minutes
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

    // Stop cleanup service
    if (this.cleanupService) {
      this.cleanupService.stopAutoCleanup();
    }

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
    if (this.database) {
      await this.database.close();
    }

    logger.info('Backend service stopped');
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

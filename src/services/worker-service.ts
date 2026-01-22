/**
 * Worker Service - Slim Orchestrator
 *
 * Refactored from 2000-line monolith to ~300-line orchestrator.
 * Delegates to specialized modules:
 * - src/services/server/ - HTTP server, middleware, error handling
 * - src/services/infrastructure/ - Process management, health monitoring, shutdown
 * - src/services/integrations/ - IDE integrations (Cursor)
 * - src/services/worker/ - Business logic, routes, agents
 */

import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { getWorkerPort, getWorkerHost, getWorkerBind } from '../shared/worker-utils.js';
import { logger } from '../utils/logger.js';

// Version injected at build time by esbuild define
declare const __DEFAULT_PACKAGE_VERSION__: string;
const packageVersion = typeof __DEFAULT_PACKAGE_VERSION__ !== 'undefined' ? __DEFAULT_PACKAGE_VERSION__ : '0.0.0-dev';

// Infrastructure imports
import {
  writePidFile,
  readPidFile,
  removePidFile,
  getPlatformTimeout,
  cleanupOrphanedProcesses,
  cleanupOrphanedClaudeProcesses,
  spawnDaemon,
  createSignalHandler
} from './infrastructure/ProcessManager.js';
import {
  isPortInUse,
  waitForHealth,
  waitForPortFree,
  httpShutdown,
  checkVersionMatch
} from './infrastructure/HealthMonitor.js';
import { performGracefulShutdown } from './infrastructure/GracefulShutdown.js';

// Server imports
import { Server } from './server/Server.js';

// Integration imports
import {
  updateCursorContextForProject,
  handleCursorCommand
} from './integrations/CursorHooksInstaller.js';

// Service layer imports
import { DatabaseManager } from './worker/DatabaseManager.js';
import { SessionManager } from './worker/SessionManager.js';
import { SSEBroadcaster } from './worker/SSEBroadcaster.js';
import { SDKAgent } from './worker/SDKAgent.js';
import { GeminiAgent, isGeminiSelected, isGeminiAvailable } from './worker/GeminiAgent.js';
import { OpenRouterAgent, isOpenRouterSelected, isOpenRouterAvailable } from './worker/OpenRouterAgent.js';
import { MistralAgent, isMistralSelected, isMistralAvailable } from './worker/MistralAgent.js';
import { PaginationHelper } from './worker/PaginationHelper.js';
import { SettingsManager } from './worker/SettingsManager.js';
import { SearchManager } from './worker/SearchManager.js';
import { FormattingService } from './worker/FormattingService.js';
import { TimelineService } from './worker/TimelineService.js';
import { SessionEventBroadcaster } from './worker/events/SessionEventBroadcaster.js';

// HTTP route handlers
import { ViewerRoutes } from './worker/http/routes/ViewerRoutes.js';
import { SessionRoutes } from './worker/http/routes/SessionRoutes.js';
import { DataRoutes } from './worker/http/routes/DataRoutes.js';
import { SearchRoutes } from './worker/http/routes/SearchRoutes.js';
import { SettingsRoutes } from './worker/http/routes/SettingsRoutes.js';
import { LogsRoutes } from './worker/http/routes/LogsRoutes.js';
import { MemoryRoutes } from './worker/http/routes/MemoryRoutes.js';

/**
 * Build JSON status output for hook framework communication.
 * This is a pure function extracted for testability.
 *
 * @param status - 'ready' for successful startup, 'error' for failures
 * @param message - Optional error message (only included when provided)
 * @returns JSON object with continue, suppressOutput, status, and optionally message
 */
export interface StatusOutput {
  continue: true;
  suppressOutput: true;
  status: 'ready' | 'error';
  message?: string;
}

export function buildStatusOutput(status: 'ready' | 'error', message?: string): StatusOutput {
  return {
    continue: true,
    suppressOutput: true,
    status,
    ...(message && { message })
  };
}

export class WorkerService {
  private server: Server;
  private startTime: number = Date.now();
  private mcpClient: Client;

  // Initialization flags
  private coreReady: boolean = false;  // Database + SearchManager ready (hooks can proceed)
  private mcpReady: boolean = false;   // Full MCP ready (diagnostics)
  private initializationCompleteFlag: boolean = false;
  private isShuttingDown: boolean = false;

  // Service layer
  private dbManager: DatabaseManager;
  private sessionManager: SessionManager;
  private sseBroadcaster: SSEBroadcaster;
  private sdkAgent: SDKAgent;
  private geminiAgent: GeminiAgent;
  private openRouterAgent: OpenRouterAgent;
  private mistralAgent: MistralAgent;
  private paginationHelper: PaginationHelper;
  private settingsManager: SettingsManager;
  private sessionEventBroadcaster: SessionEventBroadcaster;

  // Route handlers
  private searchRoutes: SearchRoutes | null = null;

  // Initialization tracking
  private initializationComplete: Promise<void>;
  private resolveInitialization!: () => void;

  // Periodic cleanup interval (zombie process cleanup every 15 minutes)
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Initialize the promise that will resolve when background initialization completes
    this.initializationComplete = new Promise((resolve) => {
      this.resolveInitialization = resolve;
    });

    // Initialize service layer
    this.dbManager = new DatabaseManager();
    this.sessionManager = new SessionManager(this.dbManager);
    this.sseBroadcaster = new SSEBroadcaster();
    this.sdkAgent = new SDKAgent(this.dbManager, this.sessionManager);
    this.geminiAgent = new GeminiAgent(this.dbManager, this.sessionManager);
    this.openRouterAgent = new OpenRouterAgent(this.dbManager, this.sessionManager);
    this.mistralAgent = new MistralAgent(this.dbManager, this.sessionManager);

    this.paginationHelper = new PaginationHelper(this.dbManager);
    this.settingsManager = new SettingsManager(this.dbManager);
    this.sessionEventBroadcaster = new SessionEventBroadcaster(this.sseBroadcaster, this);

    // Set callback for when sessions are deleted
    this.sessionManager.setOnSessionDeleted(() => {
      this.broadcastProcessingStatus();
    });

    // Initialize MCP client
    // Empty capabilities object: this client only calls tools, doesn't expose any
    this.mcpClient = new Client({
      name: 'worker-search-proxy',
      version: packageVersion
    }, { capabilities: {} });

    // Initialize HTTP server with core routes
    this.server = new Server({
      getInitializationComplete: () => this.initializationCompleteFlag,
      getCoreReady: () => this.coreReady,
      getMcpReady: () => this.mcpReady,
      onShutdown: () => this.shutdown(),
      onRestart: () => this.shutdown()
    });

    // Register route handlers
    this.registerRoutes();

    // Register signal handlers early to ensure cleanup even if start() hasn't completed
    this.registerSignalHandlers();
  }

  /**
   * Register signal handlers for graceful shutdown
   */
  private registerSignalHandlers(): void {
    const shutdownRef = { value: this.isShuttingDown };
    const handler = createSignalHandler(() => this.shutdown(), shutdownRef);

    process.on('SIGTERM', () => {
      this.isShuttingDown = shutdownRef.value;
      handler('SIGTERM');
    });
    process.on('SIGINT', () => {
      this.isShuttingDown = shutdownRef.value;
      handler('SIGINT');
    });
  }

  /**
   * Register all route handlers with the server
   */
  private registerRoutes(): void {
    // Standard routes
    this.server.registerRoutes(new ViewerRoutes(this.sseBroadcaster, this.dbManager, this.sessionManager));
    this.server.registerRoutes(new SessionRoutes(this.sessionManager, this.dbManager, this.sdkAgent, this.geminiAgent, this.openRouterAgent, this.mistralAgent, this.sessionEventBroadcaster, this));
    this.server.registerRoutes(new DataRoutes(this.paginationHelper, this.dbManager, this.sessionManager, this.sseBroadcaster, this, this.startTime));
    this.server.registerRoutes(new SettingsRoutes(this.settingsManager));
    this.server.registerRoutes(new LogsRoutes());
    this.server.registerRoutes(new MemoryRoutes(this.dbManager, 'claude-mem'));

    // Early handler for /api/context/inject to avoid 404 during startup
    this.server.app.get('/api/context/inject', async (req, res, next) => {
      const timeoutMs = 300000; // 5 minute timeout for slow systems
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Initialization timeout')), timeoutMs)
      );

      await Promise.race([this.initializationComplete, timeoutPromise]);

      if (!this.searchRoutes) {
        res.status(503).json({ error: 'Search routes not initialized' });
        return;
      }

      next(); // Delegate to SearchRoutes handler
    });
  }

  /**
   * Start the worker service
   */
  async start(): Promise<void> {
    const port = getWorkerPort();
    const bind = getWorkerBind();  // Server bind address (0.0.0.0 for network access)
    const host = getWorkerHost();  // Client connection address (for logging)

    // Start HTTP server FIRST - make port available immediately
    await this.server.listen(port, bind);
    logger.info('SYSTEM', 'Worker started', { bind, host, port, pid: process.pid });

    // Do slow initialization in background (non-blocking)
    this.initializeBackground().catch((error) => {
      logger.error('SYSTEM', 'Background initialization failed', {}, error as Error);
    });
  }

  /**
   * Background initialization - runs after HTTP server is listening
   */
  private async initializeBackground(): Promise<void> {
    try {
      // Clean up orphaned processes from previous sessions
      await cleanupOrphanedProcesses();
      await cleanupOrphanedClaudeProcesses();

      // Load mode configuration
      const { ModeManager } = await import('./domain/ModeManager.js');
      const { SettingsDefaultsManager } = await import('../shared/SettingsDefaultsManager.js');
      const { USER_SETTINGS_PATH } = await import('../shared/paths.js');

      const settings = SettingsDefaultsManager.loadFromFile(USER_SETTINGS_PATH);
      const modeId = settings.CLAUDE_MEM_MODE;
      ModeManager.getInstance().loadMode(modeId);
      logger.info('SYSTEM', `Mode loaded: ${modeId}`);

      await this.dbManager.initialize();

      // Recover stuck messages from previous crashes
      const { PendingMessageStore } = await import('./sqlite/PendingMessageStore.js');
      const pendingStore = new PendingMessageStore(this.dbManager.getSessionStore().db, 3);
      const STUCK_THRESHOLD_MS = 5 * 60 * 1000;
      const resetCount = pendingStore.resetStuckMessages(STUCK_THRESHOLD_MS);
      if (resetCount > 0) {
        logger.info('SYSTEM', `Recovered ${resetCount} stuck messages from previous session`, { thresholdMinutes: 5 });
      }

      // Initialize search services
      const formattingService = new FormattingService();
      const timelineService = new TimelineService();
      const searchManager = new SearchManager(
        this.dbManager.getSessionSearch(),
        this.dbManager.getSessionStore(),
        this.dbManager.getVectorSync(),
        formattingService,
        timelineService
      );
      this.searchRoutes = new SearchRoutes(searchManager);
      this.server.registerRoutes(this.searchRoutes);
      logger.info('WORKER', 'SearchManager initialized and search routes registered');

      // Core services (DB + SearchManager) are ready - hooks can now proceed
      this.coreReady = true;
      logger.info('SYSTEM', 'Core services ready (hooks can proceed)');

      // Connect to MCP server
      const mcpServerPath = path.join(__dirname, 'mcp-server.cjs');
      const transport = new StdioClientTransport({
        command: 'node',
        args: [mcpServerPath],
        env: process.env
      });

      const MCP_INIT_TIMEOUT_MS = 300000;
      const mcpConnectionPromise = this.mcpClient.connect(transport);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('MCP connection timeout after 5 minutes')), MCP_INIT_TIMEOUT_MS)
      );

      await Promise.race([mcpConnectionPromise, timeoutPromise]);
      this.mcpReady = true;
      logger.success('WORKER', 'Connected to MCP server');

      this.initializationCompleteFlag = true;
      this.resolveInitialization();
      logger.info('SYSTEM', 'Background initialization complete');

      // Auto-recover orphaned queues (fire-and-forget with error logging)
      this.processPendingQueues(50).then(result => {
        if (result.sessionsStarted > 0) {
          logger.info('SYSTEM', `Auto-recovered ${result.sessionsStarted} sessions with pending work`, {
            totalPending: result.totalPendingSessions,
            started: result.sessionsStarted,
            sessionIds: result.startedSessionIds
          });
        }
      }).catch(error => {
        logger.error('SYSTEM', 'Auto-recovery of pending queues failed', {}, error as Error);
      });

      // Start periodic cleanup for zombie/orphaned processes and stale sessions (every 5 minutes)
      // This catches processes that get re-parented to init/PID 1 after parent death
      // and cleans up in-memory sessions that have gone stale
      const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
      const STALE_SESSION_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
      this.cleanupInterval = setInterval(async () => {
        try {
          // Cleanup stale in-memory sessions (no activity for 30 minutes)
          const staleSessions = await this.sessionManager.cleanupStaleSessions(STALE_SESSION_THRESHOLD_MS);
          if (staleSessions > 0) {
            logger.info('SYSTEM', `Periodic cleanup: removed ${staleSessions} stale sessions`);
          }

          // Cleanup orphaned OS processes
          await cleanupOrphanedProcesses();
          await cleanupOrphanedClaudeProcesses();
          logger.debug('SYSTEM', 'Periodic cleanup completed');
        } catch (error) {
          logger.error('SYSTEM', 'Periodic cleanup failed', {}, error as Error);
        }
      }, CLEANUP_INTERVAL_MS);
      logger.info('SYSTEM', 'Started periodic cleanup (every 5 minutes)');
    } catch (error) {
      logger.error('SYSTEM', 'Background initialization failed', {}, error as Error);
      throw error;
    }
  }

  /**
   * Get the appropriate agent based on provider settings
   * Same logic as SessionRoutes.getActiveAgent() for consistency
   */
  private getActiveAgent(): SDKAgent | GeminiAgent | OpenRouterAgent | MistralAgent {
    if (isMistralSelected() && isMistralAvailable()) {
      return this.mistralAgent;
    }
    if (isOpenRouterSelected() && isOpenRouterAvailable()) {
      return this.openRouterAgent;
    }
    if (isGeminiSelected() && isGeminiAvailable()) {
      return this.geminiAgent;
    }
    return this.sdkAgent;
  }

  /**
   * Start a session processor
   */
  private startSessionProcessor(
    session: ReturnType<typeof this.sessionManager.getSession>,
    source: string
  ): void {
    if (!session) return;

    // CRITICAL: Reset AbortController if it was previously aborted
    // This prevents infinite "Generator aborted" loops when restarting sessions
    if (session.abortController.signal.aborted) {
      session.abortController = new AbortController();
      logger.debug('SYSTEM', 'Reset AbortController for session restart', { sessionId: session.sessionDbId });
    }

    const sid = session.sessionDbId;
    const agent = this.getActiveAgent();
    const providerName = agent.constructor.name;

    logger.info('SYSTEM', `Starting generator (${source}) using ${providerName}`, { sessionId: sid });

    session.generatorPromise = agent.startSession(session, this)
      .catch(error => {
        logger.error('SDK', 'Session generator failed', {
          sessionId: session.sessionDbId,
          project: session.project,
          provider: providerName
        }, error as Error);
      })
      .finally(() => {
        session.generatorPromise = null;
        this.broadcastProcessingStatus();
      });
  }

  /**
   * Process pending session queues
   */
  async processPendingQueues(sessionLimit: number = 10): Promise<{
    totalPendingSessions: number;
    sessionsStarted: number;
    sessionsSkipped: number;
    startedSessionIds: number[];
  }> {
    const { PendingMessageStore } = await import('./sqlite/PendingMessageStore.js');
    const pendingStore = new PendingMessageStore(this.dbManager.getSessionStore().db, 3);
    const sessionStore = this.dbManager.getSessionStore();

    // Clean up stale 'active' sessions before processing
    // Sessions older than 30 minutes without activity are likely orphaned
    const staleThresholdMs = 30 * 60 * 1000; // 30 minutes
    const staleThreshold = Date.now() - staleThresholdMs;

    try {
      // First, get the IDs of stale sessions before updating them
      const staleSessionIds = sessionStore.db.prepare(`
        SELECT id FROM sdk_sessions
        WHERE status = 'active' AND started_at_epoch < ?
      `).all(staleThreshold) as { id: number }[];

      if (staleSessionIds.length > 0) {
        const ids = staleSessionIds.map(r => r.id);
        const placeholders = ids.map(() => '?').join(',');

        // Mark the stale sessions as failed
        sessionStore.db.prepare(`
          UPDATE sdk_sessions
          SET status = 'failed', completed_at_epoch = ?
          WHERE id IN (${placeholders})
        `).run(Date.now(), ...ids);

        logger.info('SYSTEM', `Marked ${ids.length} stale sessions as failed`);

        // Only mark pending messages for these specific stale sessions as failed
        const msgResult = sessionStore.db.prepare(`
          UPDATE pending_messages
          SET status = 'failed', failed_at_epoch = ?
          WHERE status = 'pending'
          AND session_db_id IN (${placeholders})
        `).run(Date.now(), ...ids);

        if (msgResult.changes > 0) {
          logger.info('SYSTEM', `Marked ${msgResult.changes} pending messages from stale sessions as failed`);
        }
      }
    } catch (error) {
      logger.error('SYSTEM', 'Failed to clean up stale sessions', {}, error as Error);
    }

    const orphanedSessionIds = pendingStore.getSessionsWithPendingMessages();

    const result = {
      totalPendingSessions: orphanedSessionIds.length,
      sessionsStarted: 0,
      sessionsSkipped: 0,
      startedSessionIds: [] as number[]
    };

    if (orphanedSessionIds.length === 0) return result;

    logger.info('SYSTEM', `Processing up to ${sessionLimit} of ${orphanedSessionIds.length} pending session queues`);

    for (const sessionDbId of orphanedSessionIds) {
      if (result.sessionsStarted >= sessionLimit) break;

      try {
        const existingSession = this.sessionManager.getSession(sessionDbId);
        if (existingSession?.generatorPromise) {
          result.sessionsSkipped++;
          continue;
        }

        const session = this.sessionManager.initializeSession(sessionDbId);
        logger.info('SYSTEM', `Starting processor for session ${sessionDbId}`, {
          project: session.project,
          pendingCount: pendingStore.getPendingCount(sessionDbId)
        });

        this.startSessionProcessor(session, 'startup-recovery');
        result.sessionsStarted++;
        result.startedSessionIds.push(sessionDbId);

        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.error('SYSTEM', `Failed to process session ${sessionDbId}`, {}, error as Error);
        result.sessionsSkipped++;
      }
    }

    return result;
  }

  /**
   * Shutdown the worker service
   */
  async shutdown(): Promise<void> {
    // Stop periodic cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('SYSTEM', 'Stopped periodic orphan cleanup');
    }

    await performGracefulShutdown({
      server: this.server.getHttpServer(),
      sessionManager: this.sessionManager,
      mcpClient: this.mcpClient,
      dbManager: this.dbManager
    });
  }

  /**
   * Broadcast processing status change to SSE clients
   */
  broadcastProcessingStatus(): void {
    const isProcessing = this.sessionManager.isAnySessionProcessing();
    const queueDepth = this.sessionManager.getTotalActiveWork();
    const activeSessions = this.sessionManager.getActiveSessionCount();

    logger.info('WORKER', 'Broadcasting processing status', {
      isProcessing,
      queueDepth,
      activeSessions
    });

    this.sseBroadcaster.broadcast({
      type: 'processing_status',
      isProcessing,
      queueDepth
    });
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const command = process.argv[2];
  const port = getWorkerPort();

  // Helper for JSON status output in 'start' command
  // Exit code 0 ensures Windows Terminal doesn't keep tabs open
  function exitWithStatus(status: 'ready' | 'error', message?: string): never {
    const output = buildStatusOutput(status, message);
    console.log(JSON.stringify(output));
    process.exit(0);
  }

  switch (command) {
    case 'start': {
      if (await waitForHealth(port, 1000)) {
        const versionCheck = await checkVersionMatch(port);
        if (!versionCheck.matches) {
          logger.info('SYSTEM', 'Worker version mismatch detected - auto-restarting', {
            pluginVersion: versionCheck.pluginVersion,
            workerVersion: versionCheck.workerVersion
          });

          await httpShutdown(port);
          const freed = await waitForPortFree(port, getPlatformTimeout(15000));
          if (!freed) {
            logger.error('SYSTEM', 'Port did not free up after shutdown for version mismatch restart', { port });
            exitWithStatus('error', 'Port did not free after version mismatch restart');
          }
          removePidFile();
        } else {
          logger.info('SYSTEM', 'Worker already running and healthy');
          exitWithStatus('ready');
        }
      }

      const portInUse = await isPortInUse(port);
      if (portInUse) {
        logger.info('SYSTEM', 'Port in use, waiting for worker to become healthy');
        const healthy = await waitForHealth(port, getPlatformTimeout(15000));
        if (healthy) {
          logger.info('SYSTEM', 'Worker is now healthy');
          exitWithStatus('ready');
        }
        logger.error('SYSTEM', 'Port in use but worker not responding to health checks');
        exitWithStatus('error', 'Port in use but worker not responding');
      }

      logger.info('SYSTEM', 'Starting worker daemon');
      const pid = spawnDaemon(__filename, port);
      if (pid === undefined) {
        logger.error('SYSTEM', 'Failed to spawn worker daemon');
        exitWithStatus('error', 'Failed to spawn worker daemon');
      }

      writePidFile({ pid, port, startedAt: new Date().toISOString() });

      const healthy = await waitForHealth(port, getPlatformTimeout(30000));
      if (!healthy) {
        removePidFile();
        logger.error('SYSTEM', 'Worker failed to start (health check timeout)');
        exitWithStatus('error', 'Worker failed to start (health check timeout)');
      }

      logger.info('SYSTEM', 'Worker started successfully');
      exitWithStatus('ready');
    }

    case 'stop': {
      await httpShutdown(port);
      const freed = await waitForPortFree(port, getPlatformTimeout(15000));
      if (!freed) {
        logger.warn('SYSTEM', 'Port did not free up after shutdown', { port });
      }
      removePidFile();
      logger.info('SYSTEM', 'Worker stopped successfully');
      process.exit(0);
    }

    case 'restart': {
      logger.info('SYSTEM', 'Restarting worker');
      await httpShutdown(port);
      const freed = await waitForPortFree(port, getPlatformTimeout(15000));
      if (!freed) {
        logger.error('SYSTEM', 'Port did not free up after shutdown, aborting restart', { port });
        // Exit gracefully: Windows Terminal won't keep tab open on exit 0
        // The wrapper/plugin will handle restart logic if needed
        process.exit(0);
      }
      removePidFile();

      const pid = spawnDaemon(__filename, port);
      if (pid === undefined) {
        logger.error('SYSTEM', 'Failed to spawn worker daemon during restart');
        // Exit gracefully: Windows Terminal won't keep tab open on exit 0
        // The wrapper/plugin will handle restart logic if needed
        process.exit(0);
      }

      writePidFile({ pid, port, startedAt: new Date().toISOString() });

      const healthy = await waitForHealth(port, getPlatformTimeout(30000));
      if (!healthy) {
        removePidFile();
        logger.error('SYSTEM', 'Worker failed to restart');
        // Exit gracefully: Windows Terminal won't keep tab open on exit 0
        // The wrapper/plugin will handle restart logic if needed
        process.exit(0);
      }

      logger.info('SYSTEM', 'Worker restarted successfully');
      process.exit(0);
    }

    case 'status': {
      const running = await isPortInUse(port);
      const pidInfo = readPidFile();
      if (running && pidInfo) {
        console.log('Worker is running');
        console.log(`  PID: ${pidInfo.pid}`);
        console.log(`  Port: ${pidInfo.port}`);
        console.log(`  Started: ${pidInfo.startedAt}`);
      } else {
        console.log('Worker is not running');
      }
      process.exit(0);
    }

    case 'cursor': {
      const subcommand = process.argv[3];
      const cursorResult = await handleCursorCommand(subcommand, process.argv.slice(4));
      process.exit(cursorResult);
    }

    case 'hook': {
      const platform = process.argv[3];
      const event = process.argv[4];
      if (!platform || !event) {
        console.error('Usage: claude-mem hook <platform> <event>');
        console.error('Platforms: claude-code, cursor, raw');
        console.error('Events: context, session-init, observation, summarize, user-message');
        process.exit(1);
      }
      const { hookCommand } = await import('../cli/hook-command.js');
      await hookCommand(platform, event);
      break;
    }

    case '--daemon':
    default: {
      const worker = new WorkerService();
      worker.start().catch((error) => {
        logger.failure('SYSTEM', 'Worker failed to start', {}, error as Error);
        removePidFile();
        // Exit gracefully: Windows Terminal won't keep tab open on exit 0
        // The wrapper/plugin will handle restart logic if needed
        process.exit(0);
      });
    }
  }
}

// Check if running as main module in both ESM and CommonJS
const isMainModule = typeof require !== 'undefined' && typeof module !== 'undefined'
  ? require.main === module || !module.parent
  : import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('worker-service');

if (isMainModule) {
  main();
}

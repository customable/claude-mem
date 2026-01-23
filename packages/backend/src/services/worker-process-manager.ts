/**
 * Worker Process Manager
 *
 * Manages spawned worker child processes.
 * Tracks which workers were spawned by the backend vs connected externally.
 */

import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { createLogger, loadSettings } from '@claude-mem/shared';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const logger = createLogger('worker-process-manager');

export interface SpawnedWorker {
  id: string;
  process: ChildProcess;
  pid: number;
  spawnedAt: number;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed';
  exitCode?: number;
  connectedWorkerId?: string;
  provider?: string;
}

export interface SpawnedWorkerInfo {
  id: string;
  pid: number;
  status: string;
  spawnedAt: number;
  connectedWorkerId?: string;
  provider?: string;
  pendingTermination?: boolean;
}

export interface SpawnOptions {
  provider?: string; // Override AI_PROVIDER for this worker
}

export interface WorkerProcessManagerEvents {
  'worker:spawned': { id: string; pid: number };
  'worker:exited': { id: string; pid: number; code: number | null; signal: string | null };
  'worker:error': { id: string; error: string };
  'worker:log': { id: string; level: string; message: string };
}

export class WorkerProcessManager extends EventEmitter {
  private spawnedWorkers: Map<string, SpawnedWorker> = new Map();
  private pendingTerminations: Set<string> = new Set(); // Spawned IDs queued for termination
  private workerCounter = 0;
  private workerBinaryPath: string | null = null;

  constructor(
    private readonly backendHost: string,
    private readonly backendPort: number,
    private readonly authToken?: string
  ) {
    super();
    this.detectWorkerBinaryPath();
  }

  /**
   * Detect the worker binary path
   */
  private detectWorkerBinaryPath(): void {
    const settings = loadSettings();

    // Priority order for worker binary detection:
    // 1. Sibling package (development/monorepo)
    // 2. Bundled in backend dist
    // 3. Node modules
    const possiblePaths = [
      // Development: sibling package
      join(dirname(fileURLToPath(import.meta.url)), '../../../worker/dist/worker-service.js'),
      // Backend dist includes worker
      join(dirname(fileURLToPath(import.meta.url)), '../../worker/dist/worker-service.js'),
      // Plugin bundled
      join(dirname(fileURLToPath(import.meta.url)), '../../../../worker/dist/worker-service.js'),
      // Node modules
      join(process.cwd(), 'node_modules/@claude-mem/worker/dist/worker-service.js'),
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        this.workerBinaryPath = path;
        logger.debug(`Worker binary found at: ${path}`);
        return;
      }
    }

    logger.warn('Worker binary not found, spawning disabled');
  }

  /**
   * Check if spawning is available
   */
  canSpawnWorkers(): boolean {
    return this.workerBinaryPath !== null;
  }

  /**
   * Get reason why spawning might be unavailable
   */
  getSpawnUnavailableReason(): string | null {
    if (!this.workerBinaryPath) {
      return 'Worker binary not found. Ensure @claude-mem/worker is built.';
    }
    return null;
  }

  /**
   * Get current spawned worker count
   */
  getSpawnedCount(): number {
    return this.spawnedWorkers.size;
  }

  /**
   * Get all spawned workers info
   */
  getSpawnedWorkers(): SpawnedWorkerInfo[] {
    return Array.from(this.spawnedWorkers.values()).map((w) => ({
      id: w.id,
      pid: w.pid,
      status: w.status,
      spawnedAt: w.spawnedAt,
      connectedWorkerId: w.connectedWorkerId,
      provider: w.provider,
      pendingTermination: this.pendingTerminations.has(w.id),
    }));
  }

  /**
   * Spawn a new worker process
   */
  async spawn(options: SpawnOptions = {}): Promise<{ id: string; pid: number; provider: string }> {
    const settings = loadSettings();

    // Check max workers limit
    if (this.spawnedWorkers.size >= settings.MAX_WORKERS) {
      throw new Error(`Maximum worker limit reached (${settings.MAX_WORKERS})`);
    }

    if (!this.workerBinaryPath) {
      throw new Error('Worker binary not found');
    }

    const id = `spawned-${++this.workerCounter}-${Date.now()}`;
    const provider = options.provider || settings.AI_PROVIDER;

    // Build WebSocket URL for the worker
    const wsUrl = `ws://${this.backendHost}:${this.backendPort}/ws`;

    // Spawn worker process with environment variables
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      CLAUDE_MEM_BACKEND_URL: wsUrl,
      CLAUDE_MEM_BACKEND_HOST: this.backendHost,
      CLAUDE_MEM_BACKEND_PORT: String(this.backendPort),
      CLAUDE_MEM_LOG_LEVEL: settings.LOG_LEVEL,
      CLAUDE_MEM_AI_PROVIDER: provider,
      CLAUDE_MEM_SPAWNED_ID: id, // Pass spawned ID so worker includes it in metadata
    };

    // Pass auth token if set
    if (this.authToken) {
      env.CLAUDE_MEM_WORKER_AUTH_TOKEN = this.authToken;
    }

    // Pass AI provider keys
    if (settings.MISTRAL_API_KEY) {
      env.CLAUDE_MEM_MISTRAL_API_KEY = settings.MISTRAL_API_KEY;
    }
    if (settings.ANTHROPIC_API_KEY) {
      env.CLAUDE_MEM_ANTHROPIC_API_KEY = settings.ANTHROPIC_API_KEY;
    }
    if (settings.OPENROUTER_API_KEY) {
      env.CLAUDE_MEM_OPENROUTER_API_KEY = settings.OPENROUTER_API_KEY;
    }
    if (settings.OPENAI_API_KEY) {
      env.CLAUDE_MEM_OPENAI_API_KEY = settings.OPENAI_API_KEY;
    }
    if (settings.GEMINI_API_KEY) {
      env.CLAUDE_MEM_GEMINI_API_KEY = settings.GEMINI_API_KEY;
    }

    logger.info(`Spawning worker ${id} from ${this.workerBinaryPath}`);

    const child = spawn('node', [this.workerBinaryPath], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    if (!child.pid) {
      throw new Error('Failed to spawn worker process');
    }

    const spawnedWorker: SpawnedWorker = {
      id,
      process: child,
      pid: child.pid,
      spawnedAt: Date.now(),
      status: 'starting',
      provider,
    };

    this.spawnedWorkers.set(id, spawnedWorker);

    // Handle process events
    child.on('spawn', () => {
      spawnedWorker.status = 'running';
      this.emit('worker:spawned', { id, pid: child.pid });
      logger.info(`Worker ${id} spawned with PID ${child.pid}`);
    });

    child.on('exit', (code, signal) => {
      spawnedWorker.status = code === 0 ? 'stopped' : 'crashed';
      spawnedWorker.exitCode = code ?? undefined;
      this.emit('worker:exited', { id, pid: child.pid, code, signal });
      this.spawnedWorkers.delete(id);
      logger.info(`Worker ${id} exited with code ${code}, signal ${signal}`);
    });

    child.on('error', (error) => {
      spawnedWorker.status = 'crashed';
      this.emit('worker:error', { id, error: error.message });
      logger.error(`Worker ${id} error:`, { message: error.message });
    });

    // Capture stdout/stderr for logging
    child.stdout?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        this.emit('worker:log', { id, level: 'info', message });
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        this.emit('worker:log', { id, level: 'error', message });
      }
    });

    return { id, pid: child.pid, provider };
  }

  /**
   * Terminate a spawned worker
   */
  async terminate(id: string, graceful = true): Promise<void> {
    const worker = this.spawnedWorkers.get(id);
    if (!worker) {
      throw new Error(`Spawned worker not found: ${id}`);
    }

    logger.info(`Terminating worker ${id} (graceful: ${graceful})`);
    worker.status = 'stopping';

    if (graceful) {
      // Send SIGTERM for graceful shutdown
      worker.process.kill('SIGTERM');

      // Wait up to 5 seconds for graceful exit
      await Promise.race([
        new Promise<void>((resolve) => {
          worker.process.once('exit', () => resolve());
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 5000)),
      ]);
    }

    // Force kill if still running
    if (!worker.process.killed) {
      worker.process.kill('SIGKILL');
    }

    this.spawnedWorkers.delete(id);
  }

  /**
   * Terminate all spawned workers
   */
  async terminateAll(): Promise<void> {
    logger.info(`Terminating all ${this.spawnedWorkers.size} spawned workers`);

    const promises = Array.from(this.spawnedWorkers.keys()).map((id) =>
      this.terminate(id).catch((err) => {
        logger.warn(`Failed to terminate worker ${id}:`, { message: (err as Error).message });
      })
    );

    await Promise.all(promises);
  }

  /**
   * Link spawned worker to WorkerHub connection by worker ID
   */
  linkToHubWorker(spawnedId: string, hubWorkerId: string): void {
    const worker = this.spawnedWorkers.get(spawnedId);
    if (worker) {
      worker.connectedWorkerId = hubWorkerId;
      logger.debug(`Linked spawned worker ${spawnedId} to hub worker ${hubWorkerId}`);
    }
  }

  /**
   * Find spawned worker by hub worker ID
   */
  findByHubWorkerId(hubWorkerId: string): SpawnedWorker | undefined {
    for (const worker of this.spawnedWorkers.values()) {
      if (worker.connectedWorkerId === hubWorkerId) {
        return worker;
      }
    }
    return undefined;
  }

  /**
   * Find spawned worker by spawned ID
   */
  findBySpawnedId(spawnedId: string): SpawnedWorker | undefined {
    return this.spawnedWorkers.get(spawnedId);
  }

  /**
   * Queue a worker for termination (will be terminated when task completes)
   */
  queueTermination(spawnedId: string): void {
    const worker = this.spawnedWorkers.get(spawnedId);
    if (worker) {
      this.pendingTerminations.add(spawnedId);
      worker.status = 'stopping';
      logger.info(`Worker ${spawnedId} queued for termination`);
    }
  }

  /**
   * Check if a worker is queued for termination
   */
  isQueuedForTermination(spawnedId: string): boolean {
    return this.pendingTerminations.has(spawnedId);
  }

  /**
   * Execute pending termination for a worker (called when task completes)
   */
  async executePendingTermination(hubWorkerId: string): Promise<boolean> {
    const worker = this.findByHubWorkerId(hubWorkerId);
    if (!worker || !this.pendingTerminations.has(worker.id)) {
      return false;
    }

    logger.info(`Executing pending termination for worker ${worker.id}`);
    this.pendingTerminations.delete(worker.id);

    try {
      await this.terminate(worker.id);
      return true;
    } catch (error) {
      logger.error(`Failed to execute pending termination:`, { message: (error as Error).message });
      return false;
    }
  }
}

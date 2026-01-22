/**
 * CLI Commands Module
 *
 * Provides command-line interface for claude-mem operations.
 * Uses existing API endpoints via HTTP requests.
 */

import { getWorkerPort, getWorkerHost } from '../shared/worker-utils.js';

interface CLIOptions {
  json?: boolean;
  project?: string;
  limit?: number;
  type?: string;
}

interface SearchResult {
  id: number;
  title: string;
  type: string;
  project: string;
  created_at: string;
  tokens?: number;
}

interface StatsResponse {
  worker: {
    version: string;
    uptime: number;
    activeSessions: number;
    queueDepth: number;
    port: number;
  };
  database: {
    path: string;
    size: number;
    observations: number;
    sessions: number;
    summaries: number;
  };
}

interface ProcessingStatus {
  isProcessing: boolean;
  queueDepth: number;
}

interface BackupInfo {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

interface DoctorCheck {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
}

/**
 * Make HTTP request to worker API
 */
async function apiRequest<T>(
  endpoint: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const port = getWorkerPort();
  const host = getWorkerHost();
  const url = `http://${host}:${port}${endpoint}`;

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error (${response.status}): ${error}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Check if worker is running
 */
async function checkWorkerRunning(): Promise<boolean> {
  try {
    await apiRequest('/api/health');
    return true;
  } catch {
    return false;
  }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString();
}

// ============================================================================
// CLI Commands
// ============================================================================

/**
 * Show worker and queue status
 */
export async function statusCommand(options: CLIOptions): Promise<void> {
  const running = await checkWorkerRunning();

  if (!running) {
    if (options.json) {
      console.log(JSON.stringify({ running: false }));
    } else {
      console.log('Worker is not running');
    }
    return;
  }

  const [health, stats, processing] = await Promise.all([
    apiRequest<{ status: string; pid: number; initialized: boolean; coreReady: boolean; mcpReady: boolean }>('/api/health'),
    apiRequest<StatsResponse>('/api/stats'),
    apiRequest<ProcessingStatus>('/api/processing-status'),
  ]);

  if (options.json) {
    console.log(JSON.stringify({ running: true, health, stats, processing }, null, 2));
  } else {
    console.log('Worker Status');
    console.log('─'.repeat(40));
    console.log(`  Status:      ${health.status}`);
    console.log(`  Version:     ${stats.worker.version}`);
    console.log(`  PID:         ${health.pid}`);
    console.log(`  Uptime:      ${Math.floor(stats.worker.uptime / 60)}m ${stats.worker.uptime % 60}s`);
    console.log(`  Initialized: ${health.initialized ? 'yes' : 'no'}`);
    console.log(`  Core Ready:  ${health.coreReady ? 'yes' : 'no'}`);
    console.log(`  MCP Ready:   ${health.mcpReady ? 'yes' : 'no'}`);
    console.log('');
    console.log('Database Stats');
    console.log('─'.repeat(40));
    console.log(`  Path:         ${stats.database.path}`);
    console.log(`  Size:         ${formatBytes(stats.database.size)}`);
    console.log(`  Observations: ${stats.database.observations.toLocaleString()}`);
    console.log(`  Sessions:     ${stats.database.sessions.toLocaleString()}`);
    console.log(`  Summaries:    ${stats.database.summaries.toLocaleString()}`);
    console.log('');
    console.log('Processing');
    console.log('─'.repeat(40));
    console.log(`  Active:       ${processing.isProcessing ? 'yes' : 'no'}`);
    console.log(`  Queue Depth:  ${processing.queueDepth}`);
    console.log(`  Sessions:     ${stats.worker.activeSessions}`);
  }
}

/**
 * Search memories from CLI
 */
export async function searchCommand(query: string, options: CLIOptions): Promise<void> {
  if (!await checkWorkerRunning()) {
    console.error('Error: Worker is not running. Start with: claude-mem start');
    process.exit(1);
  }

  const params = new URLSearchParams({ query });
  if (options.project) params.set('project', options.project);
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.type) params.set('type', options.type);

  // Use the search/observations endpoint which returns formatted results
  const endpoint = options.type === 'session' ? '/api/search/sessions' : '/api/search/observations';
  const results = await apiRequest<{ content: Array<{ type: string; text: string }> }>(
    `${endpoint}?${params}`
  );

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    // The API returns markdown-formatted text
    const text = results.content.find(c => c.type === 'text')?.text;
    if (text) {
      console.log(text);
    } else {
      console.log('No results found');
    }
  }
}

/**
 * Export project memories
 */
export async function exportCommand(options: CLIOptions): Promise<void> {
  if (!await checkWorkerRunning()) {
    console.error('Error: Worker is not running. Start with: claude-mem start');
    process.exit(1);
  }

  const params = new URLSearchParams();
  if (options.project) params.set('project', options.project);
  if (options.limit) params.set('limit', options.limit.toString());

  const data = await apiRequest<unknown>(`/api/export?${params}`);

  // Always output JSON for export (pipe-friendly)
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Import memories from file/stdin
 */
export async function importCommand(filePath: string | undefined, options: CLIOptions): Promise<void> {
  if (!await checkWorkerRunning()) {
    console.error('Error: Worker is not running. Start with: claude-mem start');
    process.exit(1);
  }

  let data: string;

  if (filePath && filePath !== '-') {
    const fs = await import('fs/promises');
    data = await fs.readFile(filePath, 'utf-8');
  } else {
    // Read from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    data = Buffer.concat(chunks).toString('utf-8');
  }

  const parsed = JSON.parse(data);
  const result = await apiRequest<{ imported: number }>('/api/import', {
    method: 'POST',
    body: parsed,
  });

  if (options.json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Imported ${result.imported} records`);
  }
}

/**
 * Run cleanup tasks
 */
export async function cleanupCommand(options: CLIOptions): Promise<void> {
  if (!await checkWorkerRunning()) {
    console.error('Error: Worker is not running. Start with: claude-mem start');
    process.exit(1);
  }

  // Clear failed queue
  const queueResult = await apiRequest<{ deleted: number }>('/api/pending-queue/failed', {
    method: 'DELETE',
  });

  if (options.json) {
    console.log(JSON.stringify({ failedQueueCleared: queueResult.deleted }));
  } else {
    console.log('Cleanup completed:');
    console.log(`  Failed queue entries cleared: ${queueResult.deleted}`);
  }
}

/**
 * Create backup
 */
export async function backupCommand(options: CLIOptions): Promise<void> {
  if (!await checkWorkerRunning()) {
    console.error('Error: Worker is not running. Start with: claude-mem start');
    process.exit(1);
  }

  const result = await apiRequest<{ filename: string; sizeBytes: number; path: string }>(
    '/api/backups/create',
    { method: 'POST' }
  );

  if (options.json) {
    console.log(JSON.stringify(result));
  } else {
    console.log('Backup created:');
    console.log(`  File: ${result.filename}`);
    console.log(`  Size: ${formatBytes(result.sizeBytes)}`);
    console.log(`  Path: ${result.path}`);
  }
}

/**
 * List backups
 */
export async function backupsListCommand(options: CLIOptions): Promise<void> {
  if (!await checkWorkerRunning()) {
    console.error('Error: Worker is not running. Start with: claude-mem start');
    process.exit(1);
  }

  const result = await apiRequest<{ backups: BackupInfo[] }>('/api/backups');

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.backups.length === 0) {
      console.log('No backups found');
      return;
    }

    console.log('Backups:');
    console.log('─'.repeat(60));
    for (const b of result.backups) {
      console.log(`  ${b.filename}`);
      console.log(`    Size: ${formatBytes(b.sizeBytes)} | Created: ${formatDate(b.createdAt)}`);
    }
  }
}

/**
 * Diagnose issues
 */
export async function doctorCommand(options: CLIOptions): Promise<void> {
  const checks: DoctorCheck[] = [];

  // Check 1: Worker running
  const workerRunning = await checkWorkerRunning();
  checks.push({
    name: 'Worker Status',
    status: workerRunning ? 'ok' : 'error',
    message: workerRunning ? 'Worker is running' : 'Worker is not running',
  });

  if (workerRunning) {
    // Check 2: Health endpoint
    try {
      const health = await apiRequest<{ status: string; coreReady: boolean; mcpReady: boolean }>('/api/health');
      checks.push({
        name: 'Health Check',
        status: health.status === 'ok' ? 'ok' : 'warning',
        message: `Status: ${health.status}`,
      });

      checks.push({
        name: 'Core Services',
        status: health.coreReady ? 'ok' : 'warning',
        message: health.coreReady ? 'Database and search ready' : 'Core services not ready',
      });

      checks.push({
        name: 'MCP Server',
        status: health.mcpReady ? 'ok' : 'warning',
        message: health.mcpReady ? 'MCP server connected' : 'MCP server not connected',
      });
    } catch (error) {
      checks.push({
        name: 'Health Check',
        status: 'error',
        message: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    // Check 3: Database stats
    try {
      const stats = await apiRequest<StatsResponse>('/api/stats');
      checks.push({
        name: 'Database',
        status: 'ok',
        message: `${stats.database.observations} observations, ${stats.database.sessions} sessions (${formatBytes(stats.database.size)})`,
      });
    } catch (error) {
      checks.push({
        name: 'Database',
        status: 'error',
        message: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    // Check 4: Pending queue
    try {
      const queue = await apiRequest<{ queue: { messages: Array<{ status: string }> } }>('/api/pending-queue');
      const pending = queue.queue.messages.filter(m => m.status === 'pending').length;
      const failed = queue.queue.messages.filter(m => m.status === 'failed').length;
      const queueStatus = failed > 0 ? 'warning' : 'ok';
      checks.push({
        name: 'Queue Status',
        status: queueStatus,
        message: `Pending: ${pending}, Failed: ${failed}`,
      });
    } catch (error) {
      checks.push({
        name: 'Queue Status',
        status: 'error',
        message: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    // Check 5: Backups
    try {
      const backups = await apiRequest<{ backups: BackupInfo[] }>('/api/backups');
      const hasRecent = backups.backups.some((b) => {
        const created = new Date(b.createdAt);
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
        return created.getTime() > dayAgo;
      });
      checks.push({
        name: 'Backups',
        status: hasRecent ? 'ok' : 'warning',
        message: hasRecent
          ? `${backups.backups.length} backups (recent backup exists)`
          : `${backups.backups.length} backups (no recent backup)`,
      });
    } catch (error) {
      checks.push({
        name: 'Backups',
        status: 'warning',
        message: 'Could not check backups',
      });
    }
  }

  // Output
  if (options.json) {
    console.log(JSON.stringify({ checks }, null, 2));
  } else {
    console.log('Claude-Mem Doctor');
    console.log('─'.repeat(50));

    const statusIcon = (s: string) => (s === 'ok' ? '✓' : s === 'warning' ? '!' : '✗');
    const statusColor = (s: string) => (s === 'ok' ? '\x1b[32m' : s === 'warning' ? '\x1b[33m' : '\x1b[31m');
    const reset = '\x1b[0m';

    for (const check of checks) {
      console.log(`  ${statusColor(check.status)}${statusIcon(check.status)}${reset} ${check.name}: ${check.message}`);
    }

    const hasErrors = checks.some((c) => c.status === 'error');
    const hasWarnings = checks.some((c) => c.status === 'warning');

    console.log('');
    if (hasErrors) {
      console.log('\x1b[31mSome checks failed. See above for details.\x1b[0m');
    } else if (hasWarnings) {
      console.log('\x1b[33mSome warnings detected. See above for details.\x1b[0m');
    } else {
      console.log('\x1b[32mAll checks passed!\x1b[0m');
    }
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

export async function runCLI(args: string[]): Promise<void> {
  const command = args[0];
  const subArgs = args.slice(1);

  // Parse common options
  const options: CLIOptions = {};
  const positionalArgs: string[] = [];

  for (let i = 0; i < subArgs.length; i++) {
    const arg = subArgs[i];
    if (arg === '--json' || arg === '-j') {
      options.json = true;
    } else if (arg === '--project' || arg === '-p') {
      options.project = subArgs[++i];
    } else if (arg === '--limit' || arg === '-l') {
      options.limit = parseInt(subArgs[++i], 10);
    } else if (arg === '--type' || arg === '-t') {
      options.type = subArgs[++i];
    } else if (!arg.startsWith('-')) {
      positionalArgs.push(arg);
    }
  }

  try {
    switch (command) {
      case 'status':
        await statusCommand(options);
        break;

      case 'search':
        if (positionalArgs.length === 0) {
          console.error('Usage: claude-mem search <query> [--project <name>] [--limit <n>] [--json]');
          process.exit(1);
        }
        await searchCommand(positionalArgs.join(' '), options);
        break;

      case 'export':
        await exportCommand(options);
        break;

      case 'import':
        await importCommand(positionalArgs[0], options);
        break;

      case 'cleanup':
        await cleanupCommand(options);
        break;

      case 'backup':
        if (positionalArgs[0] === 'list') {
          await backupsListCommand(options);
        } else {
          await backupCommand(options);
        }
        break;

      case 'doctor':
        await doctorCommand(options);
        break;

      default:
        console.log(`Unknown command: ${command}`);
        console.log('');
        console.log('Available commands:');
        console.log('  status              Show worker and queue status');
        console.log('  search <query>      Search memories');
        console.log('  export              Export memories as JSON');
        console.log('  import [file]       Import memories from file or stdin');
        console.log('  cleanup             Run cleanup tasks');
        console.log('  backup              Create a backup');
        console.log('  backup list         List existing backups');
        console.log('  doctor              Diagnose issues');
        console.log('');
        console.log('Options:');
        console.log('  --json, -j          Output as JSON');
        console.log('  --project, -p       Filter by project');
        console.log('  --limit, -l         Limit results');
        process.exit(1);
    }
  } catch (error) {
    if (options.json) {
      console.log(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
    } else {
      console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    process.exit(1);
  }
}

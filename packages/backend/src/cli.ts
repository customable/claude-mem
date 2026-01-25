#!/usr/bin/env node
/**
 * Backend CLI (Issue #261)
 *
 * CLI entry point for the @claude-mem/backend package.
 * Provides start, stop, and status commands with configurable options.
 */

import { program } from 'commander';
import { BackendService } from './server/backend-service.js';
import { createLogger, initFileLogging, getLogFilePath, loadSettings, VERSION } from '@claude-mem/shared';

// Initialize file logging
const fileTransport = initFileLogging('backend');
const logger = createLogger('cli');

program
  .name('claude-mem-backend')
  .description('Backend server for claude-mem - REST API, WebSocket Hub, Task Queue')
  .version(VERSION);

program
  .command('start')
  .description('Start the backend server')
  .option('-p, --port <port>', 'HTTP port (default: from settings or 37777)')
  .option('-H, --host <host>', 'Bind address (default: from settings or 0.0.0.0)')
  .option('-d, --db <path>', 'Database path (default: ~/.claude-mem/claude-mem.db)')
  .option('--log-level <level>', 'Log level: debug, info, warn, error', 'info')
  .action(async (options) => {
    try {
      // Log file location if enabled
      const logPath = getLogFilePath();
      if (logPath) {
        logger.info(`File logging enabled: ${logPath}`);
      }

      // Load settings and override with CLI options
      const settings = loadSettings();

      // Environment variable overrides from CLI options
      if (options.port) {
        process.env.CLAUDE_MEM_BACKEND_PORT = options.port;
      }
      if (options.host) {
        process.env.CLAUDE_MEM_BACKEND_BIND = options.host;
      }
      if (options.db) {
        process.env.CLAUDE_MEM_DATABASE_PATH = options.db;
      }
      if (options.logLevel) {
        process.env.CLAUDE_MEM_LOG_LEVEL = options.logLevel;
      }

      const service = new BackendService();
      await service.start();

      logger.info('Backend service running');
      logger.info(`HTTP: http://${settings.BACKEND_BIND || '0.0.0.0'}:${settings.BACKEND_PORT || 37777}`);
    } catch (error) {
      logger.error('Failed to start backend:', error instanceof Error ? { message: error.message } : { error });
      process.exit(1);
    }
  });

program
  .command('stop')
  .description('Stop a running backend server')
  .option('-p, --port <port>', 'Backend port', '37777')
  .action(async (options) => {
    try {
      const response = await fetch(`http://127.0.0.1:${options.port}/api/admin/shutdown`, {
        method: 'POST',
      });

      if (response.ok) {
        console.log('Backend shutdown initiated');
      } else {
        console.error('Failed to stop backend:', await response.text());
        process.exit(1);
      }
    } catch {
      console.error('Could not connect to backend - it may not be running');
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check backend server status')
  .option('-p, --port <port>', 'Backend port', '37777')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    try {
      const response = await fetch(`http://127.0.0.1:${options.port}/api/health`);

      if (response.ok) {
        const status = (await response.json()) as {
          status?: string;
          coreReady?: boolean;
          workers?: { connected?: number };
          version?: string;
        };

        if (options.json) {
          console.log(JSON.stringify(status, null, 2));
        } else {
          console.log('Backend Status:');
          console.log(`  Status: ${status.status}`);
          console.log(`  Core Ready: ${status.coreReady}`);
          console.log(`  Workers: ${status.workers?.connected ?? 0} connected`);
          if (status.version) {
            console.log(`  Version: ${status.version}`);
          }
        }
      } else {
        console.error('Backend returned error:', response.status);
        process.exit(1);
      }
    } catch {
      console.error('Backend not running');
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    const settings = loadSettings();
    console.log('Current Configuration:');
    console.log(`  Port: ${settings.BACKEND_PORT}`);
    console.log(`  Host: ${settings.BACKEND_HOST}`);
    console.log(`  Bind: ${settings.BACKEND_BIND}`);
    console.log(`  Database: ${settings.DATABASE_PATH}`);
    console.log(`  Log Level: ${settings.LOG_LEVEL}`);
    console.log(`  AI Provider: ${settings.AI_PROVIDER}`);
    console.log(`  Max Workers: ${settings.MAX_WORKERS}`);
    console.log(`  Auto-Spawn: ${settings.AUTO_SPAWN_WORKERS}`);
  });

program.parse();

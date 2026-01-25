#!/usr/bin/env node
/**
 * Worker CLI (Issue #261)
 *
 * CLI entry point for the @claude-mem/worker package.
 * Provides start command with configurable options for connecting to backend.
 */

import { program } from 'commander';
import { WorkerService } from './worker-service.js';
import { createLogger, loadSettings, VERSION } from '@claude-mem/shared';

const logger = createLogger('worker-cli');

program
  .name('claude-mem-worker')
  .description('Distributed AI processing worker for claude-mem')
  .version(VERSION);

program
  .command('start')
  .description('Start the worker and connect to backend')
  .option('-b, --backend <url>', 'Backend WebSocket URL (e.g., ws://localhost:37777)')
  .option('-t, --token <token>', 'Authentication token')
  .option('-p, --provider <provider>', 'AI provider: mistral, anthropic, gemini, openrouter')
  .option('--daemon', 'Run as daemon (for process managers)')
  .action(async (options) => {
    try {
      const settings = loadSettings();

      // Build backend URL from options or settings
      let backendUrl = options.backend;
      if (!backendUrl) {
        const host = settings.BACKEND_HOST || '127.0.0.1';
        const port = settings.BACKEND_PORT || 37777;
        backendUrl = `ws://${host}:${port}`;
      }

      // Override provider if specified
      if (options.provider) {
        process.env.CLAUDE_MEM_AI_PROVIDER = options.provider;
      }

      logger.info(`Starting worker v${VERSION}`);
      logger.info(`Connecting to backend: ${backendUrl}`);

      const worker = new WorkerService({
        backendUrl,
        authToken: options.token || settings.WORKER_AUTH_TOKEN,
      });

      worker.start();
    } catch (error) {
      logger.error('Failed to start worker:', error);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Show current worker configuration')
  .action(() => {
    const settings = loadSettings();
    console.log('Worker Configuration:');
    console.log(`  Version: ${VERSION}`);
    console.log(`  Backend Host: ${settings.BACKEND_HOST || '127.0.0.1'}`);
    console.log(`  Backend Port: ${settings.BACKEND_PORT || 37777}`);
    console.log(`  AI Provider: ${settings.AI_PROVIDER}`);
    console.log(`  Mistral Model: ${settings.MISTRAL_MODEL}`);
    console.log(`  Gemini Model: ${settings.GEMINI_MODEL}`);
    console.log(`  Vector DB: ${settings.VECTOR_DB}`);
    console.log(`  Embedding Model: ${settings.EMBEDDING_MODEL}`);
  });

// Default command is start (for backwards compatibility)
if (process.argv.length === 2 || process.argv.includes('--daemon')) {
  // No command specified, run start
  const worker = new WorkerService();
  worker.start();
} else {
  program.parse();
}

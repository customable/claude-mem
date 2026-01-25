#!/usr/bin/env node
/**
 * Worker CLI (Issue #261, #265)
 *
 * CLI entry point for the @claude-mem/worker package.
 * Provides start command with configurable options for connecting to backend.
 *
 * Capability Resolution Priority (Issue #265):
 * 1. --capabilities CLI argument (highest)
 * 2. WORKER_CAPABILITIES environment variable
 * 3. --profile CLI argument → looks up WORKER_PROFILES setting
 * 4. Auto-detection based on configured providers (lowest)
 */

import { program } from 'commander';
import { WorkerService } from './worker-service.js';
import { createLogger, loadSettings, VERSION } from '@claude-mem/shared';
import type { WorkerCapability } from '@claude-mem/types';

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
  .option('-c, --capabilities <caps>', 'Comma-separated capabilities (e.g., observation:mistral,summarize:mistral)')
  .option('--profile <name>', 'Worker profile name from WORKER_PROFILES setting')
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

      // Parse capabilities from CLI or profile (Issue #265)
      let capabilities: WorkerCapability[] | undefined;

      if (options.capabilities) {
        // Direct capabilities from CLI
        capabilities = options.capabilities.split(',').map((c: string) => c.trim()) as WorkerCapability[];
        logger.info(`Using CLI capabilities: ${capabilities.join(', ')}`);
      } else if (options.profile) {
        // Look up profile from settings
        const profiles = parseWorkerProfiles(settings.WORKER_PROFILES);
        const profile = profiles.find(p => p.name === options.profile);
        if (profile) {
          capabilities = profile.capabilities as WorkerCapability[];
          logger.info(`Using profile "${options.profile}": ${capabilities.join(', ')}`);
        } else {
          logger.warn(`Profile "${options.profile}" not found, using auto-detection`);
        }
      }

      logger.info(`Starting worker v${VERSION}`);
      logger.info(`Connecting to backend: ${backendUrl}`);

      const worker = new WorkerService({
        backendUrl,
        authToken: options.token || settings.WORKER_AUTH_TOKEN,
        capabilities,
      });

      worker.start();
    } catch (error) {
      logger.error('Failed to start worker:', error instanceof Error ? { message: error.message } : { error });
      process.exit(1);
    }
  });

/**
 * Parse worker profiles from JSON string
 */
function parseWorkerProfiles(json: string): Array<{ name: string; capabilities: string[] }> {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is { name: string; capabilities: string[] } =>
      typeof p === 'object' &&
      p !== null &&
      typeof p.name === 'string' &&
      Array.isArray(p.capabilities)
    );
  } catch {
    return [];
  }
}

program
  .command('config')
  .description('Show current worker configuration')
  .action(() => {
    const settings = loadSettings();
    const profiles = parseWorkerProfiles(settings.WORKER_PROFILES);

    console.log('Worker Configuration:');
    console.log(`  Version: ${VERSION}`);
    console.log(`  Backend Host: ${settings.BACKEND_HOST || '127.0.0.1'}`);
    console.log(`  Backend Port: ${settings.BACKEND_PORT || 37777}`);
    console.log(`  AI Provider: ${settings.AI_PROVIDER}`);
    console.log(`  Mistral Model: ${settings.MISTRAL_MODEL}`);
    console.log(`  Gemini Model: ${settings.GEMINI_MODEL}`);
    console.log(`  Vector DB: ${settings.VECTOR_DB}`);
    console.log(`  Embedding Model: ${settings.EMBEDDING_MODEL}`);
    console.log('');
    console.log('Worker Profiles:');
    if (profiles.length === 0) {
      console.log('  (none configured - using auto-detection)');
    } else {
      for (const profile of profiles) {
        console.log(`  ${profile.name}: ${profile.capabilities.join(', ')}`);
      }
    }
  });

program
  .command('profiles')
  .description('List available worker profiles')
  .action(() => {
    const settings = loadSettings();
    const profiles = parseWorkerProfiles(settings.WORKER_PROFILES);

    console.log('Available Worker Profiles:');
    console.log('');
    if (profiles.length === 0) {
      console.log('  No profiles configured in WORKER_PROFILES setting.');
      console.log('');
      console.log('  Example configuration in ~/.claude-mem/settings.json:');
      console.log('  {');
      console.log('    "WORKER_PROFILES": "[');
      console.log('      {\\"name\\": \\"observer\\", \\"capabilities\\": [\\"observation:mistral\\"]},');
      console.log('      {\\"name\\": \\"summarizer\\", \\"capabilities\\": [\\"summarize:mistral\\", \\"claudemd:generate\\"]}');
      console.log('    ]"');
      console.log('  }');
    } else {
      for (const profile of profiles) {
        console.log(`  ${profile.name}:`);
        for (const cap of profile.capabilities) {
          console.log(`    - ${cap}`);
        }
        console.log('');
      }
    }
  });

// Default command is start (for backwards compatibility)
if (process.argv.length === 2 || process.argv.includes('--daemon')) {
  // No command specified, run start
  const worker = new WorkerService();
  worker.start();
} else {
  program.parse();
}

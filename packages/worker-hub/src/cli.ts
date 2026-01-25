#!/usr/bin/env node
/**
 * Worker Hub CLI (Issue #263)
 *
 * CLI for running a standalone worker hub.
 */

import { Command } from 'commander';
import { createLogger, VERSION } from '@claude-mem/shared';
import { WorkerHubService } from './worker-hub-service.js';

const logger = createLogger('claude-mem-hub');

const program = new Command();

program
  .name('claude-mem-hub')
  .description('Standalone worker hub for distributed claude-mem deployments')
  .version(VERSION);

program
  .command('start')
  .description('Start the worker hub')
  .option('-p, --port <port>', 'Port for worker connections', '37778')
  .option('-h, --host <host>', 'Bind address', '0.0.0.0')
  .option('-n, --name <name>', 'Hub name (displayed in backend)')
  .option('-r, --region <region>', 'Hub region (for regional routing)')
  .option('-l, --labels <labels>', 'Hub labels as JSON (for label-based routing)')
  .option('-t, --worker-token <token>', 'Auth token for workers connecting to this hub')
  .option('-b, --backend-url <url>', 'Backend WebSocket URL for federation')
  .option('--hub-token <token>', 'Token for authenticating with backend')
  .option('--no-federate', 'Disable federation (standalone mode)')
  .action(async (options) => {
    logger.info('Starting claude-mem hub...');

    // Parse labels if provided
    let labels: Record<string, string> | undefined;
    if (options.labels) {
      try {
        labels = JSON.parse(options.labels);
      } catch {
        logger.error('Invalid labels JSON');
        process.exit(1);
      }
    }

    const service = new WorkerHubService({
      port: parseInt(options.port, 10),
      host: options.host,
      name: options.name,
      region: options.region,
      labels,
      workerAuthToken: options.workerToken,
      backendUrl: options.backendUrl,
      hubToken: options.hubToken,
      federate: options.federate !== false,
    });

    try {
      await service.start();
      logger.info('Worker hub is running');
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to start hub:', { message: err.message });
      process.exit(1);
    }
  });

program
  .command('health')
  .description('Check hub health (requires running hub)')
  .option('-H, --hub-url <url>', 'Hub URL', 'http://localhost:37778')
  .action(async (options) => {
    try {
      const response = await fetch(`${options.hubUrl}/health`);
      if (!response.ok) {
        console.error(`Health check failed: ${response.status}`);
        process.exit(1);
      }
      const health = await response.json();
      console.log(JSON.stringify(health, null, 2));
    } catch (error) {
      const err = error as Error;
      console.error(`Failed to connect to hub: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();

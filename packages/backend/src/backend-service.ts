#!/usr/bin/env bun
/**
 * Backend Service CLI Entry Point
 *
 * Usage:
 *   bun backend-service.ts start    - Start the backend server
 *   bun backend-service.ts stop     - Stop the backend server (via API)
 *   bun backend-service.ts status   - Check backend status
 */

import { BackendService } from './server/backend-service.js';
import { createLogger } from '@claude-mem/shared';

const logger = createLogger('cli');

async function main(): Promise<void> {
  const command = process.argv[2] || 'start';

  switch (command) {
    case 'start':
      await startBackend();
      break;

    case 'stop':
      await stopBackend();
      break;

    case 'status':
      await checkStatus();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Usage: backend-service [start|stop|status]');
      process.exit(1);
  }
}

async function startBackend(): Promise<void> {
  const service = new BackendService({
    port: parseInt(process.env.PORT || '37777'),
    host: process.env.HOST || '127.0.0.1',
  });

  await service.start();
  logger.info('Backend service running');
}

async function stopBackend(): Promise<void> {
  const port = process.env.PORT || '37777';
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/admin/shutdown`, {
      method: 'POST',
    });

    if (response.ok) {
      console.log('Backend shutdown initiated');
    } else {
      console.error('Failed to stop backend:', await response.text());
      process.exit(1);
    }
  } catch (error) {
    console.error('Could not connect to backend - it may not be running');
    process.exit(1);
  }
}

async function checkStatus(): Promise<void> {
  const port = process.env.PORT || '37777';
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/status`);

    if (response.ok) {
      const status = await response.json();
      console.log('Backend Status:');
      console.log(JSON.stringify(status, null, 2));
    } else {
      console.error('Backend returned error:', response.status);
      process.exit(1);
    }
  } catch (error) {
    console.error('Backend not running');
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});

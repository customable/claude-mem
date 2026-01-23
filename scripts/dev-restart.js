#!/usr/bin/env node
/**
 * Dev Restart Script
 *
 * Syncs dependencies, rebuilds, and restarts backend + worker for local development.
 *
 * Usage: pnpm dev:restart
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * Run a command synchronously
 */
function run(cmd, description) {
  console.log(`\n\x1b[36m[${description}]\x1b[0m ${cmd}`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`\x1b[31mFailed: ${description}\x1b[0m`);
    return false;
  }
}

/**
 * Kill processes by pattern
 */
function killProcesses(pattern) {
  try {
    execSync(`pkill -f "${pattern}"`, { stdio: 'ignore' });
    console.log(`Killed processes matching: ${pattern}`);
  } catch {
    // No processes to kill - that's fine
  }
}

/**
 * Start a background process
 */
function startBackground(cmd, args, name) {
  console.log(`\n\x1b[32mStarting ${name}...\x1b[0m`);
  const proc = spawn(cmd, args, {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
  });
  proc.unref();
  console.log(`${name} started (PID: ${proc.pid})`);
  return proc.pid;
}

async function main() {
  console.log('\x1b[1m\x1b[35m=== Claude-Mem Dev Restart ===\x1b[0m');

  // Step 1: Kill existing processes
  console.log('\n\x1b[33m[1/4] Stopping existing processes...\x1b[0m');
  killProcesses('packages/backend/dist/server');
  killProcesses('packages/worker/dist/worker-service');

  // Step 2: Sync dependencies
  console.log('\n\x1b[33m[2/4] Syncing dependencies...\x1b[0m');
  if (!run('pnpm install', 'pnpm install')) {
    process.exit(1);
  }

  // Step 3: Build
  console.log('\n\x1b[33m[3/4] Building packages...\x1b[0m');
  if (!run('pnpm build', 'pnpm build')) {
    process.exit(1);
  }

  // Step 4: Start backend and worker
  console.log('\n\x1b[33m[4/4] Starting services...\x1b[0m');

  // Start backend
  startBackground('bun', ['packages/backend/dist/server/index.js'], 'Backend');

  // Wait a bit for backend to initialize
  await new Promise(r => setTimeout(r, 2000));

  // Start worker
  startBackground('bun', ['packages/worker/dist/worker-service.js'], 'Worker');

  console.log('\n\x1b[1m\x1b[32m=== Dev environment restarted! ===\x1b[0m');
  console.log('\nBackend: http://localhost:37777');
  console.log('WebUI: http://localhost:37777');
  console.log('\nUse "pkill -f packages/backend" and "pkill -f packages/worker" to stop.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

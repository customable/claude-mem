#!/usr/bin/env node
/**
 * Dev Restart Script
 *
 * Syncs dependencies, rebuilds, and restarts backend + worker for local development.
 * Loads port configuration from settings.
 *
 * Usage: pnpm dev:restart
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/** @type {number} */
let backendPort = 37777; // Default, will be overwritten from settings
/** @type {string} */
let backendHost = '127.0.0.1'; // Default, will be overwritten from settings

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
  console.log('\n\x1b[33m[1/5] Stopping existing processes...\x1b[0m');
  killProcesses('packages/backend/dist/backend-service');
  killProcesses('packages/worker/dist/worker-service');

  // Step 2: Sync dependencies
  console.log('\n\x1b[33m[2/5] Syncing dependencies...\x1b[0m');
  if (!run('pnpm install', 'pnpm install')) {
    process.exit(1);
  }

  // Step 3: Build
  console.log('\n\x1b[33m[3/5] Building packages...\x1b[0m');
  if (!run('pnpm build', 'pnpm build')) {
    process.exit(1);
  }

  // Step 4: Load settings (after build so we have compiled shared module)
  console.log('\n\x1b[33m[4/5] Loading settings...\x1b[0m');
  try {
    const { loadSettings } = await import(path.join(ROOT, 'packages/shared/dist/settings.js'));
    const settings = loadSettings();
    backendPort = settings.BACKEND_PORT || 37777;
    backendHost = settings.BACKEND_HOST || '127.0.0.1';
    console.log(`Loaded settings: host=${backendHost}, port=${backendPort}`);
  } catch (err) {
    console.warn('Could not load settings, using defaults');
  }

  // Step 5: Start backend and worker
  console.log('\n\x1b[33m[5/5] Starting services...\x1b[0m');

  // Start backend
  startBackground('bun', ['packages/backend/dist/backend-service.js'], 'Backend');

  // Wait a bit for backend to initialize
  await new Promise(r => setTimeout(r, 2000));

  // Start worker
  startBackground('bun', ['packages/worker/dist/worker-service.js'], 'Worker');

  console.log('\n\x1b[1m\x1b[32m=== Dev environment restarted! ===\x1b[0m');
  console.log(`\nBackend: http://${backendHost}:${backendPort}`);
  console.log(`WebUI: http://${backendHost}:${backendPort}`);
  console.log('\nUse "pkill -f packages/backend" and "pkill -f packages/worker" to stop.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

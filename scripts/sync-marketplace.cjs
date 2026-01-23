#!/usr/bin/env node
/**
 * Sync Marketplace Script
 *
 * Synchronizes the plugin directory to Claude marketplace locations.
 * Supports multiple Claude instances via CLAUDE_CONFIG_DIR.
 *
 * Usage:
 *   node scripts/sync-marketplace.cjs           # Sync to all found instances
 *   node scripts/sync-marketplace.cjs --force   # Skip branch check
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const PLUGIN_DIR = path.join(ROOT, 'plugin');
const PLUGIN_NAME = 'claude-mem';
const MARKETPLACE_NAME = 'customable';

/**
 * Possible marketplace base paths
 * Supports standard ~/.claude and CLAUDE_CONFIG_DIR variants
 */
const MARKETPLACE_BASES = [
  // Standard Claude
  path.join(os.homedir(), '.claude'),
  // CLAUDE_CONFIG_DIR variants
  path.join(os.homedir(), '.config', 'claude'),
  path.join(os.homedir(), '.config', 'claude-work'),
  path.join(os.homedir(), '.config', 'claude-lab'),
];

/**
 * Get all existing marketplace paths
 */
function getMarketplacePaths() {
  const paths = [];
  for (const base of MARKETPLACE_BASES) {
    const marketplacePath = path.join(base, 'plugins', 'marketplaces', MARKETPLACE_NAME);
    // Check if the parent plugins dir exists (Claude is installed)
    const pluginsDir = path.join(base, 'plugins');
    if (fs.existsSync(pluginsDir)) {
      paths.push({
        base,
        marketplace: marketplacePath,
        cache: path.join(base, 'plugins', 'cache', MARKETPLACE_NAME, PLUGIN_NAME),
      });
    }
  }
  return paths;
}

/**
 * Check if on main/master branch
 */
function isMainBranch() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: ROOT,
      encoding: 'utf-8',
    }).trim();
    return branch === 'main' || branch === 'master';
  } catch {
    return true; // If git fails, assume OK
  }
}

/**
 * Get version from plugin.json
 */
function getVersion() {
  try {
    const pluginJson = JSON.parse(
      fs.readFileSync(path.join(PLUGIN_DIR, '.claude-plugin', 'plugin.json'), 'utf-8')
    );
    return pluginJson.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

/**
 * Rsync plugin to target
 */
function rsyncToTarget(target) {
  // Ensure target directory exists
  fs.mkdirSync(target, { recursive: true });

  // Build rsync command
  const rsyncArgs = [
    '-av',
    '--delete',
    '--no-perms',
    '--exclude=.git',
    '--exclude=node_modules',
    '--exclude=CLAUDE.md',       // Don't overwrite per-instance CLAUDE.md
    `${PLUGIN_DIR}/`,
    `${target}/`,
  ];

  console.log(`  rsync ${path.relative(ROOT, PLUGIN_DIR)}/ -> ${target}/`);

  try {
    execSync(`rsync ${rsyncArgs.join(' ')}`, {
      cwd: ROOT,
      stdio: 'pipe',
    });
    return true;
  } catch (err) {
    console.error(`  rsync failed: ${err.message}`);
    return false;
  }
}

/**
 * Run npm/bun install in target
 */
function installDeps(target) {
  if (!fs.existsSync(path.join(target, 'package.json'))) {
    return true; // No package.json, skip
  }

  console.log(`  Installing dependencies...`);
  try {
    // Try bun first, fall back to npm
    try {
      execSync('bun install', {
        cwd: target,
        stdio: 'pipe',
      });
    } catch {
      execSync('npm install', {
        cwd: target,
        stdio: 'pipe',
      });
    }
    return true;
  } catch (err) {
    console.error(`  Install failed: ${err.message}`);
    return false;
  }
}

/**
 * Create/update cache version directory
 */
function setupCache(cachePath, version) {
  const versionedCache = path.join(cachePath, version);

  // Create symlink from latest to versioned cache
  const latestLink = path.join(cachePath, 'latest');

  try {
    fs.mkdirSync(versionedCache, { recursive: true });

    // Update latest symlink
    if (fs.existsSync(latestLink)) {
      fs.unlinkSync(latestLink);
    }
    fs.symlinkSync(version, latestLink, 'dir');

    console.log(`  Cache: ${path.relative(os.homedir(), versionedCache)}`);
    return true;
  } catch (err) {
    console.error(`  Cache setup failed: ${err.message}`);
    return false;
  }
}

/**
 * Main sync function
 */
async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force') || args.includes('-f');

  console.log('Claude-Mem Marketplace Sync\n');

  // Check branch (unless forced)
  if (!force && !isMainBranch()) {
    console.log('Warning: Not on main/master branch.');
    console.log('Use --force to sync anyway.\n');
  }

  // Check plugin directory exists
  if (!fs.existsSync(PLUGIN_DIR)) {
    console.error('Error: plugin/ directory not found.');
    console.error('Run "pnpm build:plugin" first.');
    process.exit(1);
  }

  // Check required files
  const requiredFiles = [
    'scripts/worker-service.cjs',
    '.claude-plugin/plugin.json',
    'hooks/hooks.json',
  ];
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(PLUGIN_DIR, file))) {
      console.error(`Error: Required file missing: plugin/${file}`);
      console.error('Run "pnpm build:plugin" first.');
      process.exit(1);
    }
  }

  const version = getVersion();
  console.log(`Version: ${version}`);

  // Find marketplace paths
  const targets = getMarketplacePaths();
  if (targets.length === 0) {
    console.error('\nNo Claude installations found.');
    console.error('Checked paths:');
    for (const base of MARKETPLACE_BASES) {
      console.error(`  - ${base}/plugins/`);
    }
    process.exit(1);
  }

  console.log(`\nFound ${targets.length} Claude installation(s):\n`);

  let successCount = 0;
  for (const target of targets) {
    console.log(`[${path.basename(target.base)}]`);
    console.log(`  Base: ${target.base}`);

    // Sync to marketplace
    if (rsyncToTarget(target.marketplace)) {
      // Install dependencies
      installDeps(target.marketplace);
      // Setup cache
      setupCache(target.cache, version);
      successCount++;
    }
    console.log('');
  }

  // Summary
  console.log(`Synced to ${successCount}/${targets.length} installations.`);

  if (successCount > 0) {
    console.log('\nRestart Claude Code to apply changes.');
  }
}

// Run
main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});

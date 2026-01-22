#!/usr/bin/env node
/**
 * Protected sync-marketplace script
 *
 * Prevents accidental rsync overwrite when installed plugin is on beta branch.
 * If on beta, the user should use the UI to update instead.
 */

const { execSync } = require('child_process');
const { existsSync, readFileSync } = require('fs');
const path = require('path');
const os = require('os');

const INSTALLED_PATH = path.join(os.homedir(), '.claude', 'plugins', 'marketplaces', 'customable');
const CACHE_BASE_PATH = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'customable', 'claude-mem');

// Additional marketplace paths for other Claude environments
const ADDITIONAL_MARKETPLACE_PATHS = [
  path.join(os.homedir(), '.config', 'claude-work', 'plugins', 'marketplaces', 'customable'),
  path.join(os.homedir(), '.config', 'claude-lab', 'plugins', 'marketplaces', 'customable'),
];

// Additional cache paths for other Claude environments
const ADDITIONAL_CACHE_PATHS = [
  path.join(os.homedir(), '.config', 'claude-work', 'plugins', 'cache', 'customable', 'claude-mem'),
  path.join(os.homedir(), '.config', 'claude-lab', 'plugins', 'cache', 'customable', 'claude-mem'),
];

function getCurrentBranch() {
  try {
    if (!existsSync(path.join(INSTALLED_PATH, '.git'))) {
      return null;
    }
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: INSTALLED_PATH,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch {
    return null;
  }
}

const branch = getCurrentBranch();
const isForce = process.argv.includes('--force');

if (branch && branch !== 'main' && !isForce) {
  console.log('');
  console.log('\x1b[33m%s\x1b[0m', `WARNING: Installed plugin is on beta branch: ${branch}`);
  console.log('\x1b[33m%s\x1b[0m', 'Running rsync would overwrite beta code.');
  console.log('');
  console.log('Options:');
  console.log('  1. Use UI at http://localhost:37777 to update beta');
  console.log('  2. Switch to stable in UI first, then run sync');
  console.log('  3. Force rsync: npm run sync-marketplace:force');
  console.log('');
  process.exit(1);
}

// Get version from plugin.json
function getPluginVersion() {
  try {
    const pluginJsonPath = path.join(__dirname, '..', 'plugin', '.claude-plugin', 'plugin.json');
    const pluginJson = JSON.parse(readFileSync(pluginJsonPath, 'utf-8'));
    return pluginJson.version;
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Failed to read plugin version:', error.message);
    process.exit(1);
  }
}

// Helper function to run rsync with macOS compatibility
function runRsync(source, dest, extraExcludes = []) {
  const excludes = ['--exclude=.git', '--exclude=/.mcp.json', ...extraExcludes].join(' ');
  // Use --no-perms to avoid permission errors on macOS
  const cmd = `rsync -av --delete --no-perms ${excludes} "${source}" "${dest}"`;

  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (error) {
    // Exit codes 23 and 24 are partial transfer errors (some files couldn't be transferred)
    // This is often due to permission issues on macOS and can be safely ignored
    if (error.status === 23 || error.status === 24) {
      console.log('\x1b[33m%s\x1b[0m', `ℹ rsync completed with warnings (exit code ${error.status})`);
      return true;
    }
    throw error;
  }
}

// On macOS, clear extended attributes that can cause rsync issues
function clearMacOSAttributes(targetPath) {
  if (process.platform === 'darwin' && existsSync(targetPath)) {
    try {
      execSync(`xattr -cr "${targetPath}"`, { stdio: 'pipe' });
    } catch {
      // Ignore xattr errors - not critical
    }
  }
}

// Normal rsync for main branch or fresh install
console.log('Syncing to marketplace...');
try {
  clearMacOSAttributes(INSTALLED_PATH);
  runRsync('./', path.join(os.homedir(), '.claude/plugins/marketplaces/customable/'));

  console.log('Running npm install in marketplace...');
  execSync(
    'cd ~/.claude/plugins/marketplaces/customable/ && npm install',
    { stdio: 'inherit' }
  );

  // Sync to additional marketplace paths (e.g., claude-lab, claude-work)
  for (const additionalMarketplacePath of ADDITIONAL_MARKETPLACE_PATHS) {
    if (existsSync(additionalMarketplacePath) || existsSync(path.dirname(additionalMarketplacePath))) {
      console.log(`Syncing to additional marketplace: ${additionalMarketplacePath}...`);
      execSync(`mkdir -p "${additionalMarketplacePath}"`, { stdio: 'inherit' });
      clearMacOSAttributes(additionalMarketplacePath);
      runRsync('./', additionalMarketplacePath + '/', ['--exclude=/node_modules']);
      // Run npm install in additional marketplace
      if (existsSync(path.join(additionalMarketplacePath, 'package.json'))) {
        console.log(`Running npm install in ${additionalMarketplacePath}...`);
        execSync(
          `cd "${additionalMarketplacePath}" && npm install`,
          { stdio: 'inherit' }
        );
      }
    }
  }

  // Sync to cache folder with version
  const version = getPluginVersion();
  const CACHE_VERSION_PATH = path.join(CACHE_BASE_PATH, version);

  console.log(`Syncing to cache folder (version ${version})...`);
  execSync(`mkdir -p "${CACHE_VERSION_PATH}"`, { stdio: 'inherit' });
  clearMacOSAttributes(CACHE_VERSION_PATH);
  runRsync('plugin/', CACHE_VERSION_PATH + '/');

  // Sync to additional cache paths (e.g., claude-lab)
  for (const additionalCachePath of ADDITIONAL_CACHE_PATHS) {
    const additionalVersionPath = path.join(additionalCachePath, version);
    if (existsSync(additionalCachePath) || existsSync(path.dirname(additionalCachePath))) {
      console.log(`Syncing to additional cache: ${additionalVersionPath}...`);
      execSync(`mkdir -p "${additionalVersionPath}"`, { stdio: 'inherit' });
      clearMacOSAttributes(additionalVersionPath);
      runRsync('plugin/', additionalVersionPath + '/');
    }
  }

  console.log('\x1b[32m%s\x1b[0m', 'Sync complete!');

  // Trigger worker restart after file sync
  console.log('\n🔄 Triggering worker restart...');
  const http = require('http');
  const req = http.request({
    hostname: '127.0.0.1',
    port: 37777,
    path: '/api/admin/restart',
    method: 'POST',
    timeout: 2000
  }, (res) => {
    if (res.statusCode === 200) {
      console.log('\x1b[32m%s\x1b[0m', '✓ Worker restart triggered');
    } else {
      console.log('\x1b[33m%s\x1b[0m', `ℹ Worker restart returned status ${res.statusCode}`);
    }
  });
  req.on('error', () => {
    console.log('\x1b[33m%s\x1b[0m', 'ℹ Worker not running, will start on next hook');
  });
  req.on('timeout', () => {
    req.destroy();
    console.log('\x1b[33m%s\x1b[0m', 'ℹ Worker restart timed out');
  });
  req.end();

} catch (error) {
  console.error('\x1b[31m%s\x1b[0m', 'Sync failed:', error.message);
  process.exit(1);
}

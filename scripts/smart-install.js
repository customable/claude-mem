#!/usr/bin/env node
/**
 * Smart Install Script for claude-mem
 *
 * Ensures Bun runtime and uv (Python package manager) are installed
 * (auto-installs if missing) and handles dependency installation when needed.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { execSync, spawnSync } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';

const ROOT = join(homedir(), '.claude', 'plugins', 'marketplaces', 'customable');
const MARKER = join(ROOT, '.install-version');
const IS_WINDOWS = process.platform === 'win32';

// Minimum Bun version required for SQLite .changes property and multi-statement SQL
const MIN_BUN_VERSION = '1.1.14';

// Common installation paths (handles fresh installs before PATH reload)
const BUN_COMMON_PATHS = IS_WINDOWS
  ? [join(homedir(), '.bun', 'bin', 'bun.exe')]
  : [join(homedir(), '.bun', 'bin', 'bun'), '/usr/local/bin/bun', '/opt/homebrew/bin/bun'];

const UV_COMMON_PATHS = IS_WINDOWS
  ? [join(homedir(), '.local', 'bin', 'uv.exe'), join(homedir(), '.cargo', 'bin', 'uv.exe')]
  : [join(homedir(), '.local', 'bin', 'uv'), join(homedir(), '.cargo', 'bin', 'uv'), '/usr/local/bin/uv', '/opt/homebrew/bin/uv'];

/**
 * Compare two semver version strings
 * Returns: negative if a < b, 0 if equal, positive if a > b
 */
function compareVersions(a, b) {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    if (aVal !== bVal) return aVal - bVal;
  }
  return 0;
}

/**
 * Check if installed Bun version meets minimum requirement
 */
function isBunVersionSufficient() {
  const version = getBunVersion();
  if (!version) return false;
  return compareVersions(version, MIN_BUN_VERSION) >= 0;
}

/**
 * Get the Bun executable path (from PATH or common install locations)
 * Priority: common paths first (avoids shell), then PATH lookup
 */
function getBunPath() {
  // Check common installation paths FIRST (avoids libuv assertion on Windows)
  // Absolute paths don't need shell resolution
  const absolutePath = BUN_COMMON_PATHS.find(existsSync);
  if (absolutePath) return absolutePath;

  // Fall back to PATH lookup (needs shell on Windows for PATH resolution)
  try {
    const result = spawnSync('bun', ['--version'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: IS_WINDOWS  // Only needed for bare command PATH lookup
    });
    if (result.status === 0) return 'bun';
  } catch {
    // Not in PATH
  }

  return null;
}

/**
 * Check if Bun is installed and accessible
 */
function isBunInstalled() {
  return getBunPath() !== null;
}

/**
 * Get Bun version if installed
 * Uses shell only for bare command names (PATH resolution), not absolute paths
 */
function getBunVersion() {
  const bunPath = getBunPath();
  if (!bunPath) return null;

  // Only use shell for bare command names that need PATH resolution
  // Absolute paths (containing / or \) don't need shell - avoids libuv assertion
  const isAbsolutePath = bunPath.includes('/') || bunPath.includes('\\');

  try {
    const result = spawnSync(bunPath, ['--version'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: !isAbsolutePath && IS_WINDOWS
    });
    return result.status === 0 ? result.stdout.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Get the uv executable path (from PATH or common install locations)
 * Priority: common paths first (avoids shell), then PATH lookup
 */
function getUvPath() {
  // Check common installation paths FIRST (avoids libuv assertion on Windows)
  // Absolute paths don't need shell resolution
  const absolutePath = UV_COMMON_PATHS.find(existsSync);
  if (absolutePath) return absolutePath;

  // Fall back to PATH lookup (needs shell on Windows for PATH resolution)
  try {
    const result = spawnSync('uv', ['--version'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: IS_WINDOWS  // Only needed for bare command PATH lookup
    });
    if (result.status === 0) return 'uv';
  } catch {
    // Not in PATH
  }

  return null;
}

/**
 * Check if uv is installed and accessible
 */
function isUvInstalled() {
  return getUvPath() !== null;
}

/**
 * Get uv version if installed
 * Uses shell only for bare command names (PATH resolution), not absolute paths
 */
function getUvVersion() {
  const uvPath = getUvPath();
  if (!uvPath) return null;

  // Only use shell for bare command names that need PATH resolution
  // Absolute paths (containing / or \) don't need shell - avoids libuv assertion
  const isAbsolutePath = uvPath.includes('/') || uvPath.includes('\\');

  try {
    const result = spawnSync(uvPath, ['--version'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: !isAbsolutePath && IS_WINDOWS
    });
    return result.status === 0 ? result.stdout.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Install or upgrade Bun automatically based on platform
 */
function installBun(isUpgrade = false) {
  const currentVersion = getBunVersion();
  if (isUpgrade) {
    console.error(`🔧 Bun ${currentVersion} is below minimum ${MIN_BUN_VERSION}. Upgrading...`);
  } else {
    console.error('🔧 Bun not found. Installing Bun runtime...');
  }

  try {
    if (IS_WINDOWS) {
      console.error('   Installing via PowerShell...');
      execSync('powershell -c "irm bun.sh/install.ps1 | iex"', {
        stdio: 'inherit',
        shell: true
      });
    } else {
      console.error('   Installing via curl...');
      execSync('curl -fsSL https://bun.sh/install | bash', {
        stdio: 'inherit',
        shell: true
      });
    }

    if (!isBunInstalled()) {
      throw new Error(
        'Bun installation completed but binary not found. ' +
        'Please restart your terminal and try again.'
      );
    }

    const version = getBunVersion();
    if (!isBunVersionSufficient()) {
      throw new Error(
        `Bun ${version} installed but version ${MIN_BUN_VERSION}+ is required. ` +
        'Please upgrade Bun manually: bun upgrade'
      );
    }
    console.error(`✅ Bun ${version} installed successfully`);
  } catch (error) {
    console.error('❌ Failed to install Bun');
    console.error('   Please install manually:');
    if (IS_WINDOWS) {
      console.error('   - winget install Oven-sh.Bun');
      console.error('   - Or: powershell -c "irm bun.sh/install.ps1 | iex"');
    } else {
      console.error('   - curl -fsSL https://bun.sh/install | bash');
      console.error('   - Or: brew install oven-sh/bun/bun');
    }
    console.error('   Then restart your terminal and try again.');
    throw error;
  }
}

/**
 * Install uv automatically based on platform
 */
function installUv() {
  console.error('🐍 Installing uv for Python/Chroma support...');

  try {
    if (IS_WINDOWS) {
      console.error('   Installing via PowerShell...');
      execSync('powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"', {
        stdio: 'inherit',
        shell: true
      });
    } else {
      console.error('   Installing via curl...');
      execSync('curl -LsSf https://astral.sh/uv/install.sh | sh', {
        stdio: 'inherit',
        shell: true
      });
    }

    if (!isUvInstalled()) {
      throw new Error(
        'uv installation completed but binary not found. ' +
        'Please restart your terminal and try again.'
      );
    }

    const version = getUvVersion();
    console.error(`✅ uv ${version} installed successfully`);
  } catch (error) {
    console.error('❌ Failed to install uv');
    console.error('   Please install manually:');
    if (IS_WINDOWS) {
      console.error('   - winget install astral-sh.uv');
      console.error('   - Or: powershell -c "irm https://astral.sh/uv/install.ps1 | iex"');
    } else {
      console.error('   - curl -LsSf https://astral.sh/uv/install.sh | sh');
      console.error('   - Or: brew install uv (macOS)');
    }
    console.error('   Then restart your terminal and try again.');
    throw error;
  }
}

/**
 * Check if dependencies need to be installed
 */
function needsInstall() {
  if (!existsSync(join(ROOT, 'node_modules'))) return true;
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
    const marker = JSON.parse(readFileSync(MARKER, 'utf-8'));
    return pkg.version !== marker.version || getBunVersion() !== marker.bun;
  } catch {
    return true;
  }
}

/**
 * Install dependencies using Bun
 * Uses spawnSync with argument array to avoid shell and libuv assertion issues
 */
function installDeps() {
  const bunPath = getBunPath();
  if (!bunPath) {
    throw new Error('Bun executable not found');
  }

  console.error('📦 Installing dependencies with Bun...');

  // Use spawnSync with argument array - avoids shell and libuv assertion on Windows
  const result = spawnSync(bunPath, ['install'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false  // Never use shell with absolute paths
  });

  if (result.status !== 0) {
    throw new Error(`bun install failed with exit code ${result.status}`);
  }

  // Write version marker
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
  writeFileSync(MARKER, JSON.stringify({
    version: pkg.version,
    bun: getBunVersion(),
    uv: getUvVersion(),
    installedAt: new Date().toISOString()
  }));
}

// Main execution
try {
  if (!isBunInstalled()) {
    installBun();
  } else if (!isBunVersionSufficient()) {
    installBun(true);  // Upgrade existing installation
  }
  if (!isUvInstalled()) installUv();
  if (needsInstall()) {
    installDeps();
    console.error('✅ Dependencies installed');
  }
} catch (e) {
  console.error('❌ Installation failed:', e.message);
  process.exit(1);
}

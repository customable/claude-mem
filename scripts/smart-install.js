#!/usr/bin/env node
/**
 * Smart Install Script for claude-mem
 *
 * Ensures Bun runtime and uv (Python package manager) are installed
 * (auto-installs if missing) and handles dependency installation when needed.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync, spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { homedir } from 'os';

// Determine the Claude config directory (supports CLAUDE_CONFIG_DIR env var)
const CLAUDE_CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
const ROOT = join(CLAUDE_CONFIG_DIR, 'plugins', 'marketplaces', 'customable');
const PLUGIN_ROOT = join(ROOT, 'plugin');
const MARKER = join(ROOT, '.install-version');
const SETTINGS_PATH = join(CLAUDE_CONFIG_DIR, 'settings.json');
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

/**
 * Register plugin hooks in settings.json
 * Claude Code reads hooks from settings.json, not from a separate hooks.json file.
 * This function merges plugin hooks into the user's settings.json.
 */
function registerHooks() {
  const hooksJsonPath = join(PLUGIN_ROOT, 'hooks', 'hooks.json');

  if (!existsSync(hooksJsonPath)) {
    console.error('⚠️  Plugin hooks.json not found, skipping hook registration');
    return;
  }

  try {
    // Read plugin hooks
    const pluginHooksJson = JSON.parse(readFileSync(hooksJsonPath, 'utf-8'));
    const pluginHooks = pluginHooksJson.hooks;

    if (!pluginHooks) {
      console.error('⚠️  No hooks found in plugin hooks.json');
      return;
    }

    // Replace ${CLAUDE_PLUGIN_ROOT} with actual path
    const hooksString = JSON.stringify(pluginHooks)
      .replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, PLUGIN_ROOT.replace(/\\/g, '\\\\'));
    const resolvedHooks = JSON.parse(hooksString);

    // Read existing settings or create new object
    let settings = {};
    if (existsSync(SETTINGS_PATH)) {
      try {
        const content = readFileSync(SETTINGS_PATH, 'utf-8').trim();
        if (content) {
          settings = JSON.parse(content);
        }
      } catch (parseError) {
        console.error('⚠️  Could not parse existing settings.json, creating backup');
        const backupPath = SETTINGS_PATH + '.backup-' + Date.now();
        writeFileSync(backupPath, readFileSync(SETTINGS_PATH));
      }
    }

    // Check if hooks need updating
    const existingHooksStr = JSON.stringify(settings.hooks || {});
    const newHooksStr = JSON.stringify(resolvedHooks);

    if (existingHooksStr === newHooksStr) {
      // Hooks already up to date
      return;
    }

    // Merge hooks into settings (plugin hooks replace existing hooks for same event types)
    settings.hooks = resolvedHooks;

    // Ensure directory exists
    mkdirSync(dirname(SETTINGS_PATH), { recursive: true });

    // Write updated settings
    writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    console.error('✅ Hooks registered in settings.json');
  } catch (error) {
    console.error('⚠️  Failed to register hooks:', error.message);
    // Don't throw - hook registration failure shouldn't block the plugin
  }
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
  // Always check and register hooks
  registerHooks();
} catch (e) {
  console.error('❌ Installation failed:', e.message);
  process.exit(1);
}

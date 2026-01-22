#!/usr/bin/env node
/**
 * Smart Install Script for claude-mem
 *
 * Ensures Bun runtime and uv (Python package manager) are installed
 * (auto-installs if missing), handles dependency installation when needed,
 * and registers the MCP server in Claude Code configuration.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync, spawnSync } from 'child_process';
import { join, dirname, fileURLToPath } from 'path';
import { homedir } from 'os';

// Determine plugin root: CLAUDE_PLUGIN_ROOT (set by Claude Code) or derive from script location
function getPluginRoot() {
  if (process.env.CLAUDE_PLUGIN_ROOT) {
    return process.env.CLAUDE_PLUGIN_ROOT;
  }
  // Fallback: derive from this script's location (scripts/smart-install.js -> parent dir)
  const __filename = fileURLToPath(import.meta.url);
  return dirname(dirname(__filename));
}

const ROOT = getPluginRoot();
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
 */
function getBunPath() {
  // Try PATH first
  try {
    const result = spawnSync('bun', ['--version'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: IS_WINDOWS,
      windowsHide: true  // Prevent Windows Terminal popup
    });
    if (result.status === 0) return 'bun';
  } catch {
    // Not in PATH
  }

  // Check common installation paths
  return BUN_COMMON_PATHS.find(existsSync) || null;
}

/**
 * Check if Bun is installed and accessible
 */
function isBunInstalled() {
  return getBunPath() !== null;
}

/**
 * Get Bun version if installed
 */
function getBunVersion() {
  const bunPath = getBunPath();
  if (!bunPath) return null;

  try {
    const result = spawnSync(bunPath, ['--version'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: IS_WINDOWS,
      windowsHide: true  // Prevent Windows Terminal popup
    });
    return result.status === 0 ? result.stdout.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Get the uv executable path (from PATH or common install locations)
 */
function getUvPath() {
  // Try PATH first
  try {
    const result = spawnSync('uv', ['--version'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: IS_WINDOWS,
      windowsHide: true  // Prevent Windows Terminal popup
    });
    if (result.status === 0) return 'uv';
  } catch {
    // Not in PATH
  }

  // Check common installation paths
  return UV_COMMON_PATHS.find(existsSync) || null;
}

/**
 * Check if uv is installed and accessible
 */
function isUvInstalled() {
  return getUvPath() !== null;
}

/**
 * Get uv version if installed
 */
function getUvVersion() {
  const uvPath = getUvPath();
  if (!uvPath) return null;

  try {
    const result = spawnSync(uvPath, ['--version'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: IS_WINDOWS,
      windowsHide: true  // Prevent Windows Terminal popup
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
        shell: true,
        windowsHide: true  // Prevent Windows Terminal popup
      });
    } else {
      console.error('   Installing via curl...');
      execSync('curl -fsSL https://bun.sh/install | bash', {
        stdio: 'inherit',
        shell: true,
        windowsHide: true  // Prevent Windows Terminal popup
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
        shell: true,
        windowsHide: true  // Prevent Windows Terminal popup
      });
    } else {
      console.error('   Installing via curl...');
      execSync('curl -LsSf https://astral.sh/uv/install.sh | sh', {
        stdio: 'inherit',
        shell: true,
        windowsHide: true  // Prevent Windows Terminal popup
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
 */
function installDeps() {
  const bunPath = getBunPath();
  if (!bunPath) {
    throw new Error('Bun executable not found');
  }

  console.error('📦 Installing dependencies with Bun...');

  // Quote path for Windows paths with spaces
  const bunCmd = IS_WINDOWS && bunPath.includes(' ') ? `"${bunPath}"` : bunPath;

  execSync(`${bunCmd} install`, { cwd: ROOT, stdio: 'inherit', shell: IS_WINDOWS, windowsHide: true });

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
 * Find the Claude Code config directory for this instance
 * Supports: ~/.claude, ~/.config/claude-work, ~/.config/claude-lab, etc.
 */
function getClaudeConfigDir() {
  // CLAUDE_PLUGIN_ROOT contains the path to the plugin, which includes the config dir
  // e.g., /home/user/.config/claude-lab/plugins/cache/customable/claude-mem/1.2.1
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (pluginRoot) {
    // Extract the base config dir from the plugin path
    const parts = pluginRoot.split('/plugins/');
    if (parts.length >= 2) {
      return parts[0];  // e.g., /home/user/.config/claude-lab
    }
  }
  // Fallback to default ~/.claude
  return join(homedir(), '.claude');
}

/**
 * Register the MCP server in Claude Code's configuration
 */
function registerMcpServer() {
  const configDir = getClaudeConfigDir();
  const claudeJsonPath = join(configDir, '.claude.json');
  const mcpServerPath = join(ROOT, 'scripts', 'mcp-server.cjs');
  const mcpName = 'plugin_claude-mem_mcp-search';

  try {
    let config = {};
    if (existsSync(claudeJsonPath)) {
      config = JSON.parse(readFileSync(claudeJsonPath, 'utf-8'));
    }

    // Initialize mcpServers if not present
    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    // Check if our MCP is already registered with correct path
    const existingMcp = config.mcpServers[mcpName];
    if (existingMcp && existingMcp.args && existingMcp.args[0] === mcpServerPath) {
      return; // Already registered correctly
    }

    // Register/update the MCP server
    config.mcpServers[mcpName] = {
      type: 'stdio',
      command: 'node',
      args: [mcpServerPath]
    };

    // Ensure directory exists
    mkdirSync(dirname(claudeJsonPath), { recursive: true });
    writeFileSync(claudeJsonPath, JSON.stringify(config, null, 2));
    console.error(`✅ MCP server registered in ${claudeJsonPath}`);
  } catch (error) {
    console.error(`⚠️ Could not register MCP server: ${error.message}`);
    // Non-fatal - plugin will still work, just without MCP
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
  // Always ensure MCP is registered
  registerMcpServer();
} catch (e) {
  console.error('❌ Installation failed:', e.message);
  process.exit(1);
}

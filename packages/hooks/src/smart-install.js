#!/usr/bin/env node
/**
 * Smart Install Script for claude-mem
 *
 * Handles dependency installation when needed and registers hooks.
 * Uses npm for package installation (no runtime dependencies required).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { homedir } from 'os';

// Determine the Claude config directory (supports CLAUDE_CONFIG_DIR env var)
const CLAUDE_CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
const ROOT = join(CLAUDE_CONFIG_DIR, 'plugins', 'marketplaces', 'customable');
const PLUGIN_ROOT = ROOT;
const MARKER = join(ROOT, '.install-version');
const SETTINGS_PATH = join(CLAUDE_CONFIG_DIR, 'settings.json');
const IS_WINDOWS = process.platform === 'win32';

/**
 * Check if dependencies need to be installed
 */
function needsInstall() {
  if (!existsSync(join(ROOT, 'node_modules'))) return true;
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
    const marker = JSON.parse(readFileSync(MARKER, 'utf-8'));
    return pkg.version !== marker.version;
  } catch {
    return true;
  }
}

/**
 * Install dependencies using npm
 */
function installDeps() {
  console.error('📦 Installing dependencies...');

  const result = spawnSync('npm', ['install', '--prefer-offline'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: IS_WINDOWS
  });

  if (result.status !== 0) {
    throw new Error(`npm install failed with exit code ${result.status}`);
  }

  // Write version marker
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
  writeFileSync(MARKER, JSON.stringify({
    version: pkg.version,
    installedAt: new Date().toISOString()
  }));
}

/**
 * Register plugin hooks in settings.json
 */
function registerHooks() {
  const hooksJsonPath = join(PLUGIN_ROOT, 'hooks', 'hooks.json');

  if (!existsSync(hooksJsonPath)) {
    console.error('⚠️  Plugin hooks.json not found, skipping hook registration');
    return;
  }

  try {
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
      return;
    }

    settings.hooks = resolvedHooks;
    mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
    writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    console.error('✅ Hooks registered in settings.json');
  } catch (error) {
    console.error('⚠️  Failed to register hooks:', error.message);
  }
}

// Main execution
try {
  if (needsInstall()) {
    installDeps();
    console.error('✅ Dependencies installed');
  }
  registerHooks();
} catch (e) {
  console.error('❌ Installation failed:', e.message);
  process.exit(1);
}

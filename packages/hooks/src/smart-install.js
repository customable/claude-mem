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
const HOOKS_PATH = join(CLAUDE_CONFIG_DIR, 'hooks.json');
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
 * Register plugin hooks in hooks.json
 *
 * Note: We write to hooks.json (not settings.json) because Claude Code
 * reads hooks from hooks.json. This ensures our correctly expanded paths
 * take precedence over any incorrect paths that Claude Code's plugin
 * system might generate (fixing issue #231 where ${CLAUDE_PLUGIN_ROOT}
 * was incorrectly expanded to include /plugin/ subdirectory).
 */
function registerHooks() {
  const pluginHooksPath = join(PLUGIN_ROOT, 'hooks', 'hooks.json');

  if (!existsSync(pluginHooksPath)) {
    console.error('⚠️  Plugin hooks.json not found, skipping hook registration');
    return;
  }

  try {
    const pluginHooksJson = JSON.parse(readFileSync(pluginHooksPath, 'utf-8'));
    const pluginHooks = pluginHooksJson.hooks;

    if (!pluginHooks) {
      console.error('⚠️  No hooks found in plugin hooks.json');
      return;
    }

    // Replace ${CLAUDE_PLUGIN_ROOT} with actual path
    // This is the key fix for #231 - we ensure the path is correct
    // (without /plugin/ subdirectory that Claude Code might incorrectly add)
    const hooksString = JSON.stringify(pluginHooks)
      .replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, PLUGIN_ROOT.replace(/\\/g, '\\\\'));
    const resolvedHooks = JSON.parse(hooksString);

    // Read existing hooks.json or create new object
    let hooksConfig = {};
    if (existsSync(HOOKS_PATH)) {
      try {
        const content = readFileSync(HOOKS_PATH, 'utf-8').trim();
        if (content) {
          hooksConfig = JSON.parse(content);
        }
      } catch (parseError) {
        console.error('⚠️  Could not parse existing hooks.json, creating backup');
        const backupPath = HOOKS_PATH + '.backup-' + Date.now();
        writeFileSync(backupPath, readFileSync(HOOKS_PATH));
      }
    }

    // Merge our hooks with existing hooks
    // Our plugin hooks will override any incorrectly expanded paths
    const existingHooks = hooksConfig.hooks || {};
    const mergedHooks = { ...existingHooks };

    // Merge each hook type, appending our hooks to existing ones
    for (const [hookType, hookArray] of Object.entries(resolvedHooks)) {
      if (Array.isArray(hookArray)) {
        // Replace existing hooks for this type with ours
        // (ensures correct paths take precedence)
        mergedHooks[hookType] = hookArray;
      }
    }

    // Check if hooks need updating
    const existingHooksStr = JSON.stringify(hooksConfig.hooks || {});
    const newHooksStr = JSON.stringify(mergedHooks);

    if (existingHooksStr === newHooksStr) {
      return;
    }

    hooksConfig.hooks = mergedHooks;
    mkdirSync(dirname(HOOKS_PATH), { recursive: true });
    writeFileSync(HOOKS_PATH, JSON.stringify(hooksConfig, null, 2));
    console.error('✅ Hooks registered in hooks.json');
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

#!/usr/bin/env node
/**
 * Build Plugin Script
 *
 * Bundles monorepo packages for plugin distribution:
 * - worker-service.cjs - Hook CLI + backend daemon control
 * - mcp-server.cjs - MCP search server
 * - UI assets (from packages/ui/dist)
 * - plugin/package.json with runtime dependencies
 */

import { build } from 'esbuild';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * Read version from root package.json or packages/hooks
 */
function getVersion() {
  try {
    const hooksPackage = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/hooks/package.json'), 'utf-8'));
    return hooksPackage.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

/**
 * Run a command and wait for completion
 */
function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'inherit', cwd: ROOT, ...options });
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}`));
    });
    proc.on('error', reject);
  });
}

/**
 * Build the plugin
 */
async function buildPlugin() {
  console.log('Building claude-mem plugin...\n');

  const version = getVersion();
  console.log(`Version: ${version}`);

  // Ensure output directories exist
  const scriptsDir = path.join(ROOT, 'plugin/scripts');
  const uiDir = path.join(ROOT, 'plugin/ui');

  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
  }
  if (!fs.existsSync(uiDir)) {
    fs.mkdirSync(uiDir, { recursive: true });
  }

  // Step 1: Build TypeScript packages
  console.log('\n[1/5] Building TypeScript packages...');
  try {
    await runCommand('pnpm', ['build']);
    console.log('TypeScript build complete');
  } catch (err) {
    console.error('TypeScript build failed:', err.message);
    process.exit(1);
  }

  // Step 2: Build UI with Vite
  console.log('\n[2/5] Building UI...');
  try {
    await runCommand('pnpm', ['--filter', '@claude-mem/ui', 'build']);

    // Copy UI dist to plugin/ui
    const uiDistSrc = path.join(ROOT, 'packages/ui/dist');
    if (fs.existsSync(uiDistSrc)) {
      // Copy all files from ui/dist to plugin/ui
      const files = fs.readdirSync(uiDistSrc);
      for (const file of files) {
        const src = path.join(uiDistSrc, file);
        const dest = path.join(uiDir, file);
        if (fs.statSync(src).isDirectory()) {
          fs.cpSync(src, dest, { recursive: true });
        } else {
          fs.copyFileSync(src, dest);
        }
      }
      console.log('UI build complete');
    } else {
      console.log('UI dist not found, skipping');
    }
  } catch (err) {
    console.error('UI build failed:', err.message);
    // Continue - UI is optional
  }

  // Step 3: Bundle worker-service.cjs
  console.log('\n[3/5] Bundling worker-service.cjs...');
  try {
    await build({
      entryPoints: [path.join(ROOT, 'packages/hooks/src/plugin-entry.ts')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'cjs',
      outfile: path.join(scriptsDir, 'worker-service.cjs'),
      minify: true,
      logLevel: 'error',
      external: [
        'bun:sqlite',
        '@xenova/transformers',
        '@qdrant/js-client-rest',
        'onnxruntime-node',
        'sharp',
      ],
      define: {
        '__PLUGIN_VERSION__': JSON.stringify(version),
      },
      banner: {
        js: '#!/usr/bin/env bun',
      },
    });
    fs.chmodSync(path.join(scriptsDir, 'worker-service.cjs'), 0o755);
    const stats = fs.statSync(path.join(scriptsDir, 'worker-service.cjs'));
    console.log(`worker-service.cjs built (${(stats.size / 1024).toFixed(2)} KB)`);
  } catch (err) {
    console.error('worker-service.cjs build failed:', err.message);
    process.exit(1);
  }

  // Step 4: Bundle mcp-server.cjs
  console.log('\n[4/5] Bundling mcp-server.cjs...');
  try {
    await build({
      entryPoints: [path.join(ROOT, 'packages/hooks/src/mcp-entry.ts')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'cjs',
      outfile: path.join(scriptsDir, 'mcp-server.cjs'),
      minify: true,
      logLevel: 'error',
      external: [
        'bun:sqlite',
      ],
      define: {
        '__PLUGIN_VERSION__': JSON.stringify(version),
      },
      banner: {
        js: '#!/usr/bin/env node',
      },
    });
    fs.chmodSync(path.join(scriptsDir, 'mcp-server.cjs'), 0o755);
    const stats = fs.statSync(path.join(scriptsDir, 'mcp-server.cjs'));
    console.log(`mcp-server.cjs built (${(stats.size / 1024).toFixed(2)} KB)`);
  } catch (err) {
    console.error('mcp-server.cjs build failed:', err.message);
    process.exit(1);
  }

  // Step 5: Generate plugin/package.json
  console.log('\n[5/5] Generating plugin/package.json...');
  const pluginPackageJson = {
    name: 'claude-mem-plugin',
    version: version,
    private: true,
    description: 'Runtime dependencies for claude-mem bundled hooks',
    type: 'module',
    dependencies: {
      '@xenova/transformers': '^2.17.0',
      '@qdrant/js-client-rest': '^1.12.0',
    },
    engines: {
      node: '>=18.0.0',
      bun: '>=1.0.0',
    },
  };
  fs.writeFileSync(
    path.join(ROOT, 'plugin/package.json'),
    JSON.stringify(pluginPackageJson, null, 2) + '\n'
  );
  console.log('plugin/package.json generated');

  // Update version in plugin.json
  const pluginJsonPath = path.join(ROOT, 'plugin/.claude-plugin/plugin.json');
  if (fs.existsSync(pluginJsonPath)) {
    const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'));
    pluginJson.version = version;
    fs.writeFileSync(pluginJsonPath, JSON.stringify(pluginJson, null, 2) + '\n');
    console.log('plugin.json version updated');
  }

  console.log('\nPlugin build complete!');
  console.log(`Output: ${path.relative(ROOT, path.join(ROOT, 'plugin'))}/`);
  console.log('  - scripts/worker-service.cjs');
  console.log('  - scripts/mcp-server.cjs');
  console.log('  - ui/');
  console.log('  - package.json');
}

// Run
buildPlugin().catch((err) => {
  console.error('\nBuild failed:', err);
  process.exit(1);
});

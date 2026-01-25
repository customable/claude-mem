#!/usr/bin/env node
/**
 * Build Plugin Script
 *
 * Bundles monorepo packages for plugin distribution:
 * - worker-service.cjs - Hook CLI entry point
 * - mcp-server.cjs - MCP search server
 * - sse-writer.cjs - CLAUDE.md file writer (SSE listener)
 * - smart-install.js - Installation helper
 * - plugin/package.json with runtime dependencies
 *
 * Note: Backend and Worker run separately (Docker/systemd).
 * This script only builds the plugin hooks.
 */

import { build } from 'esbuild';
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
 * Build the plugin
 */
async function buildPlugin() {
  console.log('Building claude-mem plugin...\n');

  const version = getVersion();
  console.log(`Version: ${version}`);

  // Ensure output directories exist
  const scriptsDir = path.join(ROOT, 'plugin/scripts');

  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
  }

  // Step 1: Bundle worker-service.cjs
  console.log('\n[1/5] Bundling worker-service.cjs...');
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
        '@xenova/transformers',
        '@qdrant/js-client-rest',
        'onnxruntime-node',
        'sharp',
      ],
      define: {
        '__PLUGIN_VERSION__': JSON.stringify(version),
      },
      banner: {
        js: '#!/usr/bin/env node',
      },
    });
    fs.chmodSync(path.join(scriptsDir, 'worker-service.cjs'), 0o755);
    const stats = fs.statSync(path.join(scriptsDir, 'worker-service.cjs'));
    console.log(`worker-service.cjs built (${(stats.size / 1024).toFixed(2)} KB)`);
  } catch (err) {
    console.error('worker-service.cjs build failed:', err.message);
    process.exit(1);
  }

  // Step 2: Bundle mcp-server.cjs
  console.log('\n[2/5] Bundling mcp-server.cjs...');
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
      external: [],
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

  // Step 3: Bundle sse-writer.cjs (for CLAUDE.md file writing)
  console.log('\n[3/5] Bundling sse-writer.cjs...');
  try {
    await build({
      entryPoints: [path.join(ROOT, 'packages/hooks/src/sse-writer.ts')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'cjs',
      outfile: path.join(scriptsDir, 'sse-writer.cjs'),
      minify: true,
      logLevel: 'error',
      external: [
        'eventsource', // Keep external - loaded from plugin/node_modules
      ],
      define: {
        '__PLUGIN_VERSION__': JSON.stringify(version),
      },
      banner: {
        js: '#!/usr/bin/env node',
      },
    });
    fs.chmodSync(path.join(scriptsDir, 'sse-writer.cjs'), 0o755);
    const stats = fs.statSync(path.join(scriptsDir, 'sse-writer.cjs'));
    console.log(`sse-writer.cjs built (${(stats.size / 1024).toFixed(2)} KB)`);
  } catch (err) {
    console.error('sse-writer.cjs build failed:', err.message);
    process.exit(1);
  }

  // Step 4: Copy smart-install.js
  console.log('\n[4/5] Copying smart-install.js...');
  try {
    const smartInstallSrc = path.join(ROOT, 'packages/hooks/src/smart-install.js');
    const smartInstallDest = path.join(scriptsDir, 'smart-install.js');
    fs.copyFileSync(smartInstallSrc, smartInstallDest);
    const stats = fs.statSync(smartInstallDest);
    console.log(`smart-install.js copied (${(stats.size / 1024).toFixed(2)} KB)`);
  } catch (err) {
    console.error('smart-install.js copy failed:', err.message);
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
      'eventsource': '^3.0.6',
    },
    engines: {
      node: '>=18.0.0',
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
  console.log('  - scripts/worker-service.cjs (hook CLI)');
  console.log('  - scripts/mcp-server.cjs (MCP search server)');
  console.log('  - scripts/sse-writer.cjs (CLAUDE.md file writer)');
  console.log('  - scripts/smart-install.js');
  console.log('  - package.json');
}

// Run
buildPlugin().catch((err) => {
  console.error('\nBuild failed:', err);
  process.exit(1);
});

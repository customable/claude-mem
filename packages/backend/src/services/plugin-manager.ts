/**
 * Plugin Manager Service
 *
 * Manages custom plugins that can process observations before/after storage.
 * Plugins are loaded from ~/.claude-mem/plugins/ directory.
 */

import fs from 'fs';
import path from 'path';
import { createLogger, DATA_DIR } from '@claude-mem/shared';
import type {
  Plugin,
  PluginConfig,
  PluginMetadata,
  RegisteredPlugin,
  ObservationInput,
  IPluginManager,
  ObservationRecord,
  SessionSummaryRecord,
  ObservationType,
} from '@claude-mem/types';

const logger = createLogger('plugin-manager');

/**
 * Default plugin configuration
 */
const DEFAULT_CONFIG: PluginConfig = {
  enabled: true,
  settings: {},
};

/**
 * Plugin Manager
 *
 * Handles plugin loading, registration, and hook execution.
 */
export class PluginManager implements IPluginManager {
  private plugins: Map<string, RegisteredPlugin> = new Map();
  private pluginDir: string;

  constructor(pluginDir?: string) {
    this.pluginDir = pluginDir || path.join(DATA_DIR, 'plugins');
  }

  /**
   * Load all plugins from plugin directory
   */
  async loadPlugins(): Promise<void> {
    // Ensure plugin directory exists
    if (!fs.existsSync(this.pluginDir)) {
      fs.mkdirSync(this.pluginDir, { recursive: true });
      logger.info(`Created plugin directory: ${this.pluginDir}`);
      return;
    }

    const entries = fs.readdirSync(this.pluginDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Look for plugin.js or index.js in the directory
        const pluginPath = path.join(this.pluginDir, entry.name);
        await this.loadPluginFromPath(pluginPath);
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
        // Single file plugin
        const pluginPath = path.join(this.pluginDir, entry.name);
        await this.loadPluginFromPath(pluginPath);
      }
    }

    logger.info(`Loaded ${this.plugins.size} plugins`);
  }

  /**
   * Load a single plugin from path
   */
  private async loadPluginFromPath(pluginPath: string): Promise<void> {
    try {
      let modulePath = pluginPath;

      if (fs.statSync(pluginPath).isDirectory()) {
        // Try plugin.js, then index.js
        const candidates = ['plugin.js', 'plugin.mjs', 'index.js', 'index.mjs'];
        let found = false;
        for (const candidate of candidates) {
          const candidatePath = path.join(pluginPath, candidate);
          if (fs.existsSync(candidatePath)) {
            modulePath = candidatePath;
            found = true;
            break;
          }
        }
        if (!found) {
          logger.warn(`No plugin entry point found in: ${pluginPath}`);
          return;
        }
      }

      // Dynamic import
      const module = await import(modulePath);
      const plugin: Plugin = module.default || module.plugin || module;

      // Validate plugin
      if (!plugin.metadata || !plugin.metadata.name) {
        logger.warn(`Invalid plugin (missing metadata.name): ${modulePath}`);
        return;
      }

      // Load config from plugin.json if exists
      const configPath = path.join(
        fs.statSync(pluginPath).isDirectory() ? pluginPath : path.dirname(pluginPath),
        'plugin.json'
      );
      let config: PluginConfig = { ...DEFAULT_CONFIG };
      if (fs.existsSync(configPath)) {
        try {
          const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          config = { ...DEFAULT_CONFIG, ...configData };
        } catch {
          logger.warn(`Failed to parse plugin config: ${configPath}`);
        }
      }

      // Register the plugin
      this.registerPlugin(plugin, config);
      logger.info(`Loaded plugin: ${plugin.metadata.name} v${plugin.metadata.version}`);
    } catch (error) {
      logger.error(`Failed to load plugin from ${pluginPath}:`, { error: (error as Error).message });
    }
  }

  /**
   * Register a plugin
   */
  registerPlugin(plugin: Plugin, config?: Partial<PluginConfig>): void {
    const finalConfig: PluginConfig = { ...DEFAULT_CONFIG, ...config };

    this.plugins.set(plugin.metadata.name, {
      plugin,
      config: finalConfig,
      loadedAt: Date.now(),
    });

    // Call onLoad hook
    if (finalConfig.enabled && plugin.onLoad) {
      try {
        const result = plugin.onLoad();
        if (result instanceof Promise) {
          result.catch(err => {
            logger.error(`Plugin onLoad failed: ${plugin.metadata.name}`, { error: err.message });
          });
        }
      } catch (error) {
        logger.error(`Plugin onLoad failed: ${plugin.metadata.name}`, { error: (error as Error).message });
      }
    }
  }

  /**
   * Unregister a plugin
   */
  unregisterPlugin(name: string): void {
    const registered = this.plugins.get(name);
    if (!registered) return;

    // Call onUnload hook
    if (registered.plugin.onUnload) {
      try {
        const result = registered.plugin.onUnload();
        if (result instanceof Promise) {
          result.catch(err => {
            logger.error(`Plugin onUnload failed: ${name}`, { error: err.message });
          });
        }
      } catch (error) {
        logger.error(`Plugin onUnload failed: ${name}`, { error: (error as Error).message });
      }
    }

    this.plugins.delete(name);
    logger.info(`Unregistered plugin: ${name}`);
  }

  /**
   * Get registered plugin
   */
  getPlugin(name: string): RegisteredPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): RegisteredPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Enable/disable a plugin
   */
  setPluginEnabled(name: string, enabled: boolean): void {
    const registered = this.plugins.get(name);
    if (!registered) {
      throw new Error(`Plugin not found: ${name}`);
    }

    registered.config.enabled = enabled;
    logger.info(`Plugin ${name} ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update plugin settings
   */
  updatePluginSettings(name: string, settings: Record<string, unknown>): void {
    const registered = this.plugins.get(name);
    if (!registered) {
      throw new Error(`Plugin not found: ${name}`);
    }

    registered.config.settings = { ...registered.config.settings, ...settings };
    logger.info(`Updated settings for plugin: ${name}`);
  }

  /**
   * Check if plugin should process observation
   */
  private shouldProcess(registered: RegisteredPlugin, observation: { type: ObservationType; project: string }): boolean {
    if (!registered.config.enabled) return false;

    const { observationTypes, projects } = registered.plugin.metadata;

    // Check observation type filter
    if (observationTypes && observationTypes.length > 0) {
      if (!observationTypes.includes(observation.type)) return false;
    }

    // Check project filter
    if (projects && projects.length > 0) {
      if (!projects.includes(observation.project)) return false;
    }

    return true;
  }

  /**
   * Run pre-observation hooks
   * Returns null if any plugin filters the observation
   */
  async runBeforeObservation(observation: ObservationInput): Promise<ObservationInput | null> {
    let current: ObservationInput | null = observation;

    for (const registered of this.plugins.values()) {
      if (!this.shouldProcess(registered, observation)) continue;
      if (!registered.plugin.onBeforeObservation) continue;

      try {
        const result = registered.plugin.onBeforeObservation(current!);
        const resolved = result instanceof Promise ? await result : result;

        if (resolved === null) {
          logger.debug(`Observation filtered by plugin: ${registered.plugin.metadata.name}`);
          return null;
        }

        current = resolved;
      } catch (error) {
        logger.error(`Plugin onBeforeObservation failed: ${registered.plugin.metadata.name}`, {
          error: (error as Error).message,
        });
        // Continue with other plugins
      }
    }

    return current;
  }

  /**
   * Run post-observation hooks
   */
  async runAfterObservation(observation: ObservationRecord): Promise<void> {
    for (const registered of this.plugins.values()) {
      if (!this.shouldProcess(registered, observation)) continue;
      if (!registered.plugin.onAfterObservation) continue;

      try {
        const result = registered.plugin.onAfterObservation(observation);
        if (result instanceof Promise) {
          await result;
        }
      } catch (error) {
        logger.error(`Plugin onAfterObservation failed: ${registered.plugin.metadata.name}`, {
          error: (error as Error).message,
        });
        // Continue with other plugins
      }
    }
  }

  /**
   * Run summary hooks
   */
  async runSummaryHooks(summary: SessionSummaryRecord): Promise<void> {
    for (const registered of this.plugins.values()) {
      if (!registered.config.enabled) continue;
      if (!registered.plugin.onSummary) continue;

      try {
        const result = registered.plugin.onSummary(summary);
        if (result instanceof Promise) {
          await result;
        }
      } catch (error) {
        logger.error(`Plugin onSummary failed: ${registered.plugin.metadata.name}`, {
          error: (error as Error).message,
        });
        // Continue with other plugins
      }
    }
  }

  /**
   * Get plugin directory path
   */
  getPluginDir(): string {
    return this.pluginDir;
  }
}

/**
 * Create a plugin manager instance
 */
export function createPluginManager(pluginDir?: string): PluginManager {
  return new PluginManager(pluginDir);
}

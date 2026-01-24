/**
 * Plugins Routes
 *
 * API endpoints for plugin management.
 */

import type { Request, Response } from 'express';
import { BaseRouter } from './base-router.js';
import type { PluginManager } from '../services/plugin-manager.js';

/**
 * Helper to get string from params
 */
function getString(val: unknown): string | undefined {
  if (Array.isArray(val)) return val[0];
  if (typeof val === 'string') return val;
  return undefined;
}

function getRequiredString(val: unknown): string {
  if (Array.isArray(val)) return val[0] ?? '';
  if (typeof val === 'string') return val;
  return '';
}

export interface PluginsRouterDeps {
  pluginManager: PluginManager;
}

export class PluginsRouter extends BaseRouter {
  constructor(private readonly deps: PluginsRouterDeps) {
    super();
  }

  protected setupRoutes(): void {
    // List all plugins
    this.router.get('/', this.asyncHandler(this.listPlugins.bind(this)));

    // Get plugin details
    this.router.get('/:name', this.asyncHandler(this.getPlugin.bind(this)));

    // Enable/disable plugin
    this.router.post('/:name/enable', this.asyncHandler(this.enablePlugin.bind(this)));
    this.router.post('/:name/disable', this.asyncHandler(this.disablePlugin.bind(this)));

    // Update plugin settings
    this.router.put('/:name/settings', this.asyncHandler(this.updateSettings.bind(this)));

    // Reload all plugins
    this.router.post('/reload', this.asyncHandler(this.reloadPlugins.bind(this)));

    // Get plugin directory info
    this.router.get('/info/directory', this.asyncHandler(this.getDirectory.bind(this)));
  }

  /**
   * GET /api/plugins
   * List all registered plugins
   */
  private async listPlugins(_req: Request, res: Response): Promise<void> {
    const plugins = this.deps.pluginManager.getAllPlugins();

    const data = plugins.map(p => ({
      name: p.plugin.metadata.name,
      displayName: p.plugin.metadata.displayName || p.plugin.metadata.name,
      version: p.plugin.metadata.version,
      description: p.plugin.metadata.description,
      author: p.plugin.metadata.author,
      enabled: p.config.enabled,
      observationTypes: p.plugin.metadata.observationTypes || [],
      projects: p.plugin.metadata.projects || [],
      loadedAt: p.loadedAt,
      hasHooks: {
        onBeforeObservation: !!p.plugin.onBeforeObservation,
        onAfterObservation: !!p.plugin.onAfterObservation,
        onSummary: !!p.plugin.onSummary,
      },
    }));

    this.success(res, {
      plugins: data,
      total: data.length,
      directory: this.deps.pluginManager.getPluginDir(),
    });
  }

  /**
   * GET /api/plugins/:name
   * Get details of a specific plugin
   */
  private async getPlugin(req: Request, res: Response): Promise<void> {
    const name = getRequiredString(req.params.name);

    const registered = this.deps.pluginManager.getPlugin(name);
    if (!registered) {
      this.notFound(`Plugin not found: ${name}`);
    }

    this.success(res, {
      name: registered.plugin.metadata.name,
      displayName: registered.plugin.metadata.displayName || registered.plugin.metadata.name,
      version: registered.plugin.metadata.version,
      description: registered.plugin.metadata.description,
      author: registered.plugin.metadata.author,
      enabled: registered.config.enabled,
      settings: registered.config.settings,
      observationTypes: registered.plugin.metadata.observationTypes || [],
      projects: registered.plugin.metadata.projects || [],
      loadedAt: registered.loadedAt,
      hasHooks: {
        onBeforeObservation: !!registered.plugin.onBeforeObservation,
        onAfterObservation: !!registered.plugin.onAfterObservation,
        onSummary: !!registered.plugin.onSummary,
        onLoad: !!registered.plugin.onLoad,
        onUnload: !!registered.plugin.onUnload,
      },
    });
  }

  /**
   * POST /api/plugins/:name/enable
   * Enable a plugin
   */
  private async enablePlugin(req: Request, res: Response): Promise<void> {
    const name = getRequiredString(req.params.name);

    try {
      this.deps.pluginManager.setPluginEnabled(name, true);
      this.success(res, { name, enabled: true });
    } catch (error) {
      this.notFound((error as Error).message);
    }
  }

  /**
   * POST /api/plugins/:name/disable
   * Disable a plugin
   */
  private async disablePlugin(req: Request, res: Response): Promise<void> {
    const name = getRequiredString(req.params.name);

    try {
      this.deps.pluginManager.setPluginEnabled(name, false);
      this.success(res, { name, enabled: false });
    } catch (error) {
      this.notFound((error as Error).message);
    }
  }

  /**
   * PUT /api/plugins/:name/settings
   * Update plugin settings
   */
  private async updateSettings(req: Request, res: Response): Promise<void> {
    const name = getRequiredString(req.params.name);
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      this.badRequest('settings object is required');
    }

    try {
      this.deps.pluginManager.updatePluginSettings(name, settings);
      const registered = this.deps.pluginManager.getPlugin(name);
      this.success(res, {
        name,
        settings: registered?.config.settings,
      });
    } catch (error) {
      this.notFound((error as Error).message);
    }
  }

  /**
   * POST /api/plugins/reload
   * Reload all plugins from disk
   */
  private async reloadPlugins(_req: Request, res: Response): Promise<void> {
    await this.deps.pluginManager.loadPlugins();
    const plugins = this.deps.pluginManager.getAllPlugins();

    this.success(res, {
      reloaded: true,
      count: plugins.length,
    });
  }

  /**
   * GET /api/plugins/info/directory
   * Get plugin directory path
   */
  private async getDirectory(_req: Request, res: Response): Promise<void> {
    this.success(res, {
      directory: this.deps.pluginManager.getPluginDir(),
    });
  }
}

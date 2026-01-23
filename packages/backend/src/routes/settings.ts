/**
 * Settings Router
 *
 * Provides API endpoints for reading and updating settings.
 */

import type { Request, Response } from 'express';
import { BaseRouter } from './base-router.js';
import { loadSettings, saveSettings, type Settings } from '@claude-mem/shared';

export interface SettingsRouterDeps {
  // No dependencies needed - uses shared settings functions
}

export class SettingsRouter extends BaseRouter {
  constructor(_deps: SettingsRouterDeps = {}) {
    super();
  }

  protected setupRoutes(): void {
    // GET /api/settings - Get current settings
    this.router.get(
      '/',
      this.asyncHandler(async (_req: Request, res: Response) => {
        const settings = loadSettings();
        // Mask sensitive values for display
        const safeSettings = { ...settings };
        if (safeSettings.MISTRAL_API_KEY) {
          safeSettings.MISTRAL_API_KEY = this.maskApiKey(safeSettings.MISTRAL_API_KEY);
        }
        if (safeSettings.ANTHROPIC_API_KEY) {
          safeSettings.ANTHROPIC_API_KEY = this.maskApiKey(safeSettings.ANTHROPIC_API_KEY);
        }
        if (safeSettings.OPENROUTER_API_KEY) {
          safeSettings.OPENROUTER_API_KEY = this.maskApiKey(safeSettings.OPENROUTER_API_KEY);
        }
        if (safeSettings.WORKER_AUTH_TOKEN) {
          safeSettings.WORKER_AUTH_TOKEN = this.maskApiKey(safeSettings.WORKER_AUTH_TOKEN);
        }
        this.success(res, safeSettings);
      })
    );

    // POST /api/settings - Update settings
    this.router.post(
      '/',
      this.asyncHandler(async (req: Request, res: Response) => {
        const updates = req.body as Partial<Settings>;

        // Load current settings
        const current = loadSettings();

        // Merge updates, ignoring masked API keys
        const merged: Partial<Settings> = { ...current };
        for (const [key, value] of Object.entries(updates)) {
          // Skip masked API keys (they start with *** and haven't changed)
          if (typeof value === 'string' && value.startsWith('***')) {
            continue;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (merged as any)[key] = value;
        }

        // Save updated settings
        saveSettings(merged);

        this.success(res, { message: 'Settings saved' });
      })
    );

    // GET /api/settings/raw - Get settings without masking (for internal use)
    this.router.get(
      '/raw',
      this.asyncHandler(async (_req: Request, res: Response) => {
        const settings = loadSettings();
        this.success(res, settings);
      })
    );
  }

  private maskApiKey(key: string): string {
    if (!key || key.length < 8) return '***';
    return `***${key.slice(-4)}`;
  }
}

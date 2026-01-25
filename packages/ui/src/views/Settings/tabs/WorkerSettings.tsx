/**
 * WorkerSettings Tab
 *
 * Worker configuration including spawning, restart policies, and authentication.
 */

import type { TabProps } from '../types';
import { ALL_PROVIDERS } from '../constants';
import { FormField, ApiKeyInput } from '../components';

export function WorkerSettings({ settings, onChange, errors }: TabProps) {
  const enabledProviders = (settings.ENABLED_PROVIDERS || '').split(',').filter(Boolean);
  const autoSpawnProviders = (settings.AUTO_SPAWN_PROVIDERS || '').split(',').filter(Boolean);

  const toggleAutoSpawnProvider = (providerId: string) => {
    const current = new Set(autoSpawnProviders);
    if (current.has(providerId)) {
      current.delete(providerId);
    } else {
      current.add(providerId);
    }
    onChange('AUTO_SPAWN_PROVIDERS', Array.from(current).join(','));
  };

  const generateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    onChange('WORKER_AUTH_TOKEN', token);
  };

  const copyToken = async () => {
    if (settings.WORKER_AUTH_TOKEN) {
      await navigator.clipboard.writeText(settings.WORKER_AUTH_TOKEN);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <h3 className="text-lg font-medium">Worker Settings</h3>
      <p className="text-sm text-base-content/60">
        Configure how workers process tasks
      </p>

      <FormField
        label="Max Workers"
        hint="Maximum number of workers that can be spawned from the UI"
        error={errors.MAX_WORKERS}
      >
        <input
          type="number"
          className={`input input-bordered w-full ${errors.MAX_WORKERS ? 'input-error' : ''}`}
          placeholder="4"
          min="1"
          max="100"
          value={settings.MAX_WORKERS || ''}
          onChange={(e) => onChange('MAX_WORKERS', parseInt(e.target.value) || 4)}
        />
      </FormField>

      <fieldset className="fieldset">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox"
            checked={settings.EMBEDDED_WORKER ?? true}
            onChange={(e) => onChange('EMBEDDED_WORKER', e.target.checked)}
          />
          <span className="fieldset-legend">Embedded Worker</span>
        </label>
        <p className="fieldset-label text-base-content/60">
          Run worker in the same process as the backend (for plugins)
        </p>
      </fieldset>

      <div className="divider">Auto-Spawn Workers</div>

      <fieldset className="fieldset">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox"
            checked={settings.AUTO_SPAWN_WORKERS ?? false}
            onChange={(e) => onChange('AUTO_SPAWN_WORKERS', e.target.checked)}
          />
          <span className="fieldset-legend">Auto-Spawn on Startup</span>
        </label>
        <p className="fieldset-label text-base-content/60">
          Automatically spawn workers when the backend starts
        </p>
      </fieldset>

      {settings.AUTO_SPAWN_WORKERS && (
        <>
          <FormField
            label="Auto-Spawn Count"
            hint="Number of workers to spawn automatically on startup"
          >
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="2"
              min="1"
              max={settings.MAX_WORKERS || 4}
              value={settings.AUTO_SPAWN_WORKER_COUNT || ''}
              onChange={(e) => onChange('AUTO_SPAWN_WORKER_COUNT', parseInt(e.target.value) || 2)}
            />
          </FormField>

          <FormField
            label="Providers for Auto-Spawn"
            hint="Which providers to cycle through when spawning. If none selected, uses default provider."
          >
            {enabledProviders.length === 0 ? (
              <div className="alert alert-warning">
                <span className="iconify ph--warning size-4" />
                <span>No providers enabled. Configure providers in the AI Provider tab first.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {enabledProviders.map((providerId) => {
                  const providerInfo = ALL_PROVIDERS.find(p => p.id === providerId);
                  const selected = autoSpawnProviders.includes(providerId);
                  return (
                    <label
                      key={providerId}
                      className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                        selected ? 'bg-primary/10 border-primary' : 'border-base-300 hover:border-base-content/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={selected}
                        onChange={() => toggleAutoSpawnProvider(providerId)}
                      />
                      <span>{providerInfo?.name || providerId}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </FormField>
        </>
      )}

      <div className="divider">Worker Mode</div>

      <FormField
        label="Worker Mode"
        hint="How workers are managed"
      >
        <select
          className="select select-bordered w-full"
          value={settings.WORKER_MODE || 'spawn'}
          onChange={(e) => onChange('WORKER_MODE', e.target.value)}
        >
          <option value="spawn">Spawn (Separate processes)</option>
          <option value="in-process">In-Process (Same process)</option>
          <option value="hybrid">Hybrid (Mixed)</option>
        </select>
      </FormField>

      {(settings.WORKER_MODE === 'in-process' || settings.WORKER_MODE === 'hybrid') && (
        <>
          <FormField
            label="In-Process Timeout (minutes)"
            hint="Maximum runtime for in-process workers"
          >
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="30"
              min="1"
              value={settings.IN_PROCESS_WORKER_TIMEOUT || ''}
              onChange={(e) => onChange('IN_PROCESS_WORKER_TIMEOUT', parseInt(e.target.value) || 30)}
            />
          </FormField>

          <FormField
            label="Idle Exit (seconds)"
            hint="Exit in-process worker after this many idle seconds"
          >
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="120"
              min="0"
              value={settings.IN_PROCESS_WORKER_IDLE_EXIT || ''}
              onChange={(e) => onChange('IN_PROCESS_WORKER_IDLE_EXIT', parseInt(e.target.value) || 120)}
            />
          </FormField>
        </>
      )}

      <div className="divider">Restart Policy</div>

      <FormField
        label="Restart Policy"
        hint="When to automatically restart crashed workers"
      >
        <select
          className="select select-bordered w-full"
          value={settings.WORKER_RESTART_POLICY || 'on-failure'}
          onChange={(e) => onChange('WORKER_RESTART_POLICY', e.target.value)}
        >
          <option value="never">Never</option>
          <option value="on-failure">On Failure</option>
          <option value="always">Always</option>
        </select>
      </FormField>

      {settings.WORKER_RESTART_POLICY !== 'never' && (
        <>
          <FormField
            label="Max Restarts"
            hint="Stop restarting after this many attempts (0 = unlimited)"
          >
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="5"
              min="0"
              value={settings.WORKER_MAX_RESTARTS || ''}
              onChange={(e) => onChange('WORKER_MAX_RESTARTS', parseInt(e.target.value) || 5)}
            />
          </FormField>

          <FormField
            label="Restart Delay (ms)"
            hint="Initial delay before restarting"
          >
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="3000"
              min="0"
              step="1000"
              value={settings.WORKER_RESTART_DELAY_MS || ''}
              onChange={(e) => onChange('WORKER_RESTART_DELAY_MS', parseInt(e.target.value) || 3000)}
            />
          </FormField>

          <FormField
            label="Backoff Multiplier"
            hint="Multiply delay by this factor for each restart"
          >
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="2"
              min="1"
              step="0.5"
              value={settings.WORKER_RESTART_BACKOFF_MULTIPLIER || ''}
              onChange={(e) => onChange('WORKER_RESTART_BACKOFF_MULTIPLIER', parseFloat(e.target.value) || 2)}
            />
          </FormField>
        </>
      )}

      <div className="divider">Authentication</div>

      <FormField
        label="Worker Auth Token"
        hint="Required for external workers. Localhost workers only need token when one is set."
      >
        <div className="flex gap-2">
          <div className="flex-1">
            <ApiKeyInput
              value={settings.WORKER_AUTH_TOKEN || ''}
              onChange={(v) => onChange('WORKER_AUTH_TOKEN', v)}
              placeholder="Secret token..."
            />
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-square"
            onClick={copyToken}
            disabled={!settings.WORKER_AUTH_TOKEN}
            title="Copy token"
          >
            <span className="iconify ph--copy size-5" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-square"
            onClick={generateToken}
            title="Generate new token"
          >
            <span className="iconify ph--arrows-clockwise size-5" />
          </button>
        </div>
      </FormField>

      <div className="alert alert-info">
        <span className="iconify ph--info size-5" />
        <span>External workers (non-localhost) always require authentication.</span>
      </div>
    </div>
  );
}

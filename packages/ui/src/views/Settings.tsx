/**
 * Settings View
 *
 * Configure claude-mem settings with improved DaisyUI 5 forms.
 */

import { useState, useEffect, useCallback } from 'react';

type SettingsTab = 'general' | 'provider' | 'context' | 'workers' | 'advanced';

interface Settings {
  // General
  LOG_LEVEL?: string;
  DATA_DIR?: string;

  // Provider
  AI_PROVIDER?: string;
  ENABLED_PROVIDERS?: string; // Comma-separated list
  MISTRAL_API_KEY?: string;
  MISTRAL_MODEL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_BASE_URL?: string;
  ANTHROPIC_API_KEY?: string;

  // Context
  CONTEXT_OBSERVATION_LIMIT?: number;
  CONTEXT_SHOW_READ_TOKENS?: boolean;
  CONTEXT_SHOW_WORK_TOKENS?: boolean;

  // Workers
  MAX_WORKERS?: number;
  AUTO_SPAWN_WORKERS?: boolean;
  AUTO_SPAWN_WORKER_COUNT?: number;
  AUTO_SPAWN_PROVIDERS?: string; // Comma-separated list
  EMBEDDED_WORKER?: boolean;
  WORKER_AUTH_TOKEN?: string;

  // Advanced
  BACKEND_PORT?: number;
  BACKEND_BIND?: string;
  DATABASE_TYPE?: string;
  DATABASE_PATH?: string;
  BATCH_SIZE?: number;

  // Retention
  RETENTION_ENABLED?: boolean;
  RETENTION_MAX_AGE_DAYS?: number;
  RETENTION_MAX_COUNT?: number;

  // Features
  CLAUDEMD_ENABLED?: boolean;

  [key: string]: unknown;
}

const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'general', label: 'General', icon: 'ph--gear' },
  { id: 'provider', label: 'AI Provider', icon: 'ph--brain' },
  { id: 'context', label: 'Context', icon: 'ph--stack' },
  { id: 'workers', label: 'Workers', icon: 'ph--cpu' },
  { id: 'advanced', label: 'Advanced', icon: 'ph--wrench' },
];

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [settings, setSettings] = useState<Settings>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Failed to load settings');
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleChange = (key: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSuccess(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error('Failed to save settings');
      setHasChanges(false);
      setSuccess('Settings saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    fetchSettings();
    setHasChanges(false);
    setSuccess(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="text-sm text-base-content/60">
            Configure your claude-mem instance
          </p>
        </div>
        {hasChanges && (
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={handleReset}>
              <span className="iconify ph--arrow-counter-clockwise size-4" />
              Reset
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <span className="iconify ph--floppy-disk size-4" />
              )}
              Save Changes
            </button>
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error">
          <span className="iconify ph--warning-circle size-5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          <span className="iconify ph--check-circle size-5" />
          <span>{success}</span>
        </div>
      )}

      {/* Tabs */}
      <div role="tablist" className="tabs tabs-box">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className={`iconify ${tab.icon} size-4 mr-1.5`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card bg-base-100 card-border">
        <div className="card-body">
          {activeTab === 'general' && (
            <GeneralSettings settings={settings} onChange={handleChange} />
          )}
          {activeTab === 'provider' && (
            <ProviderSettings settings={settings} onChange={handleChange} />
          )}
          {activeTab === 'context' && (
            <ContextSettings settings={settings} onChange={handleChange} />
          )}
          {activeTab === 'workers' && (
            <WorkerSettings settings={settings} onChange={handleChange} />
          )}
          {activeTab === 'advanced' && (
            <AdvancedSettings settings={settings} onChange={handleChange} />
          )}
        </div>
      </div>
    </div>
  );
}

interface TabProps {
  settings: Settings;
  onChange: (key: string, value: unknown) => void;
}

// Reusable form field component
function FormField({
  label,
  hint,
  badge,
  children,
}: {
  label: string;
  hint?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend flex items-center gap-2">
        {label}
        {badge}
      </legend>
      {children}
      {hint && <p className="fieldset-label text-base-content/60">{hint}</p>}
    </fieldset>
  );
}

// API Key input with show/hide toggle
function ApiKeyInput({
  value,
  onChange,
  placeholder = 'Enter API key...',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <label className="input input-bordered flex items-center gap-2 w-full">
      <span className="iconify ph--key size-4 text-base-content/50" />
      <input
        type={show ? 'text' : 'password'}
        className="grow"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="btn btn-ghost btn-xs btn-circle"
        onClick={() => setShow(!show)}
      >
        <span className={`iconify ${show ? 'ph--eye-slash' : 'ph--eye'} size-4`} />
      </button>
    </label>
  );
}

function GeneralSettings({ settings, onChange }: TabProps) {
  return (
    <div className="space-y-6 max-w-lg">
      <h3 className="text-lg font-medium">General Settings</h3>

      <FormField label="Log Level" hint="Verbosity of log output">
        <select
          className="select select-bordered w-full"
          value={settings.LOG_LEVEL || 'info'}
          onChange={(e) => onChange('LOG_LEVEL', e.target.value)}
        >
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>
      </FormField>

      <FormField label="Data Directory" hint="Where claude-mem stores its data">
        <input
          type="text"
          className="input input-bordered w-full"
          placeholder="~/.claude-mem"
          value={settings.DATA_DIR || ''}
          onChange={(e) => onChange('DATA_DIR', e.target.value)}
        />
      </FormField>

      <div className="divider">Data Retention</div>

      <fieldset className="fieldset">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox"
            checked={settings.RETENTION_ENABLED ?? false}
            onChange={(e) => onChange('RETENTION_ENABLED', e.target.checked)}
          />
          <span className="fieldset-legend">Enable Data Retention</span>
        </label>
        <p className="fieldset-label text-base-content/60">
          Automatically clean up old observations and sessions
        </p>
      </fieldset>

      {settings.RETENTION_ENABLED && (
        <>
          <FormField
            label="Max Age (Days)"
            hint="Delete data older than this many days (0 = disabled)"
          >
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="0"
              min="0"
              value={settings.RETENTION_MAX_AGE_DAYS || ''}
              onChange={(e) => onChange('RETENTION_MAX_AGE_DAYS', parseInt(e.target.value) || 0)}
            />
          </FormField>

          <FormField
            label="Max Count"
            hint="Keep only the most recent N observations per project (0 = unlimited)"
          >
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="0"
              min="0"
              value={settings.RETENTION_MAX_COUNT || ''}
              onChange={(e) => onChange('RETENTION_MAX_COUNT', parseInt(e.target.value) || 0)}
            />
          </FormField>
        </>
      )}

      <div className="divider">Features</div>

      <fieldset className="fieldset">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox"
            checked={settings.CLAUDEMD_ENABLED ?? false}
            onChange={(e) => onChange('CLAUDEMD_ENABLED', e.target.checked)}
          />
          <span className="fieldset-legend">CLAUDE.md Generation</span>
        </label>
        <p className="fieldset-label text-base-content/60">
          Automatically generate and update CLAUDE.md files in project folders with session context
        </p>
      </fieldset>
    </div>
  );
}

const ALL_PROVIDERS = [
  { id: 'mistral', name: 'Mistral', keyField: 'MISTRAL_API_KEY' },
  { id: 'gemini', name: 'Google Gemini', keyField: 'GEMINI_API_KEY' },
  { id: 'openrouter', name: 'OpenRouter', keyField: 'OPENROUTER_API_KEY' },
  { id: 'openai', name: 'OpenAI', keyField: 'OPENAI_API_KEY' },
  { id: 'anthropic', name: 'Anthropic', keyField: 'ANTHROPIC_API_KEY' },
] as const;

function ProviderSettings({ settings, onChange }: TabProps) {
  const provider = settings.AI_PROVIDER || 'mistral';
  const enabledProviders = (settings.ENABLED_PROVIDERS || '').split(',').filter(Boolean);

  const toggleProvider = (providerId: string) => {
    const current = new Set(enabledProviders);
    if (current.has(providerId)) {
      current.delete(providerId);
    } else {
      current.add(providerId);
    }
    onChange('ENABLED_PROVIDERS', Array.from(current).join(','));
  };

  // Check if a provider has an API key configured
  const hasApiKey = (providerId: string) => {
    const providerInfo = ALL_PROVIDERS.find(p => p.id === providerId);
    if (!providerInfo) return false;
    const key = settings[providerInfo.keyField as keyof Settings] as string | undefined;
    return !!key && key.length > 0;
  };

  return (
    <div className="space-y-6 max-w-lg">
      <h3 className="text-lg font-medium">AI Provider Settings</h3>

      <FormField
        label="Default AI Provider"
        hint="Primary provider for observations and summaries"
      >
        <select
          className="select select-bordered w-full"
          value={provider}
          onChange={(e) => onChange('AI_PROVIDER', e.target.value)}
        >
          <option value="mistral">Mistral</option>
          <option value="gemini">Google Gemini</option>
          <option value="openrouter">OpenRouter</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic Claude</option>
        </select>
      </FormField>

      <div className="divider">Enabled Providers</div>

      <p className="text-sm text-base-content/60">
        Select which providers are available for spawning workers. Only providers with API keys can be enabled.
      </p>

      <div className="space-y-2">
        {ALL_PROVIDERS.map((p) => {
          const configured = hasApiKey(p.id);
          const enabled = enabledProviders.includes(p.id);
          return (
            <label
              key={p.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                enabled ? 'bg-primary/10 border-primary' : 'border-base-300 hover:border-base-content/30'
              } ${!configured ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={enabled}
                disabled={!configured}
                onChange={() => toggleProvider(p.id)}
              />
              <span className="flex-1">{p.name}</span>
              {configured ? (
                <span className="badge badge-success badge-sm">Configured</span>
              ) : (
                <span className="badge badge-ghost badge-sm">No API Key</span>
              )}
            </label>
          );
        })}
      </div>

      {/* Mistral */}
      {provider === 'mistral' && (
        <>
          <div className="divider">Mistral Configuration</div>
          <FormField
            label="API Key"
            badge={<span className="badge badge-success badge-sm">1B free tokens/month</span>}
          >
            <ApiKeyInput
              value={settings.MISTRAL_API_KEY || ''}
              onChange={(v) => onChange('MISTRAL_API_KEY', v)}
            />
          </FormField>
          <FormField label="Model" hint="e.g. mistral-small-latest, devstral-latest">
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="mistral-small-latest"
              value={settings.MISTRAL_MODEL || ''}
              onChange={(e) => onChange('MISTRAL_MODEL', e.target.value)}
            />
          </FormField>
        </>
      )}

      {/* Gemini */}
      {provider === 'gemini' && (
        <>
          <div className="divider">Google Gemini Configuration</div>
          <FormField label="API Key">
            <ApiKeyInput
              value={settings.GEMINI_API_KEY || ''}
              onChange={(v) => onChange('GEMINI_API_KEY', v)}
            />
          </FormField>
          <FormField label="Model" hint="e.g. gemini-2.5-flash-lite">
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="gemini-2.5-flash-lite"
              value={settings.GEMINI_MODEL || ''}
              onChange={(e) => onChange('GEMINI_MODEL', e.target.value)}
            />
          </FormField>
        </>
      )}

      {/* OpenRouter */}
      {provider === 'openrouter' && (
        <>
          <div className="divider">OpenRouter Configuration</div>
          <FormField label="API Key">
            <ApiKeyInput
              value={settings.OPENROUTER_API_KEY || ''}
              onChange={(v) => onChange('OPENROUTER_API_KEY', v)}
            />
          </FormField>
          <FormField label="Model" hint="e.g. mistralai/mistral-small-3.1-24b-instruct:free">
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="mistralai/mistral-small-3.1-24b-instruct:free"
              value={settings.OPENROUTER_MODEL || ''}
              onChange={(e) => onChange('OPENROUTER_MODEL', e.target.value)}
            />
          </FormField>
        </>
      )}

      {/* OpenAI */}
      {provider === 'openai' && (
        <>
          <div className="divider">OpenAI Configuration</div>
          <FormField label="API Key">
            <ApiKeyInput
              value={settings.OPENAI_API_KEY || ''}
              onChange={(v) => onChange('OPENAI_API_KEY', v)}
            />
          </FormField>
          <FormField label="Model" hint="e.g. gpt-4o-mini">
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="gpt-4o-mini"
              value={settings.OPENAI_MODEL || ''}
              onChange={(e) => onChange('OPENAI_MODEL', e.target.value)}
            />
          </FormField>
          <FormField label="Base URL (Optional)" hint="For OpenAI-compatible APIs">
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="https://api.openai.com/v1"
              value={settings.OPENAI_BASE_URL || ''}
              onChange={(e) => onChange('OPENAI_BASE_URL', e.target.value)}
            />
          </FormField>
        </>
      )}

      {/* Anthropic */}
      {provider === 'anthropic' && (
        <>
          <div className="divider">Anthropic Configuration</div>
          <FormField label="API Key">
            <ApiKeyInput
              value={settings.ANTHROPIC_API_KEY || ''}
              onChange={(v) => onChange('ANTHROPIC_API_KEY', v)}
            />
          </FormField>
        </>
      )}
    </div>
  );
}

function ContextSettings({ settings, onChange }: TabProps) {
  return (
    <div className="space-y-6 max-w-lg">
      <h3 className="text-lg font-medium">Context Injection Settings</h3>
      <p className="text-sm text-base-content/60">
        Configure what context is injected into Claude sessions
      </p>

      <FormField
        label="Observation Limit"
        hint="Maximum number of recent observations to include in context"
      >
        <input
          type="number"
          className="input input-bordered w-full"
          placeholder="50"
          min="1"
          max="200"
          value={settings.CONTEXT_OBSERVATION_LIMIT || ''}
          onChange={(e) => onChange('CONTEXT_OBSERVATION_LIMIT', parseInt(e.target.value) || 50)}
        />
      </FormField>

      <div className="divider">Token Display</div>

      <fieldset className="fieldset">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox"
            checked={settings.CONTEXT_SHOW_READ_TOKENS ?? true}
            onChange={(e) => onChange('CONTEXT_SHOW_READ_TOKENS', e.target.checked)}
          />
          <span className="fieldset-legend">Show Read Tokens</span>
        </label>
        <p className="fieldset-label text-base-content/60">
          Display token counts for file reads in observations
        </p>
      </fieldset>

      <fieldset className="fieldset">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox"
            checked={settings.CONTEXT_SHOW_WORK_TOKENS ?? true}
            onChange={(e) => onChange('CONTEXT_SHOW_WORK_TOKENS', e.target.checked)}
          />
          <span className="fieldset-legend">Show Work Tokens</span>
        </label>
        <p className="fieldset-label text-base-content/60">
          Display token counts for edits and writes in observations
        </p>
      </fieldset>
    </div>
  );
}

function WorkerSettings({ settings, onChange }: TabProps) {
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
      >
        <input
          type="number"
          className="input input-bordered w-full"
          placeholder="4"
          min="1"
          max="16"
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

function AdvancedSettings({ settings, onChange }: TabProps) {
  const [isRestarting, setIsRestarting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const handleRestart = async () => {
    if (!confirm('Are you sure you want to restart the backend? All connections will be temporarily interrupted.')) {
      return;
    }

    setIsRestarting(true);
    try {
      await fetch('/api/admin/restart', { method: 'POST' });
      // Wait a bit then reload the page
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (err) {
      console.error('Restart failed:', err);
      setIsRestarting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/export');
      if (!response.ok) throw new Error('Export failed');
      const data = await response.json();

      // Create and download file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `claude-mem-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Import failed');
      }

      const result = await response.json();
      setImportSuccess(`Imported ${result.sessions || 0} sessions and ${result.observations || 0} observations`);
    } catch (err) {
      console.error('Import failed:', err);
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <h3 className="text-lg font-medium">Advanced Settings</h3>

      <div className="alert alert-warning">
        <span className="iconify ph--warning size-5" />
        <div className="flex-1">
          <span>Changes to these settings require a restart</span>
        </div>
        <button
          className="btn btn-sm btn-warning"
          onClick={handleRestart}
          disabled={isRestarting}
        >
          {isRestarting ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              Restarting...
            </>
          ) : (
            <>
              <span className="iconify ph--arrow-clockwise size-4" />
              Restart Backend
            </>
          )}
        </button>
      </div>

      <div className="divider">Network</div>

      <FormField label="Backend Port" hint="HTTP/WebSocket port for the backend">
        <input
          type="number"
          className="input input-bordered w-full"
          placeholder="37777"
          value={settings.BACKEND_PORT || ''}
          onChange={(e) => onChange('BACKEND_PORT', parseInt(e.target.value) || 37777)}
        />
      </FormField>

      <FormField label="Bind Address" hint="0.0.0.0 for network access, 127.0.0.1 for local only">
        <select
          className="select select-bordered w-full"
          value={settings.BACKEND_BIND || '127.0.0.1'}
          onChange={(e) => onChange('BACKEND_BIND', e.target.value)}
        >
          <option value="127.0.0.1">127.0.0.1 (Local only)</option>
          <option value="0.0.0.0">0.0.0.0 (Network accessible)</option>
        </select>
      </FormField>

      <div className="divider">Database</div>

      <FormField label="Database Type">
        <select
          className="select select-bordered w-full"
          value={settings.DATABASE_TYPE || 'sqlite'}
          onChange={(e) => onChange('DATABASE_TYPE', e.target.value)}
        >
          <option value="sqlite">SQLite (Recommended)</option>
          <option value="postgres">PostgreSQL</option>
        </select>
      </FormField>

      <FormField label="Database Path" hint="Path to SQLite database file">
        <input
          type="text"
          className="input input-bordered w-full"
          placeholder="~/.claude-mem/claude-mem.db"
          value={settings.DATABASE_PATH || ''}
          onChange={(e) => onChange('DATABASE_PATH', e.target.value)}
        />
      </FormField>

      <div className="divider">Processing</div>

      <FormField
        label="Batch Size"
        hint="Number of items to process in each batch"
      >
        <input
          type="number"
          className="input input-bordered w-full"
          placeholder="5"
          min="1"
          max="50"
          value={settings.BATCH_SIZE || ''}
          onChange={(e) => onChange('BATCH_SIZE', parseInt(e.target.value) || 5)}
        />
      </FormField>

      <div className="divider">Data Management</div>

      {importError && (
        <div className="alert alert-error">
          <span className="iconify ph--warning-circle size-5" />
          <span>{importError}</span>
          <button
            className="btn btn-ghost btn-xs btn-circle"
            onClick={() => setImportError(null)}
          >
            <span className="iconify ph--x size-4" />
          </button>
        </div>
      )}

      {importSuccess && (
        <div className="alert alert-success">
          <span className="iconify ph--check-circle size-5" />
          <span>{importSuccess}</span>
          <button
            className="btn btn-ghost btn-xs btn-circle"
            onClick={() => setImportSuccess(null)}
          >
            <span className="iconify ph--x size-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between p-4 rounded-lg border border-base-300">
          <div>
            <div className="font-medium">Export Data</div>
            <div className="text-sm text-base-content/60">
              Download all sessions and observations as JSON
            </div>
          </div>
          <button
            className="btn btn-outline"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                Exporting...
              </>
            ) : (
              <>
                <span className="iconify ph--download size-5" />
                Export
              </>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border border-base-300">
          <div>
            <div className="font-medium">Import Data</div>
            <div className="text-sm text-base-content/60">
              Restore sessions and observations from a backup
            </div>
          </div>
          <label className={`btn btn-outline ${isImporting ? 'btn-disabled' : ''}`}>
            {isImporting ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                Importing...
              </>
            ) : (
              <>
                <span className="iconify ph--upload size-5" />
                Import
              </>
            )}
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
              disabled={isImporting}
            />
          </label>
        </div>
      </div>

      <div className="alert alert-info">
        <span className="iconify ph--info size-5" />
        <span>Import merges data with existing records. Duplicate IDs are skipped.</span>
      </div>
    </div>
  );
}

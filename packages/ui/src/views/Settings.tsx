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
    </div>
  );
}

function ProviderSettings({ settings, onChange }: TabProps) {
  const provider = settings.AI_PROVIDER || 'mistral';

  return (
    <div className="space-y-6 max-w-lg">
      <h3 className="text-lg font-medium">AI Provider Settings</h3>

      <FormField
        label="AI Provider"
        hint="Which AI provider to use for observations and summaries"
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
            checked={settings.AUTO_SPAWN_WORKERS ?? false}
            onChange={(e) => onChange('AUTO_SPAWN_WORKERS', e.target.checked)}
          />
          <span className="fieldset-legend">Auto-Spawn Workers</span>
        </label>
        <p className="fieldset-label text-base-content/60">
          Automatically spawn workers when the backend starts
        </p>
      </fieldset>

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

      <div className="divider">Authentication</div>

      <FormField
        label="Worker Auth Token"
        hint="Shared secret for authenticating external workers (leave empty for no auth)"
      >
        <ApiKeyInput
          value={settings.WORKER_AUTH_TOKEN || ''}
          onChange={(v) => onChange('WORKER_AUTH_TOKEN', v)}
          placeholder="Secret token..."
        />
      </FormField>
    </div>
  );
}

function AdvancedSettings({ settings, onChange }: TabProps) {
  return (
    <div className="space-y-6 max-w-lg">
      <h3 className="text-lg font-medium">Advanced Settings</h3>

      <div className="alert alert-warning">
        <span className="iconify ph--warning size-5" />
        <span>Changes to these settings require a restart</span>
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
    </div>
  );
}

/**
 * Settings View
 *
 * Configure claude-mem settings with improved DaisyUI 5 forms.
 */

import { useState, useEffect, useCallback } from 'react';

type SettingsTab = 'general' | 'provider' | 'context' | 'advanced';

interface Settings {
  // General
  DEFAULT_PROJECT?: string;
  LOG_LEVEL?: string;

  // Provider
  OBSERVATION_MODEL?: string;
  MISTRAL_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;

  // Context
  CONTEXT_MAX_TOKENS?: number;
  CONTEXT_LOOKBACK_DAYS?: number;
  CONTEXT_INCLUDE_SUMMARIES?: boolean;

  // Advanced
  BACKEND_PORT?: number;
  BACKEND_BIND?: string;
  DATABASE_PATH?: string;
  WORKER_AUTH_TOKEN?: string;

  [key: string]: unknown;
}

const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'general', label: 'General', icon: 'ph--gear' },
  { id: 'provider', label: 'Provider', icon: 'ph--cpu' },
  { id: 'context', label: 'Context', icon: 'ph--stack' },
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

      <FormField
        label="Default Project"
        hint="Default project name for new sessions"
      >
        <input
          type="text"
          className="input input-bordered w-full"
          placeholder="my-project"
          value={settings.DEFAULT_PROJECT || ''}
          onChange={(e) => onChange('DEFAULT_PROJECT', e.target.value)}
        />
      </FormField>

      <FormField label="Log Level">
        <select
          className="select select-bordered w-full"
          value={settings.LOG_LEVEL || 'INFO'}
          onChange={(e) => onChange('LOG_LEVEL', e.target.value)}
        >
          <option value="DEBUG">Debug</option>
          <option value="INFO">Info</option>
          <option value="WARN">Warning</option>
          <option value="ERROR">Error</option>
        </select>
      </FormField>
    </div>
  );
}

function ProviderSettings({ settings, onChange }: TabProps) {
  return (
    <div className="space-y-6 max-w-lg">
      <h3 className="text-lg font-medium">AI Provider Settings</h3>

      <FormField
        label="Observation Model"
        hint="Model used for generating observations"
      >
        <select
          className="select select-bordered w-full"
          value={settings.OBSERVATION_MODEL || 'mistral'}
          onChange={(e) => onChange('OBSERVATION_MODEL', e.target.value)}
        >
          <option value="mistral">Mistral (Recommended)</option>
          <option value="anthropic">Anthropic Claude</option>
          <option value="openrouter">OpenRouter</option>
        </select>
      </FormField>

      <div className="divider">API Keys</div>

      <FormField
        label="Mistral API Key"
        badge={<span className="badge badge-success badge-sm">1B free tokens/month</span>}
      >
        <ApiKeyInput
          value={settings.MISTRAL_API_KEY || ''}
          onChange={(v) => onChange('MISTRAL_API_KEY', v)}
        />
      </FormField>

      <FormField label="Anthropic API Key">
        <ApiKeyInput
          value={settings.ANTHROPIC_API_KEY || ''}
          onChange={(v) => onChange('ANTHROPIC_API_KEY', v)}
        />
      </FormField>

      <FormField label="OpenRouter API Key">
        <ApiKeyInput
          value={settings.OPENROUTER_API_KEY || ''}
          onChange={(v) => onChange('OPENROUTER_API_KEY', v)}
        />
      </FormField>
    </div>
  );
}

function ContextSettings({ settings, onChange }: TabProps) {
  return (
    <div className="space-y-6 max-w-lg">
      <h3 className="text-lg font-medium">Context Injection Settings</h3>

      <FormField
        label="Max Context Tokens"
        hint="Maximum tokens to inject as context"
      >
        <input
          type="number"
          className="input input-bordered w-full"
          placeholder="8000"
          value={settings.CONTEXT_MAX_TOKENS || ''}
          onChange={(e) => onChange('CONTEXT_MAX_TOKENS', parseInt(e.target.value) || undefined)}
        />
      </FormField>

      <FormField
        label="Lookback Days"
        hint="How many days of history to consider for context"
      >
        <input
          type="number"
          className="input input-bordered w-full"
          placeholder="30"
          value={settings.CONTEXT_LOOKBACK_DAYS || ''}
          onChange={(e) => onChange('CONTEXT_LOOKBACK_DAYS', parseInt(e.target.value) || undefined)}
        />
      </FormField>

      <fieldset className="fieldset">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox"
            checked={settings.CONTEXT_INCLUDE_SUMMARIES ?? true}
            onChange={(e) => onChange('CONTEXT_INCLUDE_SUMMARIES', e.target.checked)}
          />
          <span className="fieldset-legend">Include Session Summaries</span>
        </label>
        <p className="fieldset-label text-base-content/60">
          Include session summaries in context injection
        </p>
      </fieldset>
    </div>
  );
}

function AdvancedSettings({ settings, onChange }: TabProps) {
  return (
    <div className="space-y-6 max-w-lg">
      <h3 className="text-lg font-medium">Advanced Settings</h3>

      <div className="alert alert-warning">
        <span className="iconify ph--warning size-5" />
        <span>Changes to these settings may require a restart</span>
      </div>

      <FormField label="Backend Port">
        <input
          type="number"
          className="input input-bordered w-full"
          placeholder="37777"
          value={settings.BACKEND_PORT || ''}
          onChange={(e) => onChange('BACKEND_PORT', parseInt(e.target.value) || undefined)}
        />
      </FormField>

      <FormField label="Backend Bind Address">
        <input
          type="text"
          className="input input-bordered w-full"
          placeholder="127.0.0.1"
          value={settings.BACKEND_BIND || ''}
          onChange={(e) => onChange('BACKEND_BIND', e.target.value)}
        />
      </FormField>

      <FormField label="Database Path">
        <input
          type="text"
          className="input input-bordered w-full"
          placeholder="~/.claude-mem/claude-mem.db"
          value={settings.DATABASE_PATH || ''}
          onChange={(e) => onChange('DATABASE_PATH', e.target.value)}
        />
      </FormField>

      <FormField
        label="Worker Auth Token"
        hint="Shared secret for authenticating workers"
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

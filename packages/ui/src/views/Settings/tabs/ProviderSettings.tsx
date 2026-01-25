/**
 * ProviderSettings Tab
 *
 * AI provider configuration including API keys and model selection.
 */

import type { TabProps, Settings } from '../types';
import { ALL_PROVIDERS } from '../constants';
import { FormField, ApiKeyInput } from '../components';

export function ProviderSettings({ settings, onChange, errors: _errors }: TabProps) {
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
    const key = settings[providerInfo.apiKeyKey as keyof Settings] as string | undefined;
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

      <div className="divider">Embedding Provider</div>

      <FormField
        label="Embedding Provider"
        hint="Provider for generating vector embeddings (semantic search)"
      >
        <select
          className="select select-bordered w-full"
          value={settings.EMBEDDING_PROVIDER || 'local'}
          onChange={(e) => onChange('EMBEDDING_PROVIDER', e.target.value)}
        >
          <option value="local">Local (Transformers.js)</option>
          <option value="mistral">Mistral Embed API</option>
        </select>
      </FormField>

      {settings.EMBEDDING_PROVIDER === 'mistral' && (
        <FormField
          label="Mistral Embedding Model"
          hint="Model for generating embeddings (requires Mistral API key)"
        >
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="mistral-embed"
            value={settings.MISTRAL_EMBEDDING_MODEL || ''}
            onChange={(e) => onChange('MISTRAL_EMBEDDING_MODEL', e.target.value)}
          />
        </FormField>
      )}
    </div>
  );
}

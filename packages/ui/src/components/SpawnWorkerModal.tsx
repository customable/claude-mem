/**
 * Spawn Worker Modal (Issue #254)
 *
 * Configuration modal for spawning new workers.
 * Allows selecting provider before spawning.
 */

import { useState, useEffect } from 'react';
import type { SpawnStatus } from '../api/client';

interface SpawnWorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSpawn: (config: { provider?: string }) => Promise<void>;
  spawnStatus: SpawnStatus | null;
  isSpawning: boolean;
}

/**
 * Provider display info
 */
const PROVIDER_INFO: Record<string, { name: string; description: string; icon: string }> = {
  mistral: {
    name: 'Mistral',
    description: 'Fast and efficient for most tasks',
    icon: 'ph--lightning',
  },
  gemini: {
    name: 'Gemini',
    description: 'Google AI with strong reasoning',
    icon: 'ph--google-logo',
  },
  openrouter: {
    name: 'OpenRouter',
    description: 'Access multiple models via one API',
    icon: 'ph--arrows-split',
  },
  openai: {
    name: 'OpenAI',
    description: 'GPT models with broad capabilities',
    icon: 'ph--openai-logo',
  },
  anthropic: {
    name: 'Anthropic',
    description: 'Claude models for complex tasks',
    icon: 'ph--brain',
  },
};

export function SpawnWorkerModal({
  isOpen,
  onClose,
  onSpawn,
  spawnStatus,
  isSpawning,
}: SpawnWorkerModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>('');

  // Initialize with default provider when modal opens
  useEffect(() => {
    if (isOpen && spawnStatus?.defaultProvider) {
      setSelectedProvider(spawnStatus.defaultProvider);
    }
  }, [isOpen, spawnStatus?.defaultProvider]);

  // Get available providers
  const enabledProviders = spawnStatus?.enabledProviders ?? [];
  const defaultProvider = spawnStatus?.defaultProvider ?? '';

  const handleSpawn = async () => {
    await onSpawn({ provider: selectedProvider || undefined });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className="iconify ph--rocket-launch size-5 text-primary" />
            Worker konfigurieren
          </h3>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle"
            disabled={isSpawning}
          >
            <span className="iconify ph--x size-5" />
          </button>
        </div>

        {/* Provider Selection */}
        <div className="form-control mb-6">
          <label className="label">
            <span className="label-text font-medium">AI Provider</span>
            {defaultProvider && (
              <span className="label-text-alt text-base-content/60">
                Standard: {PROVIDER_INFO[defaultProvider]?.name ?? defaultProvider}
              </span>
            )}
          </label>

          {enabledProviders.length > 0 ? (
            <div className="space-y-2">
              {enabledProviders.map((provider) => {
                const info = PROVIDER_INFO[provider] ?? {
                  name: provider,
                  description: 'AI provider',
                  icon: 'ph--cpu',
                };
                const isSelected = selectedProvider === provider;
                const isDefault = provider === defaultProvider;

                return (
                  <label
                    key={provider}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border-2 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-base-300 hover:border-base-content/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="provider"
                      value={provider}
                      checked={isSelected}
                      onChange={(e) => setSelectedProvider(e.target.value)}
                      className="radio radio-primary"
                    />
                    <span className={`iconify ${info.icon} size-5 ${isSelected ? 'text-primary' : 'text-base-content/60'}`} />
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {info.name}
                        {isDefault && (
                          <span className="badge badge-xs badge-outline">Standard</span>
                        )}
                      </div>
                      <div className="text-sm text-base-content/60">{info.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="alert alert-warning">
              <span className="iconify ph--warning size-5" />
              <span>Keine Provider konfiguriert. Bitte Settings prüfen.</span>
            </div>
          )}
        </div>

        {/* Spawn Status Info */}
        {spawnStatus && (
          <div className="mb-6 p-3 bg-base-200 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-base-content/70">Aktive Worker</span>
              <span className="font-mono">
                {spawnStatus.spawnedCount} / {spawnStatus.maxWorkers}
              </span>
            </div>
            {!spawnStatus.canSpawnMore && (
              <div className="mt-2 text-sm text-warning flex items-center gap-2">
                <span className="iconify ph--warning size-4" />
                Maximum erreicht
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="modal-action">
          <button
            onClick={onClose}
            className="btn btn-ghost"
            disabled={isSpawning}
          >
            Abbrechen
          </button>
          <button
            onClick={handleSpawn}
            className="btn btn-primary"
            disabled={isSpawning || !spawnStatus?.canSpawnMore || enabledProviders.length === 0}
          >
            {isSpawning ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Starte...
              </>
            ) : (
              <>
                <span className="iconify ph--play size-4" />
                Worker starten
              </>
            )}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose} />
    </div>
  );
}

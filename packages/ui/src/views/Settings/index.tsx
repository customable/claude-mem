/**
 * Settings View
 *
 * Configure claude-mem settings with improved DaisyUI 5 forms.
 * Modularized into separate tab components for better maintainability.
 */

import { useState, useEffect, useCallback } from 'react';

import type { SettingsTab, Settings } from './types';
import { TABS, VALIDATION_RULES, CRITICAL_SETTINGS } from './constants';
import {
  GeneralSettings,
  ProviderSettings,
  ContextSettings,
  WorkerSettings,
  ProcessingSettings,
  AdvancedSettings,
} from './tabs';

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [settings, setSettings] = useState<Settings>({});
  const [originalSettings, setOriginalSettings] = useState<Settings>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setValidationErrors({});
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Failed to load settings');
      const data = await response.json();
      setSettings(data);
      setOriginalSettings(data);
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
    // Validate if rule exists (Issue #287)
    if (VALIDATION_RULES[key]) {
      const rule = VALIDATION_RULES[key];
      if (!rule.validate(value)) {
        setValidationErrors((prev) => ({ ...prev, [key]: rule.message }));
      } else {
        setValidationErrors((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    }

    // Check if this is a critical setting that needs confirmation (Issue #287)
    const criticalInfo = CRITICAL_SETTINGS[key];
    if (criticalInfo && value !== originalSettings[key]) {
      // Special case: REMOTE_MODE only needs confirmation when enabling
      if (key === 'REMOTE_MODE' && value === false) {
        applyChange(key, value);
        return;
      }

      setConfirmDialog({
        open: true,
        title: criticalInfo.title,
        message: criticalInfo.message,
        onConfirm: () => {
          applyChange(key, value);
          setConfirmDialog(null);
        },
      });
      return;
    }

    applyChange(key, value);
  };

  const applyChange = (key: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSuccess(null);
  };

  const handleSave = async () => {
    // Check for validation errors before saving (Issue #287)
    if (Object.keys(validationErrors).length > 0) {
      setError('Please fix validation errors before saving');
      return;
    }

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
      setOriginalSettings(settings);
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
    setValidationErrors({});
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  const hasValidationErrors = Object.keys(validationErrors).length > 0;

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
              disabled={isSaving || hasValidationErrors}
              title={hasValidationErrors ? 'Fix validation errors first' : undefined}
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
            <GeneralSettings settings={settings} onChange={handleChange} errors={validationErrors} />
          )}
          {activeTab === 'provider' && (
            <ProviderSettings settings={settings} onChange={handleChange} errors={validationErrors} />
          )}
          {activeTab === 'context' && (
            <ContextSettings settings={settings} onChange={handleChange} errors={validationErrors} />
          )}
          {activeTab === 'workers' && (
            <WorkerSettings settings={settings} onChange={handleChange} errors={validationErrors} />
          )}
          {activeTab === 'processing' && (
            <ProcessingSettings settings={settings} onChange={handleChange} errors={validationErrors} />
          )}
          {activeTab === 'advanced' && (
            <AdvancedSettings settings={settings} onChange={handleChange} errors={validationErrors} />
          )}
        </div>
      </div>

      {/* Confirmation Dialog (Issue #287) */}
      {confirmDialog?.open && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <span className="iconify ph--warning text-warning size-6" />
              {confirmDialog.title}
            </h3>
            <p className="py-4">{confirmDialog.message}</p>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setConfirmDialog(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-warning"
                onClick={confirmDialog.onConfirm}
              >
                Continue
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setConfirmDialog(null)} />
        </div>
      )}
    </div>
  );
}

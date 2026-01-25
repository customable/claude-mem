/**
 * GeneralSettings Tab
 *
 * General settings including log level, data directory, retention, and features.
 */

import type { TabProps } from '../types';
import { FormField } from '../components';

export function GeneralSettings({ settings, onChange, errors }: TabProps) {
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
            error={errors.RETENTION_MAX_AGE_DAYS}
          >
            <input
              type="number"
              className={`input input-bordered w-full ${errors.RETENTION_MAX_AGE_DAYS ? 'input-error' : ''}`}
              placeholder="0"
              min="0"
              value={settings.RETENTION_MAX_AGE_DAYS || ''}
              onChange={(e) => onChange('RETENTION_MAX_AGE_DAYS', parseInt(e.target.value) || 0)}
            />
          </FormField>

          <FormField
            label="Max Count"
            hint="Keep only the most recent N observations per project (0 = unlimited)"
            error={errors.RETENTION_MAX_COUNT}
          >
            <input
              type="number"
              className={`input input-bordered w-full ${errors.RETENTION_MAX_COUNT ? 'input-error' : ''}`}
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

      {settings.CLAUDEMD_ENABLED && (
        <>
          <FormField
            label="Observation Interval"
            hint="Generate CLAUDE.md after every N observations (default: 10)"
          >
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="10"
              min="1"
              max="100"
              value={settings.CLAUDEMD_OBSERVATION_INTERVAL || ''}
              onChange={(e) => onChange('CLAUDEMD_OBSERVATION_INTERVAL', parseInt(e.target.value) || 10)}
            />
          </FormField>

          <FormField
            label="Task Timeout (ms)"
            hint="Maximum time for CLAUDE.md generation tasks (default: 600000 = 10 min)"
            error={errors.CLAUDEMD_TASK_TIMEOUT}
          >
            <input
              type="number"
              className={`input input-bordered w-full ${errors.CLAUDEMD_TASK_TIMEOUT ? 'input-error' : ''}`}
              placeholder="600000"
              min="1000"
              step="1000"
              value={settings.CLAUDEMD_TASK_TIMEOUT || ''}
              onChange={(e) => onChange('CLAUDEMD_TASK_TIMEOUT', parseInt(e.target.value) || 600000)}
            />
          </FormField>

          <FormField
            label="Max Subdirectories"
            hint="Maximum subdirectories to generate per trigger (default: 5)"
          >
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="5"
              min="1"
              max="20"
              value={settings.CLAUDEMD_MAX_SUBDIRS || ''}
              onChange={(e) => onChange('CLAUDEMD_MAX_SUBDIRS', parseInt(e.target.value) || 5)}
            />
          </FormField>
        </>
      )}

      <div className="divider">Security</div>

      <fieldset className="fieldset">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox"
            checked={settings.SECRET_DETECTION_ENABLED ?? true}
            onChange={(e) => onChange('SECRET_DETECTION_ENABLED', e.target.checked)}
          />
          <span className="fieldset-legend">Secret Detection</span>
        </label>
        <p className="fieldset-label text-base-content/60">
          Detect and handle secrets (API keys, passwords, tokens) in observations
        </p>
      </fieldset>

      {settings.SECRET_DETECTION_ENABLED && (
        <FormField
          label="Detection Mode"
          hint="How to handle detected secrets"
        >
          <select
            className="select select-bordered w-full"
            value={settings.SECRET_DETECTION_MODE || 'redact'}
            onChange={(e) => onChange('SECRET_DETECTION_MODE', e.target.value)}
          >
            <option value="redact">Redact - Replace secrets with [REDACTED]</option>
            <option value="skip">Skip - Don't save observations with secrets</option>
            <option value="warn">Warn - Log warning but save anyway</option>
          </select>
        </FormField>
      )}
    </div>
  );
}

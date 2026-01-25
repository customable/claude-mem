/**
 * ProcessingSettings Tab
 *
 * Processing mode, sleep agent, and endless mode configuration.
 */

import type { TabProps } from '../types';
import { FormField } from '../components';

export function ProcessingSettings({ settings, onChange, errors: _errors }: TabProps) {
  return (
    <div className="space-y-6 max-w-lg">
      <h3 className="text-lg font-medium">Processing Settings</h3>
      <p className="text-sm text-base-content/60">
        Configure how observations are processed and stored
      </p>

      <FormField
        label="Processing Mode"
        hint="Control when observations are processed"
      >
        <select
          className="select select-bordered w-full"
          value={settings.PROCESSING_MODE || 'normal'}
          onChange={(e) => onChange('PROCESSING_MODE', e.target.value)}
        >
          <option value="normal">Normal (Process immediately)</option>
          <option value="lazy">Lazy (Batch processing)</option>
          <option value="hybrid">Hybrid (Mixed by type)</option>
        </select>
      </FormField>

      {(settings.PROCESSING_MODE === 'lazy' || settings.PROCESSING_MODE === 'hybrid') && (
        <>
          <FormField
            label="Batch Interval (seconds)"
            hint="Time between batch processing runs (0 = disabled)"
          >
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="0"
              min="0"
              value={settings.LAZY_BATCH_INTERVAL || ''}
              onChange={(e) => onChange('LAZY_BATCH_INTERVAL', parseInt(e.target.value) || 0)}
            />
          </FormField>

          <fieldset className="fieldset">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox"
                checked={settings.LAZY_PROCESS_ON_SEARCH ?? true}
                onChange={(e) => onChange('LAZY_PROCESS_ON_SEARCH', e.target.checked)}
              />
              <span className="fieldset-legend">Process on Search</span>
            </label>
            <p className="fieldset-label text-base-content/60">
              Process matching messages when searching
            </p>
          </fieldset>
        </>
      )}

      {settings.PROCESSING_MODE === 'hybrid' && (
        <FormField
          label="Hybrid Types"
          hint="Comma-separated observation types to process immediately"
        >
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="decision,error"
            value={settings.LAZY_HYBRID_TYPES || ''}
            onChange={(e) => onChange('LAZY_HYBRID_TYPES', e.target.value)}
          />
        </FormField>
      )}

      <div className="divider">Sleep Agent</div>

      <fieldset className="fieldset">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox"
            checked={settings.SLEEP_AGENT_ENABLED ?? false}
            onChange={(e) => onChange('SLEEP_AGENT_ENABLED', e.target.checked)}
          />
          <span className="fieldset-legend">Enable Sleep Agent</span>
        </label>
        <p className="fieldset-label text-base-content/60">
          Consolidate and organize memories during idle periods
        </p>
      </fieldset>

      {settings.SLEEP_AGENT_ENABLED && (
        <>
          <FormField
            label="Run Interval (seconds)"
            hint="Time between scheduled runs"
          >
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="3600"
              min="60"
              value={settings.SLEEP_AGENT_INTERVAL || ''}
              onChange={(e) => onChange('SLEEP_AGENT_INTERVAL', parseInt(e.target.value) || 3600)}
            />
          </FormField>

          <FormField
            label="Idle Timeout (minutes)"
            hint="Minutes of inactivity before triggering idle consolidation"
          >
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="30"
              min="1"
              value={settings.SLEEP_AGENT_IDLE_TIMEOUT || ''}
              onChange={(e) => onChange('SLEEP_AGENT_IDLE_TIMEOUT', parseInt(e.target.value) || 30)}
            />
          </FormField>
        </>
      )}

      <div className="divider">Endless Mode</div>

      <fieldset className="fieldset">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox"
            checked={settings.ENDLESS_MODE_ENABLED ?? false}
            onChange={(e) => onChange('ENDLESS_MODE_ENABLED', e.target.checked)}
          />
          <span className="fieldset-legend">Enable Endless Mode</span>
        </label>
        <p className="fieldset-label text-base-content/60">
          Archive and compress tool outputs for extended sessions (experimental)
        </p>
      </fieldset>

      {settings.ENDLESS_MODE_ENABLED && (
        <>
          <FormField
            label="Compression Model"
            hint="Fast model for compressing outputs"
          >
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="claude-haiku-4-5"
              value={settings.ENDLESS_MODE_COMPRESSION_MODEL || ''}
              onChange={(e) => onChange('ENDLESS_MODE_COMPRESSION_MODEL', e.target.value)}
            />
          </FormField>

          <FormField
            label="Compression Timeout (ms)"
            hint="Maximum time for compression (default: 90000)"
          >
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="90000"
              min="1000"
              step="1000"
              value={settings.ENDLESS_MODE_COMPRESSION_TIMEOUT || ''}
              onChange={(e) => onChange('ENDLESS_MODE_COMPRESSION_TIMEOUT', parseInt(e.target.value) || 90000)}
            />
          </FormField>

          <fieldset className="fieldset">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox"
                checked={settings.ENDLESS_MODE_FALLBACK_ON_TIMEOUT ?? true}
                onChange={(e) => onChange('ENDLESS_MODE_FALLBACK_ON_TIMEOUT', e.target.checked)}
              />
              <span className="fieldset-legend">Fallback on Timeout</span>
            </label>
            <p className="fieldset-label text-base-content/60">
              Use full output if compression times out
            </p>
          </fieldset>

          <fieldset className="fieldset">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox"
                checked={settings.ENDLESS_MODE_SKIP_SIMPLE_OUTPUTS ?? true}
                onChange={(e) => onChange('ENDLESS_MODE_SKIP_SIMPLE_OUTPUTS', e.target.checked)}
              />
              <span className="fieldset-legend">Skip Simple Outputs</span>
            </label>
            <p className="fieldset-label text-base-content/60">
              Don't compress small/simple outputs
            </p>
          </fieldset>

          {settings.ENDLESS_MODE_SKIP_SIMPLE_OUTPUTS && (
            <FormField
              label="Simple Output Threshold"
              hint="Token count below which outputs are skipped"
            >
              <input
                type="number"
                className="input input-bordered w-full"
                placeholder="1000"
                min="100"
                value={settings.ENDLESS_MODE_SIMPLE_OUTPUT_THRESHOLD || ''}
                onChange={(e) => onChange('ENDLESS_MODE_SIMPLE_OUTPUT_THRESHOLD', parseInt(e.target.value) || 1000)}
              />
            </FormField>
          )}
        </>
      )}
    </div>
  );
}

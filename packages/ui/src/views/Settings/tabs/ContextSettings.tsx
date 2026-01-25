/**
 * ContextSettings Tab
 *
 * Context injection settings including observation limits and token display.
 */

import type { TabProps } from '../types';
import { FormField } from '../components';

export function ContextSettings({ settings, onChange, errors }: TabProps) {
  return (
    <div className="space-y-6 max-w-lg">
      <h3 className="text-lg font-medium">Context Injection Settings</h3>
      <p className="text-sm text-base-content/60">
        Configure what context is injected into Claude sessions
      </p>

      <FormField
        label="Observation Limit"
        hint="Maximum number of recent observations to include in context"
        error={errors.CONTEXT_OBSERVATION_LIMIT}
      >
        <input
          type="number"
          className={`input input-bordered w-full ${errors.CONTEXT_OBSERVATION_LIMIT ? 'input-error' : ''}`}
          placeholder="50"
          min="1"
          max="500"
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

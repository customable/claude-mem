/**
 * AdvancedSettings Tab
 *
 * Advanced settings including network, database, vector DB, and data management.
 */

import { useState } from 'react';
import type { TabProps } from '../types';
import { FormField, ApiKeyInput } from '../components';

export function AdvancedSettings({ settings, onChange, errors }: TabProps) {
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

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Backend Port" hint="HTTP port" error={errors.BACKEND_PORT}>
          <input
            type="number"
            className={`input input-bordered w-full ${errors.BACKEND_PORT ? 'input-error' : ''}`}
            placeholder="37777"
            min="1"
            max="65535"
            value={settings.BACKEND_PORT || ''}
            onChange={(e) => onChange('BACKEND_PORT', parseInt(e.target.value) || 37777)}
          />
        </FormField>

        <FormField label="WebSocket Port" hint="WS port">
          <input
            type="number"
            className="input input-bordered w-full"
            placeholder="37778"
            min="1"
            max="65535"
            value={settings.BACKEND_WS_PORT || ''}
            onChange={(e) => onChange('BACKEND_WS_PORT', parseInt(e.target.value) || 37778)}
          />
        </FormField>
      </div>

      <FormField label="Host" hint="Hostname for the backend">
        <input
          type="text"
          className="input input-bordered w-full"
          placeholder="127.0.0.1"
          value={settings.BACKEND_HOST || ''}
          onChange={(e) => onChange('BACKEND_HOST', e.target.value)}
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

      <div className="divider">Remote Mode</div>

      <fieldset className="fieldset">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox"
            checked={settings.REMOTE_MODE ?? false}
            onChange={(e) => onChange('REMOTE_MODE', e.target.checked)}
          />
          <span className="fieldset-legend">Remote Backend</span>
        </label>
        <p className="fieldset-label text-base-content/60">
          Connect hooks to a remote backend server instead of localhost
        </p>
      </fieldset>

      {settings.REMOTE_MODE && (
        <>
          <FormField
            label="Remote URL"
            hint="Full URL to the remote backend (e.g., https://claude-mem.example.com)"
          >
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="https://claude-mem.example.com"
              value={settings.REMOTE_URL || ''}
              onChange={(e) => onChange('REMOTE_URL', e.target.value)}
            />
          </FormField>

          <FormField
            label="Remote Token"
            hint="Authentication token for the remote backend"
          >
            <ApiKeyInput
              value={settings.REMOTE_TOKEN || ''}
              onChange={(v) => onChange('REMOTE_TOKEN', v)}
              placeholder="Bearer token..."
            />
          </FormField>
        </>
      )}

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

      {settings.DATABASE_TYPE === 'sqlite' && (
        <FormField label="Database Path" hint="Path to SQLite database file">
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="~/.claude-mem/claude-mem.db"
            value={settings.DATABASE_PATH || ''}
            onChange={(e) => onChange('DATABASE_PATH', e.target.value)}
          />
        </FormField>
      )}

      {settings.DATABASE_TYPE === 'postgres' && (
        <>
          <FormField
            label="Connection URL"
            hint="PostgreSQL connection string (overrides host/port/user/password if set)"
          >
            <ApiKeyInput
              value={settings.DATABASE_URL || ''}
              onChange={(v) => onChange('DATABASE_URL', v)}
              placeholder="postgresql://user:password@host:5432/database"
            />
          </FormField>

          <div className="text-sm text-base-content/60 text-center">- or configure individually -</div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Host">
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="localhost"
                value={settings.DATABASE_HOST || ''}
                onChange={(e) => onChange('DATABASE_HOST', e.target.value)}
              />
            </FormField>

            <FormField label="Port" error={errors.DATABASE_PORT}>
              <input
                type="number"
                className={`input input-bordered w-full ${errors.DATABASE_PORT ? 'input-error' : ''}`}
                placeholder="5432"
                min="1"
                max="65535"
                value={settings.DATABASE_PORT || ''}
                onChange={(e) => onChange('DATABASE_PORT', parseInt(e.target.value) || 5432)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Username">
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="postgres"
                value={settings.DATABASE_USER || ''}
                onChange={(e) => onChange('DATABASE_USER', e.target.value)}
              />
            </FormField>

            <FormField label="Password">
              <ApiKeyInput
                value={settings.DATABASE_PASSWORD || ''}
                onChange={(v) => onChange('DATABASE_PASSWORD', v)}
                placeholder="Password..."
              />
            </FormField>
          </div>

          <FormField label="Database Name">
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="claude_mem"
              value={settings.DATABASE_NAME || ''}
              onChange={(e) => onChange('DATABASE_NAME', e.target.value)}
            />
          </FormField>
        </>
      )}

      <div className="divider">Vector Database</div>

      <FormField label="Vector Database" hint="Backend for semantic search (experimental)">
        <select
          className="select select-bordered w-full"
          value={settings.VECTOR_DB || 'none'}
          onChange={(e) => onChange('VECTOR_DB', e.target.value)}
        >
          <option value="none">None (Disabled)</option>
          <option value="qdrant">Qdrant</option>
        </select>
      </FormField>

      {settings.VECTOR_DB !== 'none' && (
        <>
          <FormField label="Vector DB Path" hint="Storage path for vector database">
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="~/.claude-mem/vector-db"
              value={settings.VECTOR_DB_PATH || ''}
              onChange={(e) => onChange('VECTOR_DB_PATH', e.target.value)}
            />
          </FormField>

          <FormField label="Embedding Model" hint="Model for generating embeddings">
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="Xenova/all-MiniLM-L6-v2"
              value={settings.EMBEDDING_MODEL || ''}
              onChange={(e) => onChange('EMBEDDING_MODEL', e.target.value)}
            />
          </FormField>
        </>
      )}

      <div className="divider">Processing</div>

      <FormField
        label="Batch Size"
        hint="Number of items to process in each batch"
        error={errors.BATCH_SIZE}
      >
        <input
          type="number"
          className={`input input-bordered w-full ${errors.BATCH_SIZE ? 'input-error' : ''}`}
          placeholder="5"
          min="1"
          max="100"
          value={settings.BATCH_SIZE || ''}
          onChange={(e) => onChange('BATCH_SIZE', parseInt(e.target.value) || 5)}
        />
      </FormField>

      <div className="divider">Cleanup Service</div>

      <fieldset className="fieldset">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox"
            checked={settings.CLEANUP_AUTO_ENABLED ?? true}
            onChange={(e) => onChange('CLEANUP_AUTO_ENABLED', e.target.checked)}
          />
          <span className="fieldset-legend">Auto Cleanup</span>
        </label>
        <p className="fieldset-label text-base-content/60">
          Automatically clean up stale sessions and old tasks
        </p>
      </fieldset>

      {settings.CLEANUP_AUTO_ENABLED && (
        <>
          <FormField
            label="Cleanup Interval (ms)"
            hint="Time between cleanup runs (default: 30 min)"
          >
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="1800000"
              min="60000"
              step="60000"
              value={settings.CLEANUP_INTERVAL_MS || ''}
              onChange={(e) => onChange('CLEANUP_INTERVAL_MS', parseInt(e.target.value) || 1800000)}
            />
          </FormField>

          <FormField
            label="Stale Timeout (ms)"
            hint="Mark sessions as complete after this idle time (default: 4 hours)"
          >
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="14400000"
              min="60000"
              step="60000"
              value={settings.CLEANUP_STALE_TIMEOUT_MS || ''}
              onChange={(e) => onChange('CLEANUP_STALE_TIMEOUT_MS', parseInt(e.target.value) || 14400000)}
            />
          </FormField>

          <FormField
            label="Task Age (ms)"
            hint="Remove completed/failed tasks older than this (default: 24 hours)"
          >
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="86400000"
              min="3600000"
              step="3600000"
              value={settings.CLEANUP_TASK_AGE_MS || ''}
              onChange={(e) => onChange('CLEANUP_TASK_AGE_MS', parseInt(e.target.value) || 86400000)}
            />
          </FormField>
        </>
      )}

      <div className="divider">Docker</div>

      <fieldset className="fieldset">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox"
            checked={settings.DOCKER_AUTO_UPDATE_ENABLED ?? false}
            onChange={(e) => onChange('DOCKER_AUTO_UPDATE_ENABLED', e.target.checked)}
          />
          <span className="fieldset-legend">Auto-Update (Watchtower)</span>
        </label>
        <p className="fieldset-label text-base-content/60">
          Enable Watchtower labels for automatic Docker image updates
        </p>
      </fieldset>

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

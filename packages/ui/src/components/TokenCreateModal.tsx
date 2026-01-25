/**
 * Token Create Modal (Issue #263)
 *
 * Modal for creating new worker registration tokens.
 */

import { useState } from 'react';
import type { TokenScope, WorkerTokenCreateRequest, Hub } from '../api/client';

interface TokenCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (request: WorkerTokenCreateRequest) => Promise<{ token: string; id: string; prefix: string } | null>;
  hubs: Hub[];
}

const SCOPE_INFO: Record<TokenScope, { name: string; description: string; icon: string }> = {
  instance: {
    name: 'Instance',
    description: 'Global token, can access all projects and hubs',
    icon: 'ph--globe',
  },
  group: {
    name: 'Group (Hub)',
    description: 'Scoped to a specific hub',
    icon: 'ph--buildings',
  },
  project: {
    name: 'Project',
    description: 'Scoped to specific projects only',
    icon: 'ph--folder',
  },
};

const CAPABILITY_OPTIONS = [
  { value: 'observation', label: 'Observation Processing', icon: 'ph--eye' },
  { value: 'summarize', label: 'Summarization', icon: 'ph--article' },
  { value: 'embedding', label: 'Embedding Generation', icon: 'ph--vector-three' },
  { value: 'claude-md', label: 'CLAUDE.md Writing', icon: 'ph--file-text' },
];

export function TokenCreateModal({
  isOpen,
  onClose,
  onCreate,
  hubs,
}: TokenCreateModalProps) {
  const [name, setName] = useState('');
  const [scope, setScope] = useState<TokenScope>('instance');
  const [hubId, setHubId] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState('');
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [expiresIn, setExpiresIn] = useState<string>('never');
  const [isCreating, setIsCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      // Calculate expiration date
      let expiresAt: string | undefined;
      if (expiresIn !== 'never') {
        const days = parseInt(expiresIn, 10);
        const date = new Date();
        date.setDate(date.getDate() + days);
        expiresAt = date.toISOString();
      }

      const result = await onCreate({
        name: name.trim(),
        scope,
        hubId: scope === 'group' ? hubId : undefined,
        projectFilter: scope === 'project' ? projectFilter : undefined,
        capabilities: capabilities.length > 0 ? capabilities : undefined,
        expiresAt,
      });

      if (result) {
        setCreatedToken(result.token);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (createdToken) {
      await navigator.clipboard.writeText(createdToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setName('');
    setScope('instance');
    setHubId('');
    setProjectFilter('');
    setCapabilities([]);
    setExpiresIn('never');
    setCreatedToken(null);
    setCopied(false);
    onClose();
  };

  const toggleCapability = (cap: string) => {
    setCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  };

  if (!isOpen) return null;

  // Show token display if created
  if (createdToken) {
    return (
      <div className="modal modal-open">
        <div className="modal-box max-w-lg">
          <div className="flex items-center gap-3 mb-4">
            <span className="iconify ph--check-circle size-8 text-success" />
            <div>
              <h3 className="text-lg font-semibold">Token Created</h3>
              <p className="text-sm text-base-content/60">Save this token - it won't be shown again!</p>
            </div>
          </div>

          <div className="alert alert-warning mb-4">
            <span className="iconify ph--warning size-5" />
            <span>Copy and save this token now. You won't be able to see it again.</span>
          </div>

          <div className="form-control mb-6">
            <label className="label">
              <span className="label-text font-medium">Token</span>
            </label>
            <div className="join w-full">
              <input
                type="text"
                value={createdToken}
                readOnly
                className="input input-bordered join-item flex-1 font-mono text-sm"
              />
              <button
                onClick={handleCopy}
                className="btn btn-primary join-item"
              >
                {copied ? (
                  <>
                    <span className="iconify ph--check size-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <span className="iconify ph--copy size-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-base-200 p-4 rounded-lg mb-6">
            <h4 className="font-medium mb-2">Usage</h4>
            <code className="text-sm text-base-content/80 block">
              claude-mem-worker start --token {createdToken.substring(0, 20)}...
            </code>
          </div>

          <div className="modal-action">
            <button onClick={handleClose} className="btn btn-primary">
              Done
            </button>
          </div>
        </div>
        <div className="modal-backdrop bg-black/50" onClick={handleClose} />
      </div>
    );
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className="iconify ph--key size-5 text-primary" />
            Create Worker Token
          </h3>
          <button
            onClick={handleClose}
            className="btn btn-ghost btn-sm btn-circle"
            disabled={isCreating}
          >
            <span className="iconify ph--x size-5" />
          </button>
        </div>

        {/* Name Input */}
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text font-medium">Token Name</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Production Workers, CI Pipeline"
            className="input input-bordered"
          />
        </div>

        {/* Scope Selection */}
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text font-medium">Scope</span>
          </label>
          <div className="space-y-2">
            {(Object.entries(SCOPE_INFO) as [TokenScope, typeof SCOPE_INFO['instance']][]).map(([key, info]) => (
              <label
                key={key}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border-2 transition-all ${
                  scope === key
                    ? 'border-primary bg-primary/10'
                    : 'border-base-300 hover:border-base-content/30'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value={key}
                  checked={scope === key}
                  onChange={(e) => setScope(e.target.value as TokenScope)}
                  className="radio radio-primary"
                />
                <span className={`iconify ${info.icon} size-5 ${scope === key ? 'text-primary' : 'text-base-content/60'}`} />
                <div className="flex-1">
                  <div className="font-medium">{info.name}</div>
                  <div className="text-sm text-base-content/60">{info.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Hub Selection (for group scope) */}
        {scope === 'group' && (
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text font-medium">Hub</span>
            </label>
            {hubs.length > 0 ? (
              <select
                value={hubId}
                onChange={(e) => setHubId(e.target.value)}
                className="select select-bordered"
              >
                <option value="">Select a hub...</option>
                {hubs.map((hub) => (
                  <option key={hub.id} value={hub.id}>
                    {hub.name} ({hub.region || 'default'})
                  </option>
                ))}
              </select>
            ) : (
              <div className="alert alert-info">
                <span className="iconify ph--info size-5" />
                <span>No external hubs registered. The builtin hub is always available.</span>
              </div>
            )}
          </div>
        )}

        {/* Project Filter (for project scope) */}
        {scope === 'project' && (
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text font-medium">Project Filter</span>
              <span className="label-text-alt">Glob pattern supported</span>
            </label>
            <input
              type="text"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              placeholder="e.g., my-project, client-*"
              className="input input-bordered"
            />
          </div>
        )}

        {/* Capabilities */}
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text font-medium">Capabilities (optional)</span>
            <span className="label-text-alt">Leave empty for all</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {CAPABILITY_OPTIONS.map((cap) => (
              <button
                key={cap.value}
                type="button"
                onClick={() => toggleCapability(cap.value)}
                className={`btn btn-sm ${capabilities.includes(cap.value) ? 'btn-primary' : 'btn-outline'}`}
              >
                <span className={`iconify ${cap.icon} size-4`} />
                {cap.label}
              </button>
            ))}
          </div>
        </div>

        {/* Expiration */}
        <div className="form-control mb-6">
          <label className="label">
            <span className="label-text font-medium">Expires</span>
          </label>
          <select
            value={expiresIn}
            onChange={(e) => setExpiresIn(e.target.value)}
            className="select select-bordered"
          >
            <option value="never">Never</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
          </select>
        </div>

        {/* Actions */}
        <div className="modal-action">
          <button
            onClick={handleClose}
            className="btn btn-ghost"
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="btn btn-primary"
            disabled={isCreating || !name.trim() || (scope === 'group' && !hubId)}
          >
            {isCreating ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Creating...
              </>
            ) : (
              <>
                <span className="iconify ph--key size-4" />
                Create Token
              </>
            )}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={handleClose} />
    </div>
  );
}

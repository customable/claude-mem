/**
 * Token List Component (Issue #263)
 *
 * Displays and manages worker registration tokens.
 */

import { useState, useEffect } from 'react';
import { api, type WorkerToken, type WorkerRegistration, type Hub, type WorkerTokenCreateRequest } from '../api/client';
import { TokenCreateModal } from './TokenCreateModal';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TokenScopeBadge({ scope }: { scope: string }) {
  const colors: Record<string, string> = {
    instance: 'badge-primary',
    group: 'badge-secondary',
    project: 'badge-accent',
  };
  return <span className={`badge ${colors[scope] || 'badge-ghost'}`}>{scope}</span>;
}

function TokenStatusBadge({ token }: { token: WorkerToken }) {
  if (token.revokedAt) {
    return <span className="badge badge-error">Revoked</span>;
  }
  if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
    return <span className="badge badge-warning">Expired</span>;
  }
  return <span className="badge badge-success">Active</span>;
}

export function TokenList() {
  const [tokens, setTokens] = useState<WorkerToken[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<Record<string, WorkerRegistration[]>>({});
  const [revoking, setRevoking] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tokensData, hubsData] = await Promise.all([
        api.getWorkerTokens(),
        api.getHubs(),
      ]);
      setTokens(tokensData);
      setHubs(hubsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (request: WorkerTokenCreateRequest) => {
    try {
      const result = await api.createWorkerToken(request);
      await loadData();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create token');
      return null;
    }
  };

  const handleRevoke = async (tokenId: string) => {
    if (!confirm('Are you sure you want to revoke this token? All workers using it will be disconnected.')) {
      return;
    }
    setRevoking(tokenId);
    try {
      await api.revokeWorkerToken(tokenId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke token');
    } finally {
      setRevoking(null);
    }
  };

  const loadRegistrations = async (tokenId: string) => {
    if (expandedToken === tokenId) {
      setExpandedToken(null);
      return;
    }
    try {
      const regs = await api.getTokenRegistrations(tokenId);
      setRegistrations((prev) => ({ ...prev, [tokenId]: regs }));
      setExpandedToken(tokenId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load registrations');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="iconify ph--key size-6" />
            Worker Tokens
          </h2>
          <p className="text-sm text-base-content/60">
            Manage registration tokens for workers to connect
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary btn-sm"
        >
          <span className="iconify ph--plus size-4" />
          Create Token
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error">
          <span className="iconify ph--warning-circle size-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="btn btn-ghost btn-sm">
            Dismiss
          </button>
        </div>
      )}

      {/* Token List */}
      {tokens.length === 0 ? (
        <div className="card bg-base-200">
          <div className="card-body items-center text-center py-12">
            <span className="iconify ph--key-light size-16 text-base-content/30" />
            <h3 className="text-lg font-medium mt-4">No tokens yet</h3>
            <p className="text-base-content/60 max-w-md">
              Create a token to allow workers to register with this backend.
              Workers need a token to authenticate when connecting.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary mt-4"
            >
              <span className="iconify ph--plus size-4" />
              Create Your First Token
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map((token) => (
            <div
              key={token.id}
              className="card bg-base-200 overflow-hidden"
            >
              <div className="card-body p-4">
                {/* Token Header */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{token.name}</h3>
                      <TokenScopeBadge scope={token.scope} />
                      <TokenStatusBadge token={token} />
                    </div>
                    <div className="flex items-center gap-4 text-sm text-base-content/60 mt-1">
                      <span className="font-mono">{token.tokenPrefix}...</span>
                      {token.registrationCount !== undefined && (
                        <span className="flex items-center gap-1">
                          <span className="iconify ph--users size-4" />
                          {token.registrationCount} worker{token.registrationCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      <span>Created {formatDate(token.createdAt)}</span>
                      {token.lastUsedAt && (
                        <span>Last used {formatDate(token.lastUsedAt)}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadRegistrations(token.id)}
                      className="btn btn-ghost btn-sm"
                      title="View workers"
                    >
                      <span className={`iconify ${expandedToken === token.id ? 'ph--caret-up' : 'ph--caret-down'} size-4`} />
                    </button>
                    {!token.revokedAt && (
                      <button
                        onClick={() => handleRevoke(token.id)}
                        className="btn btn-ghost btn-sm text-error"
                        disabled={revoking === token.id}
                        title="Revoke token"
                      >
                        {revoking === token.id ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <span className="iconify ph--trash size-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Capabilities & Labels */}
                {(token.capabilities?.length || token.labels) && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {token.capabilities?.map((cap) => (
                      <span key={cap} className="badge badge-outline badge-sm">
                        {cap}
                      </span>
                    ))}
                    {token.labels && Object.entries(token.labels).map(([k, v]) => (
                      <span key={k} className="badge badge-ghost badge-sm">
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                )}

                {/* Expanded: Registrations */}
                {expandedToken === token.id && (
                  <div className="mt-4 pt-4 border-t border-base-300">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <span className="iconify ph--users size-4" />
                      Registered Workers
                    </h4>
                    {registrations[token.id]?.length ? (
                      <div className="overflow-x-auto">
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th>System ID</th>
                              <th>Hostname</th>
                              <th>Status</th>
                              <th>Connected</th>
                              <th>Last Heartbeat</th>
                            </tr>
                          </thead>
                          <tbody>
                            {registrations[token.id].map((reg) => (
                              <tr key={reg.id}>
                                <td className="font-mono text-xs">{reg.systemId}</td>
                                <td>{reg.hostname || '-'}</td>
                                <td>
                                  <span className={`badge badge-sm ${reg.status === 'online' ? 'badge-success' : 'badge-ghost'}`}>
                                    {reg.status}
                                  </span>
                                </td>
                                <td className="text-sm">{formatDate(reg.connectedAt)}</td>
                                <td className="text-sm">{formatDate(reg.lastHeartbeat)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-base-content/60 text-sm">
                        No workers have registered with this token yet.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <TokenCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
        hubs={hubs}
      />
    </div>
  );
}

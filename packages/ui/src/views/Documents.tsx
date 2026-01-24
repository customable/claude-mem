/**
 * Documents View
 *
 * Display and manage vector database documents.
 */

import { useState, useMemo, useCallback } from 'react';
import { api, type Document, type DocumentType } from '../api/client';
import { useQuery } from '../hooks/useApi';

interface Filters {
  project: string;
  type: string;
  sourceTool: string;
  search: string;
}

const DOCUMENT_TYPE_CONFIG: Record<DocumentType, { label: string; icon: string; color: string }> = {
  'library-docs': { label: 'Library Docs', icon: 'ph--book-open', color: 'text-primary' },
  'web-content': { label: 'Web Content', icon: 'ph--globe', color: 'text-secondary' },
  'api-reference': { label: 'API Reference', icon: 'ph--code', color: 'text-accent' },
  'code-example': { label: 'Code Example', icon: 'ph--file-code', color: 'text-info' },
  'tutorial': { label: 'Tutorial', icon: 'ph--graduation-cap', color: 'text-success' },
  'custom': { label: 'Custom', icon: 'ph--file', color: 'text-base-content' },
};

export function DocumentsView() {
  const [filters, setFilters] = useState<Filters>({ project: '', type: '', sourceTool: '', search: '' });
  const [limit] = useState(50);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Fetch documents
  const { data, loading, error, refetch } = useQuery(
    () => {
      const params: Record<string, string | number> = { limit };
      if (filters.project) params.project = filters.project;
      if (filters.type) params.type = filters.type;
      if (filters.sourceTool) params.sourceTool = filters.sourceTool;
      return api.getDocuments(params);
    },
    [limit, filters.project, filters.type, filters.sourceTool]
  );

  // Fetch projects for filter dropdown
  const { data: projectsData } = useQuery(() => api.getProjects(), []);

  // Client-side search filtering
  const documents = useMemo(() => {
    let items = data?.items || [];

    if (filters.search) {
      const search = filters.search.toLowerCase();
      items = items.filter(
        (d) =>
          d.title?.toLowerCase().includes(search) ||
          d.source?.toLowerCase().includes(search) ||
          d.content?.toLowerCase().includes(search)
      );
    }

    return items;
  }, [data, filters.search]);

  // Get unique source tools for filter
  const sourceTools = useMemo(() => {
    const tools = new Set<string>();
    (data?.items || []).forEach(d => {
      if (d.source_tool) tools.add(d.source_tool);
    });
    return Array.from(tools).sort();
  }, [data]);

  const projects = projectsData?.projects || [];
  const types = Object.keys(DOCUMENT_TYPE_CONFIG) as DocumentType[];

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.deleteDocument(id);
      refetch();
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  }, [refetch]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-base-content/60">
        <span className="loading loading-spinner loading-md mb-2" />
        <span>Loading documents...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span className="iconify ph--warning-circle size-5" />
        <span>Failed to load documents</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Documents</h2>
          <span className="badge badge-neutral badge-sm">{documents.length} items</span>
          {data?.total && data.total > documents.length && (
            <span className="text-xs text-base-content/50">of {data.total} total</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <label className="input input-sm input-bordered flex items-center gap-2 w-40">
            <span className="iconify ph--magnifying-glass size-4 text-base-content/40" />
            <input
              type="text"
              placeholder="Search..."
              className="grow bg-transparent outline-none"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </label>

          {/* Project Filter */}
          <select
            className="select select-sm select-bordered"
            value={filters.project}
            onChange={(e) => setFilters((f) => ({ ...f, project: e.target.value }))}
          >
            <option value="">All Projects</option>
            {projects.filter(Boolean).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            className="select select-sm select-bordered"
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="">All Types</option>
            {types.map((t) => (
              <option key={t} value={t}>{DOCUMENT_TYPE_CONFIG[t].label}</option>
            ))}
          </select>

          {/* Source Tool Filter */}
          <select
            className="select select-sm select-bordered"
            value={filters.sourceTool}
            onChange={(e) => setFilters((f) => ({ ...f, sourceTool: e.target.value }))}
          >
            <option value="">All Sources</option>
            {sourceTools.map((t) => (
              <option key={t} value={t}>{formatSourceTool(t)}</option>
            ))}
          </select>

          {/* Refresh */}
          <button onClick={refetch} className="btn btn-ghost btn-sm btn-square">
            <span className="iconify ph--arrows-clockwise size-4" />
          </button>
        </div>
      </div>

      {/* Document List */}
      {documents.length === 0 ? (
        <div className="card bg-base-100 card-border">
          <div className="card-body items-center justify-center py-12 text-base-content/60">
            <span className="iconify ph--files size-12 mb-2" />
            <span>No documents found</span>
            {(filters.search || filters.type || filters.sourceTool) && (
              <button
                className="btn btn-ghost btn-sm mt-2"
                onClick={() => setFilters({ project: filters.project, type: '', sourceTool: '', search: '' })}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              expanded={expandedId === doc.id}
              onToggle={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
              onDelete={() => handleDelete(doc.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentCard({
  document,
  expanded,
  onToggle,
  onDelete,
}: {
  document: Document;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const config = DOCUMENT_TYPE_CONFIG[document.type] || DOCUMENT_TYPE_CONFIG.custom;
  const date = new Date(document.created_at).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const time = new Date(document.created_at).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Parse metadata if available
  const metadata = document.metadata ? JSON.parse(document.metadata) : null;

  // Estimate content size
  const contentSize = document.content ? Math.round(document.content.length / 1024) : 0;

  return (
    <div className="card bg-base-100 card-border">
      <div className="card-body p-3">
        {/* Header Row */}
        <div
          className="flex items-start gap-3 cursor-pointer hover:bg-base-200/50 -m-3 p-3 rounded-lg transition-colors"
          onClick={onToggle}
        >
          <span className={`iconify ${config.icon} size-5 ${config.color} mt-0.5 shrink-0`} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{document.title || document.source || 'Untitled'}</span>
              <span className="badge badge-ghost badge-xs">{config.label}</span>
              {document.project && (
                <span className="badge badge-primary badge-xs badge-outline">{document.project}</span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-0.5 text-xs text-base-content/60 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="iconify ph--link size-3" />
                {formatSourceTool(document.source_tool)}
              </span>
              <span className="text-base-content/30">|</span>
              <span className="flex items-center gap-1">
                <span className="iconify ph--eye size-3" />
                {document.access_count} views
              </span>
              <span className="text-base-content/30">|</span>
              <span className="flex items-center gap-1">
                <span className="iconify ph--file size-3" />
                ~{contentSize} KB
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xs text-base-content/50">{date}</div>
            <div className="text-xs text-base-content/40">{time}</div>
          </div>

          <span className={`iconify ph--caret-down size-4 text-base-content/40 transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`} />
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-base-300 space-y-3">
            {/* Source URL */}
            <div className="text-sm">
              <span className="text-base-content/60">Source:</span>
              <span className="ml-2 font-mono text-xs break-all">{document.source}</span>
            </div>

            {/* Metadata */}
            {metadata && (
              <div className="text-sm">
                <span className="text-base-content/60">Metadata:</span>
                <div className="mt-1 p-2 bg-base-200 rounded text-xs font-mono overflow-x-auto">
                  {JSON.stringify(metadata, null, 2)}
                </div>
              </div>
            )}

            {/* Content Preview */}
            <div className="text-sm">
              <span className="text-base-content/60">Content Preview:</span>
              <div className="mt-1 p-2 bg-base-200 rounded text-xs font-mono max-h-48 overflow-y-auto whitespace-pre-wrap">
                {document.content?.slice(0, 2000) || '(empty)'}
                {document.content && document.content.length > 2000 && (
                  <span className="text-base-content/40">... ({document.content.length - 2000} more characters)</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                className="btn btn-ghost btn-xs text-error"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <span className="iconify ph--trash size-4" />
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Format source tool name for display
 */
function formatSourceTool(tool: string): string {
  if (!tool) return 'Unknown';

  // Extract meaningful part from MCP tool names like "mcp__context7__query-docs"
  const parts = tool.split('__');
  if (parts.length >= 2) {
    // Return "context7" from "mcp__context7__query-docs"
    return parts[1];
  }

  return tool;
}

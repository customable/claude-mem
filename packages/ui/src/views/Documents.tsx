/**
 * Documents View
 *
 * Display and manage vector database documents.
 * Issue #284: Add document preview and fix missing titles
 */

import React, { useState, useMemo, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, type Document, type DocumentType } from '../api/client';
import { useQuery } from '../hooks/useApi';

/**
 * Extract a meaningful display title from document data.
 * Issue #284: Fix title showing only "[" for library docs.
 *
 * Priority order:
 * 1. Valid title (not "[", not empty)
 * 2. metadata.libraryId (e.g., "/vercel/next.js")
 * 3. metadata.query (the search query used)
 * 4. metadata.url (for web content)
 * 5. source URL (last resort)
 */
function getDisplayTitle(doc: Document, metadata: Record<string, unknown> | null): string {
  // Check if title is valid (not "[", not empty, not just whitespace)
  const isValidTitle = (t: string | null | undefined): boolean => {
    if (!t) return false;
    const trimmed = t.trim();
    // Invalid if: empty, single bracket, or starts with special JSON chars
    return trimmed.length > 1 && !['[', '{', '"'].includes(trimmed[0]);
  };

  if (isValidTitle(doc.title)) {
    return doc.title!;
  }

  // Try to extract from metadata
  if (metadata) {
    // Library ID (e.g., "/vercel/next.js")
    if (typeof metadata.libraryId === 'string' && metadata.libraryId) {
      return metadata.libraryId;
    }
    // Query used
    if (typeof metadata.query === 'string' && metadata.query) {
      return metadata.query;
    }
    // URL from toolInput
    if (typeof metadata.toolInput === 'string') {
      try {
        const input = JSON.parse(metadata.toolInput);
        if (input.libraryId) return input.libraryId;
        if (input.query) return input.query;
        if (input.url) return formatUrl(input.url);
      } catch { /* ignore parse errors */ }
    }
    // Direct URL
    if (typeof metadata.url === 'string' && metadata.url) {
      return formatUrl(metadata.url);
    }
  }

  // Fallback to source URL
  if (doc.source) {
    return formatUrl(doc.source);
  }

  return 'Untitled Document';
}

/**
 * Format URL for display (extract domain + path)
 */
function formatUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Return domain + pathname (without query params)
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${parsed.hostname}${path}`.slice(0, 60);
  } catch {
    // Not a valid URL, return as-is but truncated
    return url.slice(0, 60);
  }
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(epochMs: number): string {
  const now = Date.now();
  const diffMs = now - epochMs;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 30) {
    return new Date(epochMs).toLocaleDateString();
  }
  if (diffDays > 0) {
    return `${diffDays}d ago`;
  }
  if (diffHours > 0) {
    return `${diffHours}h ago`;
  }
  if (diffMins > 0) {
    return `${diffMins}m ago`;
  }
  return 'just now';
}

interface Filters {
  project: string;
  type: string;
  sourceTool: string;
  search: string;
}

/**
 * Export document content as markdown file (Issue #284)
 */
function exportAsMarkdown(doc: Document, displayTitle: string): void {
  const blob = new Blob([doc.content || ''], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // Sanitize filename
  const filename = displayTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 50);
  a.download = `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Document Preview Modal (Issue #284)
 */
function DocumentPreviewModal({
  document,
  onClose,
  onCopy,
  onExport,
  onDelete,
}: {
  document: Document;
  onClose: () => void;
  onCopy: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const metadata = document.metadata ? JSON.parse(document.metadata) : null;
  const displayTitle = getDisplayTitle(document, metadata);
  const config = DOCUMENT_TYPE_CONFIG[document.type] || DOCUMENT_TYPE_CONFIG.custom;

  // Highlight search matches in content
  const highlightedContent = useMemo(() => {
    if (!searchTerm || !document.content) return null;
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return document.content.replace(regex, '**$1**');
  }, [document.content, searchTerm]);

  const contentToRender = searchTerm && highlightedContent ? highlightedContent : document.content;
  const matchCount = searchTerm && document.content
    ? (document.content.match(new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length
    : 0;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-4xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-base-300">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`iconify ${config.icon} size-5 ${config.color}`} />
              <h3 className="font-bold text-lg truncate" title={displayTitle}>
                {displayTitle}
              </h3>
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-base-content/60">
              <span className="badge badge-ghost badge-xs">{config.label}</span>
              {document.project && (
                <span className="badge badge-primary badge-xs badge-outline">{document.project}</span>
              )}
              <span className="text-xs">~{Math.round((document.content?.length || 0) / 1024)} KB</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <span className="iconify ph--x size-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="py-3 border-b border-base-300">
          <label className="input input-sm input-bordered flex items-center gap-2">
            <span className="iconify ph--magnifying-glass size-4 text-base-content/40" />
            <input
              type="text"
              placeholder="Search in document..."
              className="grow bg-transparent outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <>
                <span className="text-xs text-base-content/50">{matchCount} matches</span>
                <button
                  className="btn btn-ghost btn-xs btn-circle"
                  onClick={() => setSearchTerm('')}
                >
                  <span className="iconify ph--x size-3" />
                </button>
              </>
            )}
          </label>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <Markdown remarkPlugins={[remarkGfm]}>
              {contentToRender || '*No content*'}
            </Markdown>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-base-300">
          <div className="text-xs text-base-content/50">
            Source: {document.source_tool} | Created: {new Date(document.created_at).toLocaleString()}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={onCopy} title="Copy to clipboard">
              <span className="iconify ph--copy size-4" />
              Copy
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onExport} title="Export as Markdown">
              <span className="iconify ph--download size-4" />
              Export
            </button>
            <button className="btn btn-ghost btn-sm text-error" onClick={onDelete} title="Delete">
              <span className="iconify ph--trash size-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
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
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);

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

  // Get unique source tools for filter with counts (Issue #284)
  const sourceToolsWithCounts = useMemo(() => {
    const counts = new Map<string, number>();
    (data?.items || []).forEach(d => {
      if (d.source_tool) {
        counts.set(d.source_tool, (counts.get(d.source_tool) || 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count);
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

  // Copy document content to clipboard (Issue #284)
  const handleCopy = useCallback(async (doc: Document) => {
    try {
      await navigator.clipboard.writeText(doc.content || '');
      // Could add toast notification here
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, []);

  // Export document as markdown (Issue #284)
  const handleExport = useCallback((doc: Document) => {
    const metadata = doc.metadata ? JSON.parse(doc.metadata) : null;
    const displayTitle = getDisplayTitle(doc, metadata);
    exportAsMarkdown(doc, displayTitle);
  }, []);

  // Open preview modal (Issue #284)
  const handleOpenPreview = useCallback((doc: Document) => {
    setPreviewDocument(doc);
  }, []);

  // Close preview modal
  const handleClosePreview = useCallback(() => {
    setPreviewDocument(null);
  }, []);

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

  // Check if any filter is active
  const hasActiveFilters = filters.search || filters.type || filters.sourceTool || filters.project;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Documents</h2>
          <span className="badge badge-neutral badge-sm">{documents.length} items</span>
          {data?.total && data.total > documents.length && (
            <span className="text-xs text-base-content/50">of {data.total} total</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Clear Filters Button (Issue #284) */}
          {hasActiveFilters && (
            <button
              className="btn btn-ghost btn-xs gap-1"
              onClick={() => setFilters({ project: '', type: '', sourceTool: '', search: '' })}
              title="Clear all filters"
            >
              <span className="iconify ph--x size-3" />
              Clear
            </button>
          )}

          {/* Refresh */}
          <button onClick={refetch} className="btn btn-ghost btn-sm btn-square" title="Refresh">
            <span className="iconify ph--arrows-clockwise size-4" />
          </button>
        </div>
      </div>

      {/* Source Tabs (Issue #284) */}
      {sourceToolsWithCounts.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            className={`btn btn-sm ${!filters.sourceTool ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilters((f) => ({ ...f, sourceTool: '' }))}
          >
            All
            <span className="badge badge-xs ml-1">{data?.items?.length || 0}</span>
          </button>
          {sourceToolsWithCounts.map(({ tool, count }) => (
            <button
              key={tool}
              className={`btn btn-sm ${filters.sourceTool === tool ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilters((f) => ({ ...f, sourceTool: tool }))}
            >
              {formatSourceTool(tool)}
              <span className="badge badge-xs ml-1">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Filters Row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <label className="input input-sm input-bordered flex items-center gap-2 w-40 sm:w-48">
          <span className="iconify ph--magnifying-glass size-4 text-base-content/40" />
          <input
            type="text"
            placeholder="Search..."
            className="grow bg-transparent outline-none"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
          {filters.search && (
            <button
              className="btn btn-ghost btn-xs btn-circle"
              onClick={() => setFilters((f) => ({ ...f, search: '' }))}
            >
              <span className="iconify ph--x size-3" />
            </button>
          )}
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
          className="select select-sm select-bordered hidden sm:inline-flex"
          value={filters.type}
          onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
        >
          <option value="">All Types</option>
          {types.map((t) => (
            <option key={t} value={t}>{DOCUMENT_TYPE_CONFIG[t].label}</option>
          ))}
        </select>
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
              onCopy={() => handleCopy(doc)}
              onExport={() => handleExport(doc)}
              onOpenPreview={() => handleOpenPreview(doc)}
            />
          ))}
        </div>
      )}

      {/* Document Preview Modal (Issue #284) */}
      {previewDocument && (
        <DocumentPreviewModal
          document={previewDocument}
          onClose={handleClosePreview}
          onCopy={() => handleCopy(previewDocument)}
          onExport={() => handleExport(previewDocument)}
          onDelete={() => {
            handleDelete(previewDocument.id);
            handleClosePreview();
          }}
        />
      )}
    </div>
  );
}

/**
 * Sanitize markdown content for preview
 * - Truncate at given length
 * - Close any unclosed code blocks
 * - Ensure valid markdown structure
 */
function sanitizeMarkdownPreview(content: string | undefined, maxLength: number): string {
  if (!content) return '(empty)';

  let preview = content.slice(0, maxLength);

  // Count code block fences (``` or ~~~)
  const codeBlockMatches = preview.match(/^```|^~~~/gm) || [];
  const isUnclosed = codeBlockMatches.length % 2 !== 0;

  // If we have an unclosed code block, close it
  if (isUnclosed) {
    // Find the last fence type used
    const lastFenceMatch = preview.match(/(```|~~~)[^\n]*\n(?![\s\S]*\1)/);
    const fenceType = lastFenceMatch ? '```' : '```';
    preview = preview + '\n' + fenceType;
  }

  return preview;
}

/**
 * Custom markdown components for better rendering
 */
const markdownComponents = {
  // Headings with distinct styling
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="text-base font-bold mt-4 mb-2 text-primary" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="text-sm font-bold mt-3 mb-1.5 text-secondary border-b border-base-300 pb-1" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-sm font-semibold mt-2 mb-1 text-accent" {...props}>{children}</h3>
  ),
  h4: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4 className="text-xs font-semibold mt-2 mb-1" {...props}>{children}</h4>
  ),
  // Better code block rendering
  pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre className="bg-base-300 p-2 rounded text-xs overflow-x-auto my-2 border border-base-content/10" {...props}>
      {children}
    </pre>
  ),
  code: ({ children, className, ...props }: React.HTMLAttributes<HTMLElement> & { className?: string }) => {
    // Check if it's a code block (has language class) or inline code
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code className="text-xs" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="bg-base-300 px-1 py-0.5 rounded text-xs font-mono" {...props}>
        {children}
      </code>
    );
  },
  // Lists
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc list-inside my-1 space-y-0.5" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal list-inside my-1 space-y-0.5" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="text-xs" {...props}>{children}</li>
  ),
  // Paragraphs
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="my-1 text-xs" {...props}>{children}</p>
  ),
  // Links
  a: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} className="text-info hover:underline" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
  ),
  // Strong/bold
  strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-base-content" {...props}>{children}</strong>
  ),
  // Horizontal rule for section separators
  hr: () => <hr className="my-3 border-base-300" />,
  // Blockquotes
  blockquote: ({ children, ...props }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote className="border-l-2 border-primary pl-2 my-2 text-base-content/70 italic" {...props}>{children}</blockquote>
  ),
  // Tables (GFM)
  table: ({ children, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto my-2">
      <table className="table table-xs table-zebra" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-base-300" {...props}>{children}</thead>
  ),
  th: ({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th className="text-xs font-semibold px-2 py-1" {...props}>{children}</th>
  ),
  td: ({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td className="text-xs px-2 py-1" {...props}>{children}</td>
  ),
};

function DocumentCard({
  document,
  expanded,
  onToggle,
  onDelete,
  onCopy,
  onExport,
  onOpenPreview,
}: {
  document: Document;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onExport: () => void;
  onOpenPreview: () => void;
}) {
  const config = DOCUMENT_TYPE_CONFIG[document.type] || DOCUMENT_TYPE_CONFIG.custom;

  // Use browser locale for dates (Issue #284)
  const date = new Date(document.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const time = new Date(document.created_at).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Parse metadata if available
  const metadata = document.metadata ? JSON.parse(document.metadata) : null;

  // Get display title (Issue #284: Fix "[" title bug)
  const displayTitle = getDisplayTitle(document, metadata);

  // Estimate content size
  const contentSize = document.content ? Math.round(document.content.length / 1024) : 0;

  // Format last accessed time
  const lastAccessed = document.last_accessed_epoch
    ? formatRelativeTime(document.last_accessed_epoch)
    : null;

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
              <span className="font-medium truncate max-w-[300px] sm:max-w-none" title={displayTitle}>
                {displayTitle}
              </span>
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
              <span className="text-base-content/30 hidden sm:inline">|</span>
              <span className="flex items-center gap-1">
                <span className="iconify ph--eye size-3" />
                {document.access_count} views
              </span>
              <span className="text-base-content/30 hidden sm:inline">|</span>
              <span className="flex items-center gap-1 hidden sm:flex">
                <span className="iconify ph--file size-3" />
                ~{contentSize} KB
              </span>
              {lastAccessed && (
                <>
                  <span className="text-base-content/30 hidden sm:inline">|</span>
                  <span className="flex items-center gap-1 hidden sm:flex" title="Last accessed">
                    <span className="iconify ph--clock size-3" />
                    {lastAccessed}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="text-right shrink-0 hidden sm:block">
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
            {metadata && Object.keys(metadata).length > 0 && (
              <div className="text-sm">
                <span className="text-base-content/60">Metadata:</span>
                <MetadataDisplay metadata={metadata} />
              </div>
            )}

            {/* Content Preview */}
            <div className="text-sm">
              <span className="text-base-content/60">Content Preview:</span>
              <div className="mt-1 p-3 bg-base-200 rounded text-xs max-h-64 overflow-y-auto prose prose-sm prose-neutral max-w-none
                prose-headings:text-sm prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
                prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
                prose-code:text-xs prose-code:bg-base-300 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                prose-pre:bg-base-300 prose-pre:p-2 prose-pre:text-xs prose-pre:overflow-x-auto">
                <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {sanitizeMarkdownPreview(document.content, 3000)}
                </Markdown>
                {document.content && document.content.length > 3000 && (
                  <div className="text-base-content/40 mt-2 pt-2 border-t border-base-300 text-center">
                    ... ({document.content.length - 3000} more characters)
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                className="btn btn-primary btn-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPreview();
                }}
                title="Open full document"
              >
                <span className="iconify ph--arrow-square-out size-4" />
                Open
              </button>
              <button
                className="btn btn-ghost btn-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy();
                }}
                title="Copy content to clipboard"
              >
                <span className="iconify ph--copy size-4" />
                Copy
              </button>
              <button
                className="btn btn-ghost btn-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onExport();
                }}
                title="Export as Markdown"
              >
                <span className="iconify ph--download size-4" />
                Export
              </button>
              <button
                className="btn btn-ghost btn-xs text-error"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title="Delete this document"
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
 * Display metadata in a user-friendly format
 */
function MetadataDisplay({ metadata }: { metadata: Record<string, unknown> }) {
  // Define known metadata keys and their display labels
  const keyLabels: Record<string, { label: string; icon: string }> = {
    query: { label: 'Query', icon: 'ph--magnifying-glass' },
    toolInput: { label: 'Tool Input', icon: 'ph--code' },
    url: { label: 'URL', icon: 'ph--link' },
    prompt: { label: 'Prompt', icon: 'ph--chat-text' },
    bytes: { label: 'Size', icon: 'ph--file' },
    code: { label: 'Status', icon: 'ph--check-circle' },
    durationMs: { label: 'Duration', icon: 'ph--timer' },
    libraryId: { label: 'Library', icon: 'ph--package' },
  };

  // Format value for display
  const formatValue = (key: string, value: unknown): string => {
    if (value === null || value === undefined) return '-';

    if (key === 'bytes' && typeof value === 'number') {
      return `${(value / 1024).toFixed(1)} KB`;
    }
    if (key === 'durationMs' && typeof value === 'number') {
      return `${value} ms`;
    }
    if (key === 'code' && typeof value === 'number') {
      return value === 200 ? '200 OK' : String(value);
    }
    if (typeof value === 'string') {
      // If it's JSON, try to parse and format it
      if (value.startsWith('{') || value.startsWith('[')) {
        try {
          const parsed = JSON.parse(value);
          // For toolInput, extract useful fields
          if (key === 'toolInput' && typeof parsed === 'object') {
            const parts: string[] = [];
            if (parsed.url) parts.push(parsed.url);
            if (parsed.libraryId) parts.push(parsed.libraryId);
            if (parsed.query) parts.push(`"${parsed.query}"`);
            if (parsed.prompt && !parsed.query) parts.push(`"${parsed.prompt.slice(0, 100)}${parsed.prompt.length > 100 ? '...' : ''}"`);
            return parts.length > 0 ? parts.join(' ') : value.slice(0, 200);
          }
        } catch {
          // Not valid JSON, use as-is
        }
      }
      // Truncate long strings
      return value.length > 200 ? value.slice(0, 200) + '...' : value;
    }
    return String(value);
  };

  // Filter and prepare entries
  const entries = Object.entries(metadata)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([key, value]) => ({
      key,
      config: keyLabels[key] || { label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'), icon: 'ph--info' },
      value: formatValue(key, value),
      isLong: typeof value === 'string' && (value.length > 80 || value.includes('\n')),
    }));

  if (entries.length === 0) return null;

  return (
    <div className="mt-1 space-y-1.5">
      {entries.map(({ key, config, value, isLong }) => (
        <div key={key} className={`flex ${isLong ? 'flex-col' : 'items-center'} gap-1.5`}>
          <div className="flex items-center gap-1.5 text-base-content/60 shrink-0">
            <span className={`iconify ${config.icon} size-3.5`} />
            <span className="text-xs font-medium">{config.label}:</span>
          </div>
          <div className={`text-xs ${isLong ? 'p-2 bg-base-200 rounded font-mono whitespace-pre-wrap break-all' : 'truncate'}`}>
            {value}
          </div>
        </div>
      ))}
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

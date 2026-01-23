/**
 * Search View
 *
 * Semantic search with filters.
 */

import { useState } from 'react';

interface SearchResult {
  id: number;
  type: 'observation' | 'summary' | 'prompt';
  title: string;
  content: string;
  project: string;
  timestamp: string;
  score: number;
  obsType?: string;
}

interface SearchFilters {
  type?: string;
  project?: string;
  dateRange?: string;
}

export function SearchView() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [searchMeta, setSearchMeta] = useState<{
    usedSemantic: boolean;
    vectorDbAvailable: boolean;
  } | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const params = new URLSearchParams({ query, limit: '30' });
      if (filters.type) params.set('type', filters.type);
      if (filters.project) params.set('project', filters.project);

      const response = await fetch(`/api/search/semantic?${params}`);
      const data = await response.json();

      setResults(data.results || []);
      setSearchMeta({
        usedSemantic: data.usedSemantic ?? false,
        vectorDbAvailable: data.vectorDbAvailable ?? false,
      });
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      setSearchMeta(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Search</h2>
        <p className="text-sm text-base-content/60">
          Find memories using semantic similarity
        </p>
      </div>

      {/* Search Input */}
      <div className="flex gap-2">
        <label className="input input-bordered flex items-center gap-2 flex-1">
          <span className="iconify ph--magnifying-glass size-5 text-base-content/40" />
          <input
            type="text"
            placeholder="Search for anything..."
            className="grow"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </label>
        <button
          className="btn btn-primary"
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
        >
          {isSearching ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <>
              <span className="iconify ph--magnifying-glass size-4" />
              Search
            </>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          className="select select-bordered select-sm"
          value={filters.type || ''}
          onChange={(e) => setFilters({ ...filters, type: e.target.value || undefined })}
        >
          <option value="">All Types</option>
          <option value="observation">Observations</option>
          <option value="summary">Summaries</option>
          <option value="prompt">Prompts</option>
        </select>

        <input
          type="text"
          placeholder="Project filter..."
          className="input input-bordered input-sm w-40"
          value={filters.project || ''}
          onChange={(e) => setFilters({ ...filters, project: e.target.value || undefined })}
        />
      </div>

      {/* Search Status */}
      {searchMeta && (
        <div className="flex items-center gap-2 text-sm">
          {searchMeta.vectorDbAvailable ? (
            searchMeta.usedSemantic ? (
              <span className="badge badge-success badge-sm badge-outline">
                <span className="iconify ph--brain size-3 mr-1" />
                Semantic Search Active
              </span>
            ) : (
              <span className="badge badge-warning badge-sm badge-outline">
                <span className="iconify ph--funnel size-3 mr-1" />
                Filter-only Mode
              </span>
            )
          ) : (
            <span className="badge badge-error badge-sm badge-outline">
              <span className="iconify ph--warning size-3 mr-1" />
              Vector DB Unavailable
            </span>
          )}
          <span className="text-base-content/50">
            {searchMeta.usedSemantic
              ? 'Results ranked by semantic similarity'
              : 'Install Chroma for semantic search'}
          </span>
        </div>
      )}

      {/* Results */}
      {isSearching ? (
        <div className="flex items-center justify-center py-16">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : !hasSearched ? (
        <div className="card bg-base-100 card-border">
          <div className="card-body items-center justify-center py-16 text-base-content/60">
            <span className="iconify ph--brain size-16 mb-4" />
            <span className="text-lg font-medium">Semantic Search</span>
            <p className="text-sm text-center max-w-md">
              Enter a natural language query to find related memories.
              Results are ranked by AI-powered similarity matching.
            </p>
          </div>
        </div>
      ) : results.length === 0 ? (
        <div className="card bg-base-100 card-border">
          <div className="card-body items-center justify-center py-16 text-base-content/60">
            <span className="iconify ph--magnifying-glass-minus size-16 mb-4" />
            <span className="text-lg font-medium">No results found</span>
            <p className="text-sm">Try a different query or adjust your filters</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-base-content/60">
            {results.length} results
            {searchMeta?.usedSemantic && results[0]?.score > 0 && (
              <span className="ml-2">
                (best match: {Math.round(results[0].score * 100)}% similarity)
              </span>
            )}
          </div>
          {results.map((result) => (
            <SearchResultCard key={`${result.type}-${result.id}`} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(result.timestamp).toLocaleString();

  const typeIcon =
    result.type === 'observation'
      ? 'ph--note'
      : result.type === 'summary'
        ? 'ph--list-bullets'
        : 'ph--chat-text';

  const typeColor =
    result.type === 'observation'
      ? 'text-primary'
      : result.type === 'summary'
        ? 'text-secondary'
        : 'text-accent';

  return (
    <div className="card bg-base-100 card-border">
      <div
        className="card-body p-3 cursor-pointer hover:bg-base-200/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className={`iconify ${typeIcon} size-5 ${typeColor} shrink-0`} />

          <div className="flex-1 min-w-0">
            <span className="font-medium block truncate">{result.title}</span>
            {result.obsType && (
              <span className="text-xs text-base-content/60">{result.obsType}</span>
            )}
          </div>

          {result.score > 0 && (
            <span className="badge badge-success badge-sm">
              {Math.round(result.score * 100)}%
            </span>
          )}

          <span className="badge badge-primary badge-sm badge-outline">
            {result.project}
          </span>

          <span className="text-xs text-base-content/50">{date}</span>

          <span
            className={`iconify ph--caret-down size-4 text-base-content/40 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </div>

        {expanded && result.content && (
          <div className="mt-3 pt-3 border-t border-base-300">
            <p className="text-sm text-base-content/80 whitespace-pre-wrap line-clamp-6">
              {result.content}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

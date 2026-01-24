/**
 * Search View
 *
 * Full-text and semantic search with filters.
 */

import { useState, useEffect, useCallback } from 'react';
import { api, type Observation } from '../api/client';
import { useQuery } from '../hooks/useApi';
import { TYPE_CONFIG, getTypeConfig } from '../utils/observation';
import { ObservationDetails } from '../components/ObservationDetails';
import * as React from "react";

interface SearchFilters {
  type: string;
  project: string;
}

export function SearchView() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Observation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({ type: '', project: '' });
  const [searchMode, setSearchMode] = useState<string | null>(null);

  // Fetch projects for filter dropdown
  const { data: projectsData } = useQuery(() => api.getProjects(), []);
  const projects = projectsData?.projects?.filter(Boolean) || [];

  // Memoized search function
  const doSearch = useCallback(async (searchQuery: string, projectFilter: string) => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const response = await api.searchSemantic({
        query: searchQuery,
        project: projectFilter || undefined,
        limit: 30,
      });

      setResults(response.items || []);
      setSearchMode(response.mode || 'text-fallback');
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      setSearchMode(null);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Auto-search when project filter changes (only if already searched)
  useEffect(() => {
    if (hasSearched && query.trim()) {
      doSearch(query, filters.project);
    }
  }, [filters.project]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => {
    doSearch(query, filters.project);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Filter results client-side by type
  const filteredResults = filters.type
    ? results.filter((r) => r.type === filters.type)
    : results;

  const types = Object.keys(TYPE_CONFIG);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Search</h2>
        <p className="text-sm text-base-content/60">
          Search through memories and observations
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
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
        >
          <option value="">All Types</option>
          {types.map((t) => (
            <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>
          ))}
        </select>

        <select
          className="select select-bordered select-sm"
          value={filters.project}
          onChange={(e) => setFilters({ ...filters, project: e.target.value })}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Search Status */}
      {searchMode && hasSearched && (
        <div className="flex items-center gap-2 text-sm">
          {searchMode === 'semantic' ? (
            <span className="badge badge-success badge-sm badge-outline">
              <span className="iconify ph--brain size-3 mr-1" />
              Semantic Search
            </span>
          ) : (
            <span className="badge badge-info badge-sm badge-outline">
              <span className="iconify ph--text-aa size-3 mr-1" />
              Full-Text Search
            </span>
          )}
          <span className="text-base-content/50">
            {searchMode === 'semantic'
              ? 'Results ranked by semantic similarity'
              : 'Results matched by text content'}
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
            <span className="iconify ph--magnifying-glass size-16 mb-4" />
            <span className="text-lg font-medium">Search Memories</span>
            <p className="text-sm text-center max-w-md">
              Enter a query to search through observations, discoveries, and decisions.
            </p>
          </div>
        </div>
      ) : filteredResults.length === 0 ? (
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
            {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}
            {filters.type && ` (filtered by ${TYPE_CONFIG[filters.type]?.label || filters.type})`}
          </div>
          {filteredResults.map((result) => (
            <SearchResultCard key={result.id} observation={result} />
          ))}
        </div>
      )}
    </div>
  );
}

function SearchResultCard({ observation }: { observation: Observation }) {
  const [expanded, setExpanded] = useState(false);
  const config = getTypeConfig(observation.type);
  const date = new Date(observation.created_at).toLocaleString('de-DE');

  return (
    <div className="card bg-base-100 card-border">
      <div
        className="card-body p-3 cursor-pointer hover:bg-base-200/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className={`iconify ${config.icon} size-5 ${config.color} shrink-0`} />

          <div className="flex-1 min-w-0">
            <span className="font-medium block truncate">{observation.title || 'Untitled'}</span>
            {observation.subtitle && (
              <span className="text-xs text-base-content/60 block truncate">{observation.subtitle}</span>
            )}
          </div>

          <span className="badge badge-ghost badge-xs">{config.label}</span>

          {observation.project && (
            <span className="badge badge-primary badge-sm badge-outline">
              {observation.project}
            </span>
          )}

          <span className="text-xs text-base-content/50 shrink-0">{date}</span>

          <span
            className={`iconify ph--caret-down size-4 text-base-content/40 transition-transform shrink-0 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-base-300">
            <ObservationDetails observation={observation} />
          </div>
        )}
      </div>
    </div>
  );
}

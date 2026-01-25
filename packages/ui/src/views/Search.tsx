/**
 * Search View
 *
 * Full-text and semantic search with filters.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, type Observation } from '../api/client';
import { useQuery } from '../hooks/useApi';
import { TYPE_CONFIG, getTypeConfig } from '../utils/observation';
import { ObservationDetails } from '../components/ObservationDetails';
import * as React from "react";

const PAGE_SIZES = [10, 20, 50];
const STORAGE_KEY_SAVED = 'search:saved';
const STORAGE_KEY_RECENT = 'search:recent';
const MAX_RECENT = 5;
const MAX_SAVED = 10;

interface SearchFilters {
  type: string;
  project: string;
}

interface SavedSearch {
  query: string;
  project?: string;
  type?: string;
  label?: string;
  createdAt: number;
}

// Quick filter presets
const QUICK_FILTERS: SavedSearch[] = [
  { query: '', type: 'decision', label: 'Decisions', createdAt: 0 },
  { query: '', type: 'bug', label: 'Bugs', createdAt: 0 },
  { query: '', type: 'discovery', label: 'Discoveries', createdAt: 0 },
];

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full or unavailable
  }
}

export function SearchView() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Observation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({ type: '', project: '' });
  const [searchMode, setSearchMode] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Saved/recent searches
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(() =>
    loadFromStorage(STORAGE_KEY_SAVED, [])
  );
  const [recentSearches, setRecentSearches] = useState<SavedSearch[]>(() =>
    loadFromStorage(STORAGE_KEY_RECENT, [])
  );
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch projects for filter dropdown
  const { data: projectsData } = useQuery(() => api.getProjects(), []);
  const projects = projectsData?.projects?.filter(Boolean) || [];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add to recent searches
  const addToRecent = useCallback((searchQuery: string, projectFilter: string) => {
    const newRecent: SavedSearch = {
      query: searchQuery,
      project: projectFilter || undefined,
      createdAt: Date.now(),
    };
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.query !== searchQuery || s.project !== projectFilter);
      const updated = [newRecent, ...filtered].slice(0, MAX_RECENT);
      saveToStorage(STORAGE_KEY_RECENT, updated);
      return updated;
    });
  }, []);

  // Memoized search function
  const doSearch = useCallback(async (searchQuery: string, projectFilter: string, typeFilter?: string) => {
    if (!searchQuery.trim() && !typeFilter) {
      setValidationError('Please enter a search query');
      return;
    }

    setValidationError(null);
    setIsSearching(true);
    setHasSearched(true);
    setPage(1);

    try {
      const response = await api.searchSemantic({
        query: searchQuery || '*',
        project: projectFilter || undefined,
        limit: 100, // Fetch more for client-side pagination
      });

      setResults(response.items || []);
      setSearchMode(response.mode || 'text-fallback');

      // Add to recent if it was a text search
      if (searchQuery.trim()) {
        addToRecent(searchQuery, projectFilter);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      setSearchMode(null);
    } finally {
      setIsSearching(false);
    }
  }, [addToRecent]);

  // Auto-search when project filter changes (only if already searched)
  useEffect(() => {
    if (hasSearched && (query.trim() || filters.type)) {
      doSearch(query, filters.project, filters.type);
    }
  }, [filters.project]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => {
    doSearch(query, filters.project, filters.type);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Save current search
  const handleSaveSearch = () => {
    if (!query.trim()) return;
    const newSaved: SavedSearch = {
      query,
      project: filters.project || undefined,
      type: filters.type || undefined,
      createdAt: Date.now(),
    };
    setSavedSearches(prev => {
      const updated = [newSaved, ...prev.filter(s => s.query !== query)].slice(0, MAX_SAVED);
      saveToStorage(STORAGE_KEY_SAVED, updated);
      return updated;
    });
  };

  // Apply a saved/recent search
  const applySearch = (search: SavedSearch) => {
    setQuery(search.query);
    setFilters({
      type: search.type || '',
      project: search.project || '',
    });
    setShowSearchDropdown(false);
    // Trigger search
    doSearch(search.query, search.project || '', search.type);
  };

  // Remove a saved search
  const removeSavedSearch = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedSearches(prev => {
      const updated = prev.filter((_, i) => i !== index);
      saveToStorage(STORAGE_KEY_SAVED, updated);
      return updated;
    });
  };

  // Filter results client-side by type
  const filteredResults = filters.type
    ? results.filter((r) => r.type === filters.type)
    : results;

  // Pagination calculations
  const totalResults = filteredResults.length;
  const totalPages = Math.ceil(totalResults / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalResults);
  const paginatedResults = filteredResults.slice(startIndex, endIndex);

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

      {/* Search Input with Dropdown */}
      <div className="flex gap-2">
        <div className="relative flex-1" ref={dropdownRef}>
          <label className="input input-bordered flex items-center gap-2 w-full">
            <span className="iconify ph--magnifying-glass size-5 text-base-content/40" />
            <input
              type="text"
              placeholder="Search... (try: type:decision project:myapp)"
              className="grow"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setValidationError(null);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSearchDropdown(true)}
            />
            {query && (
              <button
                className="btn btn-ghost btn-xs btn-circle"
                onClick={() => setQuery('')}
              >
                <span className="iconify ph--x size-3" />
              </button>
            )}
          </label>

          {/* Search Dropdown */}
          {showSearchDropdown && (savedSearches.length > 0 || recentSearches.length > 0 || QUICK_FILTERS.length > 0) && (
            <div className="absolute z-50 mt-1 w-full bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-80 overflow-y-auto">
              {/* Quick Filters */}
              <div className="p-2 border-b border-base-300">
                <div className="text-xs text-base-content/50 mb-2 px-2">Quick Filters</div>
                <div className="flex flex-wrap gap-1">
                  {QUICK_FILTERS.map((filter, i) => (
                    <button
                      key={i}
                      className="btn btn-xs btn-ghost"
                      onClick={() => applySearch(filter)}
                    >
                      <span className={`iconify ${TYPE_CONFIG[filter.type || '']?.icon || 'ph--funnel'} size-3`} />
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Saved Searches */}
              {savedSearches.length > 0 && (
                <div className="p-2 border-b border-base-300">
                  <div className="text-xs text-base-content/50 mb-1 px-2">Saved Searches</div>
                  {savedSearches.map((search, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-base-200 rounded cursor-pointer"
                      onClick={() => applySearch(search)}
                    >
                      <span className="iconify ph--bookmark-simple size-4 text-primary" />
                      <span className="flex-1 truncate text-sm">{search.query}</span>
                      {search.project && (
                        <span className="badge badge-xs badge-outline">{search.project}</span>
                      )}
                      <button
                        className="btn btn-ghost btn-xs btn-circle opacity-50 hover:opacity-100"
                        onClick={(e) => removeSavedSearch(i, e)}
                      >
                        <span className="iconify ph--x size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="p-2">
                  <div className="text-xs text-base-content/50 mb-1 px-2">Recent</div>
                  {recentSearches.map((search, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-base-200 rounded cursor-pointer"
                      onClick={() => applySearch(search)}
                    >
                      <span className="iconify ph--clock-counter-clockwise size-4 text-base-content/50" />
                      <span className="flex-1 truncate text-sm">{search.query}</span>
                      {search.project && (
                        <span className="badge badge-xs badge-outline">{search.project}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSearch}
          disabled={isSearching}
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

        {/* Save Search Button */}
        {query.trim() && hasSearched && (
          <button
            className="btn btn-ghost btn-square"
            onClick={handleSaveSearch}
            title="Save this search"
          >
            <span className="iconify ph--bookmark-simple size-5" />
          </button>
        )}
      </div>

      {/* Validation Error */}
      {validationError && (
        <div className="text-error text-sm flex items-center gap-2">
          <span className="iconify ph--warning-circle size-4" />
          {validationError}
        </div>
      )}

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
              <br />
              <span className="text-xs opacity-70 mt-2 block">
                Tip: Use filters to narrow results, or try semantic search for related concepts.
              </span>
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
          {/* Results Header with Pagination Info */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm text-base-content/60">
              {totalResults} result{totalResults !== 1 ? 's' : ''}
              {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
              {filters.type && ` (filtered by ${TYPE_CONFIG[filters.type]?.label || filters.type})`}
            </div>

            {/* Page Size Selector */}
            {totalResults > PAGE_SIZES[0] && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-base-content/50">Show:</span>
                <select
                  className="select select-bordered select-xs"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Result Cards */}
          {paginatedResults.map((result) => (
            <SearchResultCard key={result.id} observation={result} searchQuery={query} />
          ))}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                className="btn btn-sm btn-ghost"
                disabled={page === 1}
                onClick={() => setPage(1)}
              >
                <span className="iconify ph--caret-double-left size-4" />
              </button>
              <button
                className="btn btn-sm btn-ghost"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <span className="iconify ph--caret-left size-4" />
              </button>

              <span className="text-sm px-4">
                Page {page} of {totalPages}
              </span>

              <button
                className="btn btn-sm btn-ghost"
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                <span className="iconify ph--caret-right size-4" />
              </button>
              <button
                className="btn btn-sm btn-ghost"
                disabled={page === totalPages}
                onClick={() => setPage(totalPages)}
              >
                <span className="iconify ph--caret-double-right size-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Highlight search terms in text
function highlightTerms(text: string, searchQuery: string): React.ReactNode {
  if (!searchQuery.trim()) return text;

  // Extract words from search query (ignore special syntax like type: or project:)
  const terms = searchQuery
    .split(/\s+/)
    .filter(t => !t.includes(':') && t.length > 1)
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (terms.length === 0) return text;

  const regex = new RegExp(`(${terms.join('|')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) =>
    terms.some(t => part.toLowerCase() === t.toLowerCase()) ? (
      <mark key={i} className="bg-warning/30 text-warning-content rounded px-0.5">{part}</mark>
    ) : (
      part
    )
  );
}

// Get preview text from observation
function getPreviewText(observation: Observation): string {
  const text = observation.text || observation.narrative || '';
  if (text.length <= 200) return text;
  return text.slice(0, 200).trim() + '...';
}

function SearchResultCard({
  observation,
  searchQuery = '',
}: {
  observation: Observation;
  searchQuery?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = getTypeConfig(observation.type);
  const date = new Date(observation.created_at).toLocaleString('de-DE');
  const previewText = getPreviewText(observation);

  return (
    <div className="card bg-base-100 card-border">
      <div
        className="card-body p-3 cursor-pointer hover:bg-base-200/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className={`iconify ${config.icon} size-5 ${config.color} shrink-0`} />

          <div className="flex-1 min-w-0">
            <span className="font-medium block truncate">
              {highlightTerms(observation.title || 'Untitled', searchQuery)}
            </span>
            {observation.subtitle && (
              <span className="text-xs text-base-content/60 block truncate">
                {highlightTerms(observation.subtitle, searchQuery)}
              </span>
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

        {/* Content Preview */}
        {!expanded && previewText && (
          <div className="mt-2 text-sm text-base-content/70 line-clamp-2">
            {highlightTerms(previewText, searchQuery)}
          </div>
        )}

        {expanded && (
          <div className="mt-3 pt-3 border-t border-base-300">
            <ObservationDetails observation={observation} />
          </div>
        )}
      </div>
    </div>
  );
}

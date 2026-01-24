/**
 * Response Cache Service (Issue #203)
 *
 * In-memory LRU cache with TTL support for expensive API endpoints.
 * Provides cache invalidation patterns and metrics.
 */

import { LRUCache } from 'lru-cache';
import { createLogger } from '@claude-mem/shared';

const logger = createLogger('cache-service');

export interface CacheOptions {
  /** Time-to-live in milliseconds */
  ttl: number;
  /** Maximum number of entries */
  max: number;
  /** Cache name for logging/metrics */
  name?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

/**
 * Generic response cache with TTL and LRU eviction
 */
export class ResponseCache<T extends object = object> {
  private cache: LRUCache<string, T>;
  private hits = 0;
  private misses = 0;
  private readonly name: string;

  constructor(options: CacheOptions) {
    this.name = options.name || 'unnamed';
    this.cache = new LRUCache<string, T>({
      max: options.max,
      ttl: options.ttl,
    });

    logger.debug(`Cache "${this.name}" initialized: max=${options.max}, ttl=${options.ttl}ms`);
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.hits++;
      return value;
    }
    this.misses++;
    return undefined;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T): void {
    this.cache.set(key, value);
  }

  /**
   * Get or compute value (cache-aside pattern)
   */
  async getOrSet(key: string, fn: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      logger.debug(`Cache hit: ${this.name}:${key}`);
      return cached;
    }

    logger.debug(`Cache miss: ${this.name}:${key}`);
    const result = await fn();
    this.set(key, result);
    return result;
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching a prefix pattern
   */
  invalidate(pattern: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    if (count > 0) {
      logger.debug(`Cache invalidated: ${this.name}:${pattern}* (${count} keys)`);
    }
    return count;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    logger.debug(`Cache cleared: ${this.name}`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }
}

/**
 * Pre-configured caches for different endpoint types
 */
export const projectCache = new ResponseCache({
  name: 'projects',
  ttl: 60_000,  // 1 minute
  max: 100,
});

export const analyticsCache = new ResponseCache({
  name: 'analytics',
  ttl: 300_000, // 5 minutes
  max: 50,
});

export const searchCache = new ResponseCache({
  name: 'search',
  ttl: 30_000,  // 30 seconds
  max: 200,
});

export const statsCache = new ResponseCache({
  name: 'stats',
  ttl: 60_000,  // 1 minute
  max: 50,
});

/**
 * Cache manager for centralized control
 */
export class CacheManager {
  private caches: Map<string, ResponseCache<object>> = new Map();

  constructor() {
    // Register default caches
    this.register('projects', projectCache);
    this.register('analytics', analyticsCache);
    this.register('search', searchCache);
    this.register('stats', statsCache);
  }

  /**
   * Register a cache instance
   */
  register(name: string, cache: ResponseCache<object>): void {
    this.caches.set(name, cache);
  }

  /**
   * Get a cache by name
   */
  get(name: string): ResponseCache<object> | undefined {
    return this.caches.get(name);
  }

  /**
   * Invalidate across all caches by pattern
   */
  invalidateAll(pattern: string): number {
    let total = 0;
    for (const cache of this.caches.values()) {
      total += cache.invalidate(pattern);
    }
    return total;
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
    logger.info('All caches cleared');
  }

  /**
   * Get stats for all caches
   */
  getAllStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    for (const [name, cache] of this.caches) {
      stats[name] = cache.getStats();
    }
    return stats;
  }

  /**
   * Invalidate caches when observation is created
   */
  onObservationCreated(project: string): void {
    projectCache.invalidate(`projects:`);
    analyticsCache.invalidate(`analytics:${project}`);
    analyticsCache.invalidate(`analytics:overview`);
    searchCache.invalidate(`search:`);
    statsCache.invalidate(`stats:`);
    logger.debug(`Caches invalidated for observation in project: ${project}`);
  }

  /**
   * Invalidate caches when session completes
   */
  onSessionCompleted(project: string): void {
    projectCache.invalidate(`projects:`);
    analyticsCache.invalidate(`analytics:`);
    statsCache.invalidate(`stats:`);
    logger.debug(`Caches invalidated for session completion in project: ${project}`);
  }

  /**
   * Invalidate caches when document is created
   */
  onDocumentCreated(project: string): void {
    searchCache.invalidate(`documents:${project}`);
    searchCache.invalidate(`documents:search`);
    logger.debug(`Caches invalidated for document in project: ${project}`);
  }
}

// Singleton instance
export const cacheManager = new CacheManager();

/**
 * Helper to create cache key from request
 */
export function createCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sortedParams = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join('&');

  return sortedParams ? `${prefix}:${sortedParams}` : `${prefix}:default`;
}

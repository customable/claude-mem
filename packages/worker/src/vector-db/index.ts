/**
 * Vector Database Provider Registry (Issue #112)
 *
 * Manages vector database providers with a registry pattern.
 * Providers can be registered and retrieved by name.
 */

import { createLogger, loadSettings } from '@claude-mem/shared';
import type {
  VectorDatabase,
  VectorDbConfig,
  VectorDbFactory,
} from './types.js';
import { createNoneProvider } from './none-provider.js';
import { createQdrantProvider } from './qdrant-provider.js';

const logger = createLogger('vector-db-registry');

// Re-export types
export type {
  VectorDatabase,
  VectorDbConfig,
  VectorDbFactory,
  VectorDocument,
  VectorSearchResult,
  VectorSearchOptions,
  VectorDbStats,
} from './types.js';

/**
 * Registry of vector database provider factories
 */
const providerFactories = new Map<string, VectorDbFactory>();

/**
 * Singleton instances of initialized providers
 */
const providerInstances = new Map<string, VectorDatabase>();

/**
 * Register a provider factory
 */
export function registerVectorDbProvider(
  name: string,
  factory: VectorDbFactory
): void {
  if (providerFactories.has(name)) {
    logger.warn(`Overwriting existing vector database provider: ${name}`);
  }
  providerFactories.set(name, factory);
  logger.debug(`Registered vector database provider: ${name}`);
}

/**
 * Get or create a vector database provider by name
 *
 * Uses singleton pattern - each provider is only instantiated once.
 */
export function getVectorDbProvider(
  name?: string,
  config?: VectorDbConfig
): VectorDatabase {
  const settings = loadSettings();

  // Determine provider name from settings if not specified
  const providerName = name || settings.VECTOR_DB || 'none';

  // Check for existing instance
  if (providerInstances.has(providerName)) {
    return providerInstances.get(providerName)!;
  }

  // Get factory
  const factory = providerFactories.get(providerName);
  if (!factory) {
    throw new Error(
      `Unknown vector database provider: ${providerName}. Available: ${Array.from(
        providerFactories.keys()
      ).join(', ')}`
    );
  }

  // Create and cache instance
  const provider = factory(config);
  providerInstances.set(providerName, provider);

  logger.info(`Created vector database provider: ${providerName}`);

  return provider;
}

/**
 * Get list of available provider names
 */
export function getAvailableVectorDbProviders(): string[] {
  return Array.from(providerFactories.keys());
}

/**
 * Check if a provider is registered
 */
export function hasVectorDbProvider(name: string): boolean {
  return providerFactories.has(name);
}

/**
 * Check if vector search is enabled (not using 'none' provider)
 */
export function isVectorSearchEnabled(): boolean {
  const settings = loadSettings();
  return settings.VECTOR_DB !== 'none';
}

/**
 * Reset all provider instances (for testing)
 */
export async function resetVectorDbProviders(): Promise<void> {
  for (const provider of providerInstances.values()) {
    await provider.close();
  }
  providerInstances.clear();
  logger.debug('All vector database provider instances reset');
}

// ============================================
// Register built-in providers
// ============================================

registerVectorDbProvider('none', createNoneProvider);
registerVectorDbProvider('qdrant', createQdrantProvider);

// Log available providers on module load
logger.debug('Available vector database providers:', {
  providers: getAvailableVectorDbProviders(),
});

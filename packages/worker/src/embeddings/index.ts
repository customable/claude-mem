/**
 * Embedding Provider Registry (Issue #112)
 *
 * Manages embedding providers with a registry pattern.
 * Providers can be registered and retrieved by name.
 */

import { createLogger, loadSettings } from '@claude-mem/shared';
import type {
  EmbeddingProvider,
  EmbeddingProviderConfig,
  EmbeddingProviderFactory,
} from './types.js';
import { createLocalProvider } from './local-provider.js';
import { createMistralProvider } from './mistral-provider.js';
import { createOpenAIProvider } from './openai-provider.js';

const logger = createLogger('embedding-registry');

// Re-export types
export type { EmbeddingProvider, EmbeddingProviderConfig, EmbeddingProviderFactory } from './types.js';

/**
 * Registry of embedding provider factories
 */
const providerFactories = new Map<string, EmbeddingProviderFactory>();

/**
 * Singleton instances of initialized providers
 */
const providerInstances = new Map<string, EmbeddingProvider>();

/**
 * Register a provider factory
 */
export function registerEmbeddingProvider(
  name: string,
  factory: EmbeddingProviderFactory
): void {
  if (providerFactories.has(name)) {
    logger.warn(`Overwriting existing embedding provider: ${name}`);
  }
  providerFactories.set(name, factory);
  logger.debug(`Registered embedding provider: ${name}`);
}

/**
 * Get or create an embedding provider by name
 *
 * Uses singleton pattern - each provider is only instantiated once.
 */
export function getEmbeddingProvider(
  name?: string,
  config?: EmbeddingProviderConfig
): EmbeddingProvider {
  const settings = loadSettings();

  // Determine provider name
  const providerName = name || settings.EMBEDDING_PROVIDER || 'local';

  // Check for existing instance
  if (providerInstances.has(providerName)) {
    return providerInstances.get(providerName)!;
  }

  // Get factory
  const factory = providerFactories.get(providerName);
  if (!factory) {
    throw new Error(
      `Unknown embedding provider: ${providerName}. Available: ${Array.from(
        providerFactories.keys()
      ).join(', ')}`
    );
  }

  // Create and cache instance
  const provider = factory(config);
  providerInstances.set(providerName, provider);

  logger.info(`Created embedding provider: ${providerName}`, {
    dimension: provider.dimension,
  });

  return provider;
}

/**
 * Get list of available provider names
 */
export function getAvailableEmbeddingProviders(): string[] {
  return Array.from(providerFactories.keys());
}

/**
 * Check if a provider is registered
 */
export function hasEmbeddingProvider(name: string): boolean {
  return providerFactories.has(name);
}

/**
 * Reset all provider instances (for testing)
 */
export async function resetEmbeddingProviders(): Promise<void> {
  for (const provider of providerInstances.values()) {
    await provider.close();
  }
  providerInstances.clear();
  logger.debug('All embedding provider instances reset');
}

// ============================================
// Register built-in providers
// ============================================

registerEmbeddingProvider('local', createLocalProvider);
registerEmbeddingProvider('mistral', createMistralProvider);
registerEmbeddingProvider('openai', createOpenAIProvider);

// Log available providers on module load
logger.debug('Available embedding providers:', {
  providers: getAvailableEmbeddingProviders(),
});

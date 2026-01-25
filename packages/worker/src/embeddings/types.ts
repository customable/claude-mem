/**
 * Embedding Provider Types (Issue #112)
 *
 * Defines the interface for embedding providers to enable
 * provider-agnostic embedding generation.
 */

/**
 * Embedding Provider Interface
 *
 * All embedding providers must implement this interface.
 */
export interface EmbeddingProvider {
  /** Provider name (e.g., 'local', 'mistral', 'openai') */
  readonly name: string;

  /** Vector dimension produced by this provider */
  readonly dimension: number;

  /**
   * Initialize the provider (load models, establish connections)
   * Should be idempotent - safe to call multiple times.
   */
  initialize(): Promise<void>;

  /**
   * Generate embeddings for multiple texts
   * @param texts Array of texts to embed
   * @returns Array of embedding vectors
   */
  embed(texts: string[]): Promise<number[][]>;

  /**
   * Generate embedding for a single text
   * @param text Text to embed
   * @returns Embedding vector
   */
  embedSingle(text: string): Promise<number[]>;

  /**
   * Check if provider is ready
   */
  isInitialized(): boolean;

  /**
   * Cleanup resources
   */
  close(): Promise<void>;
}

/**
 * Embedding provider configuration
 */
export interface EmbeddingProviderConfig {
  /** Model identifier (provider-specific) */
  model?: string;
  /** API key (for cloud providers) */
  apiKey?: string;
  /** Custom base URL */
  baseUrl?: string;
  /** Additional provider-specific options */
  options?: Record<string, unknown>;
}

/**
 * Factory function type for creating embedding providers
 */
export type EmbeddingProviderFactory = (config?: EmbeddingProviderConfig) => EmbeddingProvider;

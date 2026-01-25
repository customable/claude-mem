/**
 * Vector Database Types (Issue #112)
 *
 * Defines the interface for vector database providers to enable
 * provider-agnostic vector storage and search.
 */

/**
 * Document to be stored in the vector database
 */
export interface VectorDocument {
  id: string;
  text: string;
  metadata: {
    type: 'observation' | 'summary' | 'prompt';
    project: string;
    sessionId?: string;
    observationId?: number;
    summaryId?: number;
    promptId?: number;
    createdAt: string;
    [key: string]: unknown;
  };
}

/**
 * Search result from vector similarity search
 */
export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: VectorDocument['metadata'];
}

/**
 * Search options for vector queries
 */
export interface VectorSearchOptions {
  /** Maximum number of results to return */
  limit?: number;
  /** Filter by document type and/or project */
  filter?: {
    type?: string;
    project?: string;
  };
  /** Minimum similarity score threshold (0-1) */
  scoreThreshold?: number;
}

/**
 * Vector database statistics
 */
export interface VectorDbStats {
  totalDocuments: number;
  indexedDocuments: number;
}

/**
 * Vector Database Provider Interface
 *
 * All vector database providers must implement this interface.
 */
export interface VectorDatabase {
  /** Provider name (e.g., 'qdrant', 'sqlite-vec', 'none') */
  readonly name: string;

  /**
   * Initialize the provider (establish connections, create collections)
   * Should be idempotent - safe to call multiple times.
   */
  initialize(): Promise<void>;

  /**
   * Check if provider is initialized and ready
   */
  isInitialized(): boolean;

  /**
   * Check if provider is available (can connect to backend)
   */
  isAvailable(): Promise<boolean>;

  /**
   * Upsert documents into the vector store
   * @param documents Documents to store with their text for embedding
   */
  upsert(documents: VectorDocument[]): Promise<void>;

  /**
   * Search for similar documents
   * @param query Search query text
   * @param options Search options (limit, filter, threshold)
   */
  search(query: string, options?: VectorSearchOptions): Promise<VectorSearchResult[]>;

  /**
   * Delete documents by IDs
   * @param ids Document IDs to delete
   */
  delete(ids: string[]): Promise<void>;

  /**
   * Delete documents by filter
   * @param filter Filter criteria (type and/or project)
   */
  deleteByFilter(filter: { type?: string; project?: string }): Promise<void>;

  /**
   * Get collection statistics
   */
  getStats(): Promise<VectorDbStats>;

  /**
   * Cleanup resources
   */
  close(): Promise<void>;
}

/**
 * Vector database provider configuration
 */
export interface VectorDbConfig {
  /** Connection URL (for remote providers) */
  url?: string;
  /** API key (for cloud providers) */
  apiKey?: string;
  /** Collection/table name */
  collectionName?: string;
  /** Additional provider-specific options */
  options?: Record<string, unknown>;
}

/**
 * Factory function type for creating vector database providers
 */
export type VectorDbFactory = (config?: VectorDbConfig) => VectorDatabase;

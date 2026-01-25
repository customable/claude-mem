/**
 * Worker Services
 */

// Legacy Qdrant service exports (for backwards compatibility)
export {
  QdrantService,
  getQdrantService,
  resetQdrantService,
  type QdrantServiceConfig,
} from './qdrant-service.js';

// Vector DB provider exports (Issue #112)
export {
  getVectorDbProvider,
  registerVectorDbProvider,
  getAvailableVectorDbProviders,
  hasVectorDbProvider,
  isVectorSearchEnabled,
  resetVectorDbProviders,
  type VectorDatabase,
  type VectorDbConfig,
  type VectorDocument,
  type VectorSearchResult,
  type VectorSearchOptions,
  type VectorDbStats,
} from '../vector-db/index.js';

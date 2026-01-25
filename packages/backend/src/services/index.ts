/**
 * Backend Services
 */

export { SSEBroadcaster } from './sse-broadcaster.js';
export type { SSEEvent, SSEEventType } from './sse-broadcaster.js';

export { TaskService } from './task-service.js';
export type { TaskServiceOptions } from './task-service.js';

export { SessionService } from './session-service.js';

export { InsightsService } from './insights-service.js';

export { LazyProcessingService, createLazyProcessingService } from './lazy-processing-service.js';
export type { LazyProcessingStatus, ProcessBatchResult, LazyProcessingServiceDeps } from './lazy-processing-service.js';

export { WorkerProcessManager } from './worker-process-manager.js';
export type { SpawnedWorker, SpawnedWorkerInfo } from './worker-process-manager.js';

export { DecisionService, createDecisionService } from './decision-service.js';
export type { DecisionServiceDeps } from './decision-service.js';

export { SleepAgentService, createSleepAgentService } from './sleep-agent-service.js';
export type { SleepAgentServiceDeps, SleepAgentConfig, SleepAgentStatus, ConsolidationResult } from './sleep-agent-service.js';

export { SuggestionService } from './suggestion-service.js';
export type { SuggestionServiceOptions, SuggestionContext, Suggestion, SuggestionFeedback } from './suggestion-service.js';

export { PluginManager, createPluginManager } from './plugin-manager.js';

export { ShareService, createShareService } from './share-service.js';
export type { ShareServiceDeps } from './share-service.js';

export { CleanupService, createCleanupService } from './cleanup-service.js';
export type { CleanupServiceDeps, CleanupResult, CleanupConfig } from './cleanup-service.js';

export {
  ResponseCache,
  CacheManager,
  cacheManager,
  projectCache,
  analyticsCache,
  searchCache,
  statsCache,
  createCacheKey,
} from './cache-service.js';
export type { CacheOptions, CacheStats } from './cache-service.js';

export { WorkerTokenService } from './worker-token-service.js';

export { HubRegistry, BUILTIN_HUB_ID, BUILTIN_HUB_NAME } from './hub-registry.js';

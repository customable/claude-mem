/**
 * Worker Capabilities System
 *
 * Workers register with the backend declaring their capabilities.
 * The backend assigns tasks to workers based on matching capabilities.
 */

/**
 * Worker mode for task processing
 * - spawn: Traditional mode, spawn separate worker processes
 * - in-process: Hook process becomes the worker (no spawn)
 * - hybrid: In-process preferred, spawn as fallback
 */
export type WorkerMode = 'spawn' | 'in-process' | 'hybrid';

// ============================================
// Abstract Capabilities (Issue #226)
// ============================================

/**
 * Abstract worker capabilities (decoupled from providers)
 * Describes WHAT a worker can do, not HOW it does it.
 */
export type AbstractCapability =
  | 'observation'      // Generate observations from tool use
  | 'summarize'        // Summarize sessions
  | 'embedding'        // Generate embeddings
  | 'qdrant-sync'      // Sync to vector database
  | 'semantic-search'  // Semantic vector search
  | 'context-generate' // Generate context
  | 'claudemd-generate'; // Generate CLAUDE.md content

/**
 * LLM providers for AI tasks (observation, summarize, claudemd, context)
 */
export type LLMProvider = 'mistral' | 'gemini' | 'openrouter' | 'openai' | 'anthropic' | 'sdk';

/**
 * Embedding providers for vector embeddings
 */
export type EmbeddingProvider = 'local' | 'openai' | 'voyage';

/**
 * Vector database providers
 */
export type VectorDBProvider = 'qdrant-local' | 'qdrant-cloud' | 'qdrant-remote';

/**
 * Provider configuration for a worker
 */
export interface ProviderConfig {
  /** LLM provider for AI tasks (observation, summarize, claudemd, context) */
  llm?: LLMProvider;
  /** Embedding provider for vector generation */
  embedding?: EmbeddingProvider;
  /** Vector database provider */
  vectordb?: VectorDBProvider;
}

/**
 * Worker configuration with abstract capabilities and providers (Issue #226)
 */
export interface WorkerConfig {
  /** Abstract capabilities this worker can handle */
  capabilities: AbstractCapability[];
  /** Provider configuration */
  providers: ProviderConfig;
  /** Optional name/comment for this worker */
  name?: string;
}

/**
 * Mapping from abstract capabilities to provider types
 */
export const CAPABILITY_PROVIDER_MAP: Record<AbstractCapability, keyof ProviderConfig | null> = {
  'observation': 'llm',
  'summarize': 'llm',
  'claudemd-generate': 'llm',
  'context-generate': 'llm',
  'embedding': 'embedding',
  'qdrant-sync': 'vectordb',
  'semantic-search': 'vectordb',
};

/**
 * Get the provider type for a capability
 */
export function getProviderTypeForCapability(capability: AbstractCapability): keyof ProviderConfig | null {
  return CAPABILITY_PROVIDER_MAP[capability];
}

/**
 * Convert abstract capability + provider to legacy capability string
 * For backwards compatibility during migration
 */
export function toLegacyCapability(capability: AbstractCapability, providers: ProviderConfig): WorkerCapability | null {
  const providerType = CAPABILITY_PROVIDER_MAP[capability];
  if (!providerType) {
    // Capabilities without provider mapping
    if (capability === 'qdrant-sync') return 'qdrant:sync';
    if (capability === 'semantic-search') return 'semantic:search';
    if (capability === 'context-generate') return 'context:generate';
    if (capability === 'claudemd-generate') return 'claudemd:generate';
    return null;
  }

  const provider = providers[providerType];
  if (!provider) return null;

  // Map to legacy format
  if (capability === 'observation' && providerType === 'llm') {
    return `observation:${provider}` as WorkerCapability;
  }
  if (capability === 'summarize' && providerType === 'llm') {
    return `summarize:${provider}` as WorkerCapability;
  }
  if (capability === 'embedding' && providerType === 'embedding') {
    return `embedding:${provider}` as WorkerCapability;
  }

  return null;
}

/**
 * Convert legacy capability to abstract capability + provider
 */
export function fromLegacyCapability(legacy: WorkerCapability): { capability: AbstractCapability; provider?: string } | null {
  if (legacy.startsWith('observation:')) {
    return { capability: 'observation', provider: legacy.replace('observation:', '') };
  }
  if (legacy.startsWith('summarize:')) {
    return { capability: 'summarize', provider: legacy.replace('summarize:', '') };
  }
  if (legacy.startsWith('embedding:')) {
    return { capability: 'embedding', provider: legacy.replace('embedding:', '') };
  }
  if (legacy === 'qdrant:sync') return { capability: 'qdrant-sync' };
  if (legacy === 'semantic:search') return { capability: 'semantic-search' };
  if (legacy === 'context:generate') return { capability: 'context-generate' };
  if (legacy === 'claudemd:generate') return { capability: 'claudemd-generate' };
  return null;
}

// ============================================
// Legacy Capabilities (backwards compatibility)
// ============================================

/**
 * All possible worker capabilities (legacy format with provider suffix)
 * @deprecated Use AbstractCapability + ProviderConfig instead
 */
export type WorkerCapability =
  // AI Observation Generation
  | 'observation:mistral'
  | 'observation:gemini'
  | 'observation:openrouter'
  | 'observation:sdk'
  | 'observation:openai'
  | 'observation:anthropic'
  // Session Summarization
  | 'summarize:mistral'
  | 'summarize:gemini'
  | 'summarize:openrouter'
  | 'summarize:sdk'
  | 'summarize:openai'
  | 'summarize:anthropic'
  // Embeddings & Vector Search
  | 'embedding:local'
  | 'embedding:openai'
  | 'embedding:voyage'
  // Vector DB Sync
  | 'qdrant:sync'
  // Semantic Search
  | 'semantic:search'
  // Context Generation
  | 'context:generate'
  // CLAUDE.md Generation
  | 'claudemd:generate';

/**
 * Worker registration info
 */
export interface WorkerRegistration {
  workerId: string;
  capabilities: WorkerCapability[];
  metadata?: {
    hostname?: string;
    version?: string;
    startedAt?: number;
  };
}

/**
 * Connected worker state (tracked by backend)
 */
export interface ConnectedWorker {
  workerId: string;
  capabilities: WorkerCapability[];
  connectedAt: number;
  lastHeartbeat: number;
  currentTasks: string[];  // Task IDs currently being processed
  metadata?: {
    hostname?: string;
    version?: string;
  };
}

/**
 * Capability requirements for a task
 */
export interface TaskRequirements {
  /** Required capability to handle this task */
  requiredCapability: WorkerCapability;
  /** Fallback capabilities if primary not available */
  fallbackCapabilities?: WorkerCapability[];
}

// ============================================
// Worker Profiles (Issue #224)
// ============================================

/**
 * Worker profile configuration
 * Defines a group of workers with specific capabilities
 */
export interface WorkerProfile {
  /** Profile name for identification */
  name: string;
  /** Capabilities this profile provides */
  capabilities: AbstractCapability[];
  /** Number of workers to spawn with this profile */
  count: number;
  /** Provider configuration */
  providers: ProviderConfig;
  /** Priority for task assignment (higher = prioritized) */
  priority?: number;
}

/**
 * Capability limits configuration
 * Limits concurrent workers handling a specific capability
 */
export type CapabilityLimits = Partial<Record<AbstractCapability, number>>;

/**
 * Parse worker profiles from JSON string
 */
export function parseWorkerProfiles(json: string): WorkerProfile[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is WorkerProfile =>
      typeof p === 'object' &&
      p !== null &&
      typeof p.name === 'string' &&
      Array.isArray(p.capabilities) &&
      typeof p.count === 'number'
    );
  } catch {
    return [];
  }
}

/**
 * Parse capability limits from JSON string
 */
export function parseCapabilityLimits(json: string): CapabilityLimits {
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as CapabilityLimits;
  } catch {
    return {};
  }
}

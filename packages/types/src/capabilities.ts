/**
 * Worker Capabilities System
 *
 * Workers register with the backend declaring their capabilities.
 * The backend assigns tasks to workers based on matching capabilities.
 */

/**
 * All possible worker capabilities
 */
export type WorkerCapability =
  // AI Observation Generation
  | 'observation:mistral'
  | 'observation:gemini'
  | 'observation:openrouter'
  | 'observation:sdk'
  | 'observation:openai'
  // Session Summarization
  | 'summarize:mistral'
  | 'summarize:gemini'
  | 'summarize:openrouter'
  | 'summarize:sdk'
  | 'summarize:openai'
  // Embeddings & Vector Search
  | 'embedding:local'
  | 'embedding:openai'
  | 'embedding:voyage'
  // Vector DB Sync
  | 'chroma:sync'
  | 'qdrant:sync'
  // Context Generation
  | 'context:generate';

/**
 * Capability configuration with optional metadata
 */
export interface CapabilityConfig {
  capability: WorkerCapability;
  priority?: number;  // Higher = preferred for this task type
  maxConcurrent?: number;  // Max concurrent tasks of this type
}

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

/**
 * Check if a worker can handle given requirements
 */
export function canWorkerHandle(
  worker: ConnectedWorker,
  requirements: TaskRequirements
): boolean {
  if (worker.capabilities.includes(requirements.requiredCapability)) {
    return true;
  }
  if (requirements.fallbackCapabilities) {
    return requirements.fallbackCapabilities.some(cap =>
      worker.capabilities.includes(cap)
    );
  }
  return false;
}

/**
 * Get the capability that a worker will use for given requirements
 */
export function getMatchingCapability(
  worker: ConnectedWorker,
  requirements: TaskRequirements
): WorkerCapability | null {
  if (worker.capabilities.includes(requirements.requiredCapability)) {
    return requirements.requiredCapability;
  }
  if (requirements.fallbackCapabilities) {
    for (const cap of requirements.fallbackCapabilities) {
      if (worker.capabilities.includes(cap)) {
        return cap;
      }
    }
  }
  return null;
}

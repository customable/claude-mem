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
  | 'qdrant:sync'
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

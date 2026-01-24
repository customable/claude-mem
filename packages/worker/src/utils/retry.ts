/**
 * Exponential Backoff Retry Utilities (Issue #206)
 *
 * Implements exponential backoff with jitter to prevent thundering herd
 * when multiple tasks fail simultaneously.
 */

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Multiplier for each retry (typically 2 for exponential) */
  multiplier: number;
  /** Random variation factor (0-1), e.g., 0.2 = ±20% */
  jitterFactor: number;
}

/**
 * Default retry configuration
 */
export const defaultRetryConfig: RetryConfig = {
  initialDelayMs: 1000,    // 1 second
  maxDelayMs: 60000,       // 1 minute max
  multiplier: 2,           // Double each time
  jitterFactor: 0.2,       // ±20% variation
};

/**
 * Per-task-type retry configurations
 */
export const taskRetryConfigs: Record<string, RetryConfig> = {
  observation: {
    initialDelayMs: 500,
    maxDelayMs: 30000,
    multiplier: 2,
    jitterFactor: 0.1,
  },
  embedding: {
    initialDelayMs: 2000,
    maxDelayMs: 120000,
    multiplier: 2,
    jitterFactor: 0.2,
  },
  'qdrant-sync': {
    initialDelayMs: 5000,
    maxDelayMs: 300000,
    multiplier: 2,
    jitterFactor: 0.3,
  },
  summarize: {
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    multiplier: 2,
    jitterFactor: 0.1,
  },
  'claude-md': {
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    multiplier: 2,
    jitterFactor: 0.1,
  },
  'context-generate': {
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    multiplier: 2,
    jitterFactor: 0.1,
  },
  'semantic-search': {
    initialDelayMs: 500,
    maxDelayMs: 30000,
    multiplier: 2,
    jitterFactor: 0.1,
  },
};

/**
 * Calculate retry delay with exponential backoff and jitter
 *
 * The formula is:
 *   delay = min(initialDelay * multiplier^retryCount, maxDelay)
 *   jitter = delay * jitterFactor * random(-1, 1)
 *   finalDelay = delay + jitter
 *
 * Example with default config:
 *   Retry 1: ~1s (0.8-1.2s with jitter)
 *   Retry 2: ~2s (1.6-2.4s with jitter)
 *   Retry 3: ~4s (3.2-4.8s with jitter)
 *   Retry 4: ~8s (6.4-9.6s with jitter)
 *   Retry 5: ~16s (12.8-19.2s with jitter)
 *   Retry 6: ~32s (25.6-38.4s with jitter)
 *   Retry 7+: ~60s (48-72s with jitter, capped at maxDelay)
 *
 * @param retryCount The current retry attempt (0-indexed)
 * @param config Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(
  retryCount: number,
  config: RetryConfig = defaultRetryConfig
): number {
  // Exponential: initialDelay * multiplier^retryCount
  const exponentialDelay = config.initialDelayMs * Math.pow(config.multiplier, retryCount);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter to prevent thundering herd
  // jitter is a random value between -jitterFactor and +jitterFactor of the delay
  const jitter = cappedDelay * config.jitterFactor * (Math.random() * 2 - 1);

  // Ensure we never return a negative delay
  return Math.max(0, Math.round(cappedDelay + jitter));
}

/**
 * Get retry configuration for a specific task type
 *
 * @param taskType The task type
 * @returns RetryConfig for the task type, or default config
 */
export function getRetryConfig(taskType: string): RetryConfig {
  return taskRetryConfigs[taskType] || defaultRetryConfig;
}

/**
 * Calculate the retryAfter timestamp for a failed task
 *
 * @param retryCount Current retry count (will be incremented)
 * @param taskType Task type for specific config
 * @returns Unix timestamp (ms) when the task should be retried
 */
export function calculateRetryAfter(retryCount: number, taskType: string): number {
  const config = getRetryConfig(taskType);
  const delay = calculateRetryDelay(retryCount, config);
  return Date.now() + delay;
}

/**
 * Settings Types
 *
 * Type definitions for the Settings view.
 */

export type SettingsTab = 'general' | 'provider' | 'context' | 'workers' | 'processing' | 'advanced';

export interface ValidationRule {
  validate: (value: unknown) => boolean;
  message: string;
}

export interface Settings {
  // General
  LOG_LEVEL?: string;
  DATA_DIR?: string;

  // Provider
  AI_PROVIDER?: string;
  AI_PROVIDER_FALLBACK?: string[];
  ENABLED_PROVIDERS?: string;
  MISTRAL_API_KEY?: string;
  MISTRAL_MODEL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_BASE_URL?: string;
  ANTHROPIC_API_KEY?: string;

  // Embedding Provider
  EMBEDDING_PROVIDER?: string;
  MISTRAL_EMBEDDING_MODEL?: string;

  // Context
  CONTEXT_OBSERVATION_LIMIT?: number;
  CONTEXT_SHOW_READ_TOKENS?: boolean;
  CONTEXT_SHOW_WORK_TOKENS?: boolean;

  // Workers
  MAX_WORKERS?: number;
  AUTO_SPAWN_WORKERS?: boolean;
  AUTO_SPAWN_WORKER_COUNT?: number;
  AUTO_SPAWN_PROVIDERS?: string;
  EMBEDDED_WORKER?: boolean;
  WORKER_AUTH_TOKEN?: string;
  WORKER_MODE?: string;
  IN_PROCESS_WORKER_TIMEOUT?: number;
  IN_PROCESS_WORKER_IDLE_EXIT?: number;

  // Worker Restart Policy
  WORKER_RESTART_POLICY?: string;
  WORKER_MAX_RESTARTS?: number;
  WORKER_RESTART_DELAY_MS?: number;
  WORKER_RESTART_BACKOFF_MULTIPLIER?: number;

  // Worker Capabilities
  DEFAULT_LLM_PROVIDER?: string;
  DEFAULT_EMBEDDING_PROVIDER?: string;
  DEFAULT_VECTORDB_PROVIDER?: string;
  WORKER_PROFILES?: string;
  CAPABILITY_LIMITS?: string;

  // Advanced
  BACKEND_PORT?: number;
  BACKEND_WS_PORT?: number;
  BACKEND_HOST?: string;
  BACKEND_BIND?: string;
  DATABASE_TYPE?: string;
  DATABASE_PATH?: string;
  DATABASE_HOST?: string;
  DATABASE_PORT?: number;
  DATABASE_USER?: string;
  DATABASE_PASSWORD?: string;
  DATABASE_NAME?: string;
  DATABASE_URL?: string;
  BATCH_SIZE?: number;

  // Vector Database
  VECTOR_DB?: string;
  VECTOR_DB_PATH?: string;
  EMBEDDING_MODEL?: string;

  // Retention
  RETENTION_ENABLED?: boolean;
  RETENTION_MAX_AGE_DAYS?: number;
  RETENTION_MAX_COUNT?: number;

  // Features - CLAUDE.md
  CLAUDEMD_ENABLED?: boolean;
  CLAUDEMD_OBSERVATION_INTERVAL?: number;
  CLAUDEMD_TASK_TIMEOUT?: number;
  CLAUDEMD_MAX_SUBDIRS?: number;

  // Features - Secret Detection
  SECRET_DETECTION_ENABLED?: boolean;
  SECRET_DETECTION_MODE?: string;

  // Remote Mode
  REMOTE_MODE?: boolean;
  REMOTE_URL?: string;
  REMOTE_TOKEN?: string;

  // Processing Mode
  PROCESSING_MODE?: string;
  LAZY_BATCH_INTERVAL?: number;
  LAZY_PROCESS_ON_SEARCH?: boolean;
  LAZY_HYBRID_TYPES?: string;

  // Sleep Agent
  SLEEP_AGENT_ENABLED?: boolean;
  SLEEP_AGENT_INTERVAL?: number;
  SLEEP_AGENT_IDLE_TIMEOUT?: number;

  // Endless Mode
  ENDLESS_MODE_ENABLED?: boolean;
  ENDLESS_MODE_COMPRESSION_MODEL?: string;
  ENDLESS_MODE_COMPRESSION_TIMEOUT?: number;
  ENDLESS_MODE_FALLBACK_ON_TIMEOUT?: boolean;
  ENDLESS_MODE_SKIP_SIMPLE_OUTPUTS?: boolean;
  ENDLESS_MODE_SIMPLE_OUTPUT_THRESHOLD?: number;

  // Cleanup Service
  CLEANUP_AUTO_ENABLED?: boolean;
  CLEANUP_INTERVAL_MS?: number;
  CLEANUP_STALE_TIMEOUT_MS?: number;
  CLEANUP_TASK_AGE_MS?: number;

  // Docker
  DOCKER_AUTO_UPDATE_ENABLED?: boolean;

  [key: string]: unknown;
}

export interface TabProps {
  settings: Settings;
  onChange: (key: string, value: unknown) => void;
  errors: Record<string, string>;
}

export interface ProviderConfig {
  id: string;
  name: string;
  modelKey: string;
  apiKeyKey: string;
  models: string[];
  hasBaseUrl?: boolean;
  baseUrlKey?: string;
}

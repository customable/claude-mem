/**
 * Settings Constants
 *
 * Shared constants for the Settings view.
 */

import type { SettingsTab, ValidationRule, ProviderConfig } from './types';

export const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'general', label: 'General', icon: 'ph--gear' },
  { id: 'provider', label: 'AI Provider', icon: 'ph--brain' },
  { id: 'context', label: 'Context', icon: 'ph--stack' },
  { id: 'workers', label: 'Workers', icon: 'ph--cpu' },
  { id: 'processing', label: 'Processing', icon: 'ph--lightning' },
  { id: 'advanced', label: 'Advanced', icon: 'ph--wrench' },
];

export const VALIDATION_RULES: Record<string, ValidationRule> = {
  BACKEND_PORT: {
    validate: (v) => {
      const num = Number(v);
      return !v || (Number.isInteger(num) && num >= 1 && num <= 65535);
    },
    message: 'Port must be between 1 and 65535',
  },
  DATABASE_PORT: {
    validate: (v) => {
      const num = Number(v);
      return !v || (Number.isInteger(num) && num >= 1 && num <= 65535);
    },
    message: 'Port must be between 1 and 65535',
  },
  MAX_WORKERS: {
    validate: (v) => {
      const num = Number(v);
      return !v || (Number.isInteger(num) && num >= 1 && num <= 100);
    },
    message: 'Max workers must be between 1 and 100',
  },
  CLAUDEMD_TASK_TIMEOUT: {
    validate: (v) => {
      const num = Number(v);
      return !v || (Number.isInteger(num) && num >= 1000);
    },
    message: 'Timeout must be at least 1000ms',
  },
  RETENTION_MAX_AGE_DAYS: {
    validate: (v) => {
      const num = Number(v);
      return !v || (Number.isInteger(num) && num >= 0);
    },
    message: 'Days must be 0 or greater',
  },
  RETENTION_MAX_COUNT: {
    validate: (v) => {
      const num = Number(v);
      return !v || (Number.isInteger(num) && num >= 0);
    },
    message: 'Count must be 0 or greater',
  },
  CONTEXT_OBSERVATION_LIMIT: {
    validate: (v) => {
      const num = Number(v);
      return !v || (Number.isInteger(num) && num >= 1 && num <= 500);
    },
    message: 'Limit must be between 1 and 500',
  },
  BATCH_SIZE: {
    validate: (v) => {
      const num = Number(v);
      return !v || (Number.isInteger(num) && num >= 1 && num <= 100);
    },
    message: 'Batch size must be between 1 and 100',
  },
};

export const CRITICAL_SETTINGS: Record<string, { title: string; message: string }> = {
  DATABASE_TYPE: {
    title: 'Change Database Type',
    message: 'Changing the database type requires a restart and may affect data accessibility. Are you sure?',
  },
  DATA_DIR: {
    title: 'Change Data Directory',
    message: 'Changing the data directory will create a new database. Existing data will remain in the old location. Are you sure?',
  },
  REMOTE_MODE: {
    title: 'Enable Remote Backend',
    message: 'Enabling remote mode will connect hooks to an external server. Make sure the remote URL and token are configured correctly. Continue?',
  },
};

export const ALL_PROVIDERS: ProviderConfig[] = [
  {
    id: 'mistral',
    name: 'Mistral AI',
    modelKey: 'MISTRAL_MODEL',
    apiKeyKey: 'MISTRAL_API_KEY',
    models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest', 'open-mistral-nemo'],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    modelKey: 'GEMINI_MODEL',
    apiKeyKey: 'GEMINI_API_KEY',
    models: ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    modelKey: 'OPENROUTER_MODEL',
    apiKeyKey: 'OPENROUTER_API_KEY',
    models: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-pro-1.5'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    modelKey: 'OPENAI_MODEL',
    apiKeyKey: 'OPENAI_API_KEY',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    hasBaseUrl: true,
    baseUrlKey: 'OPENAI_BASE_URL',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    modelKey: '',
    apiKeyKey: 'ANTHROPIC_API_KEY',
    models: [],
  },
];

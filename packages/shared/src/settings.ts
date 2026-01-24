/**
 * Settings Management for claude-mem
 *
 * Provides a type-safe, extensible configuration system.
 * Settings can come from:
 * 1. Default values
 * 2. Settings file (settings.json)
 * 3. Environment variables (highest priority)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

// ============================================
// Settings Schema
// ============================================

/**
 * All available settings with their types
 */
export interface Settings {
  // Backend Configuration
  BACKEND_PORT: number;
  BACKEND_WS_PORT: number;
  BACKEND_HOST: string;
  BACKEND_BIND: string;

  // Worker Configuration
  WORKER_AUTH_TOKEN: string;
  EMBEDDED_WORKER: boolean;
  MAX_WORKERS: number;
  AUTO_SPAWN_WORKERS: boolean;
  AUTO_SPAWN_WORKER_COUNT: number;
  AUTO_SPAWN_PROVIDERS: string; // Comma-separated list of providers to cycle through

  // AI Provider Configuration
  AI_PROVIDER: 'mistral' | 'gemini' | 'openrouter' | 'openai' | 'anthropic';
  ENABLED_PROVIDERS: string; // Comma-separated list of enabled providers (e.g., "mistral,gemini")
  MISTRAL_API_KEY: string;
  MISTRAL_MODEL: string;
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL: string;
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  OPENAI_BASE_URL: string;
  ANTHROPIC_API_KEY: string;

  // Database Configuration
  DATABASE_TYPE: 'sqlite' | 'postgres';
  DATABASE_PATH: string;  // For SQLite
  DATABASE_URL: string;   // For PostgreSQL
  DATABASE_BACKEND: 'sqlite' | 'mikro-orm';  // ORM backend
  DATABASE_HOST: string;   // For PostgreSQL/MySQL
  DATABASE_PORT: number;   // For PostgreSQL/MySQL
  DATABASE_USER: string;   // For PostgreSQL/MySQL
  DATABASE_PASSWORD: string; // For PostgreSQL/MySQL
  DATABASE_NAME: string;   // For PostgreSQL/MySQL

  // Vector Database Configuration
  VECTOR_DB: 'none' | 'qdrant';
  VECTOR_DB_PATH: string;
  EMBEDDING_MODEL: string;

  // Context Configuration
  CONTEXT_OBSERVATION_LIMIT: number;
  CONTEXT_SHOW_READ_TOKENS: boolean;
  CONTEXT_SHOW_WORK_TOKENS: boolean;

  // Logging
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';

  // Data Directory
  DATA_DIR: string;

  // Batch Processing
  BATCH_SIZE: number;

  // Remote Mode (for hooks connecting to remote backend)
  REMOTE_MODE: boolean;
  REMOTE_URL: string;
  REMOTE_TOKEN: string;

  // Retention Policy
  RETENTION_ENABLED: boolean;
  RETENTION_MAX_AGE_DAYS: number;
  RETENTION_MAX_COUNT: number;

  // CLAUDE.md Generation
  CLAUDEMD_ENABLED: boolean;
  CLAUDEMD_OBSERVATION_INTERVAL: number; // Generate CLAUDE.md after every N observations
  CLAUDEMD_TASK_TIMEOUT: number; // Timeout for claude-md tasks in ms (default: 10 min)
  CLAUDEMD_MAX_SUBDIRS: number; // Max subdirectories to generate per trigger (default: 5)
}

// ============================================
// Default Values
// ============================================

const DEFAULT_DATA_DIR = join(homedir(), '.claude-mem');

/**
 * Default settings values
 */
export const DEFAULTS: Settings = {
  // Backend Configuration
  BACKEND_PORT: 37777,
  BACKEND_WS_PORT: 37778,
  BACKEND_HOST: '127.0.0.1',
  BACKEND_BIND: '127.0.0.1',

  // Worker Configuration
  WORKER_AUTH_TOKEN: '',
  EMBEDDED_WORKER: true,
  MAX_WORKERS: 4,
  AUTO_SPAWN_WORKERS: false,
  AUTO_SPAWN_WORKER_COUNT: 2,
  AUTO_SPAWN_PROVIDERS: '', // Empty = use AI_PROVIDER for all

  // AI Provider Configuration
  AI_PROVIDER: 'mistral',
  ENABLED_PROVIDERS: '', // Empty = all configured providers are enabled
  MISTRAL_API_KEY: '',
  MISTRAL_MODEL: 'mistral-small-latest',
  GEMINI_API_KEY: '',
  GEMINI_MODEL: 'gemini-2.5-flash-lite',
  OPENROUTER_API_KEY: '',
  OPENROUTER_MODEL: 'xiaomi/mimo-v2-flash:free',
  OPENAI_API_KEY: '',
  OPENAI_MODEL: 'gpt-4o-mini',
  OPENAI_BASE_URL: '',
  ANTHROPIC_API_KEY: '',

  // Database Configuration
  DATABASE_TYPE: 'sqlite',
  DATABASE_PATH: join(DEFAULT_DATA_DIR, 'claude-mem.db'),
  DATABASE_URL: '',
  DATABASE_BACKEND: 'sqlite',
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: 5432,
  DATABASE_USER: '',
  DATABASE_PASSWORD: '',
  DATABASE_NAME: 'claude_mem',

  // Vector Database Configuration
  VECTOR_DB: 'none',
  VECTOR_DB_PATH: join(DEFAULT_DATA_DIR, 'vector-db'),
  EMBEDDING_MODEL: 'Xenova/all-MiniLM-L6-v2',

  // Context Configuration
  CONTEXT_OBSERVATION_LIMIT: 50,
  CONTEXT_SHOW_READ_TOKENS: true,
  CONTEXT_SHOW_WORK_TOKENS: true,

  // Logging
  LOG_LEVEL: 'info',

  // Data Directory
  DATA_DIR: DEFAULT_DATA_DIR,

  // Batch Processing
  BATCH_SIZE: 5,

  // Remote Mode
  REMOTE_MODE: false,
  REMOTE_URL: '',
  REMOTE_TOKEN: '',

  // Retention Policy
  RETENTION_ENABLED: false,
  RETENTION_MAX_AGE_DAYS: 0,
  RETENTION_MAX_COUNT: 0,

  // CLAUDE.md Generation
  CLAUDEMD_ENABLED: false,
  CLAUDEMD_OBSERVATION_INTERVAL: 10, // Generate CLAUDE.md after every 10 observations
  CLAUDEMD_TASK_TIMEOUT: 600000, // 10 minutes (longer than default 5min for AI generation)
  CLAUDEMD_MAX_SUBDIRS: 5, // Max 5 subdirectories per generation trigger
};

// ============================================
// Type Helpers
// ============================================

type SettingKey = keyof Settings;
type SettingValue<K extends SettingKey> = Settings[K];

/**
 * Keys that are boolean type
 */
const BOOLEAN_KEYS: SettingKey[] = [
  'EMBEDDED_WORKER',
  'AUTO_SPAWN_WORKERS',
  'CONTEXT_SHOW_READ_TOKENS',
  'CONTEXT_SHOW_WORK_TOKENS',
  'REMOTE_MODE',
  'RETENTION_ENABLED',
  'CLAUDEMD_ENABLED',
];

/**
 * Keys that are number type
 */
const NUMBER_KEYS: SettingKey[] = [
  'BACKEND_PORT',
  'BACKEND_WS_PORT',
  'MAX_WORKERS',
  'AUTO_SPAWN_WORKER_COUNT',
  'CONTEXT_OBSERVATION_LIMIT',
  'BATCH_SIZE',
  'RETENTION_MAX_AGE_DAYS',
  'RETENTION_MAX_COUNT',
  'DATABASE_PORT',
  'CLAUDEMD_OBSERVATION_INTERVAL',
  'CLAUDEMD_TASK_TIMEOUT',
  'CLAUDEMD_MAX_SUBDIRS',
];

// ============================================
// Settings Manager
// ============================================

/**
 * Settings Manager class
 *
 * Loads settings from file and environment variables.
 * Environment variables have highest priority.
 */
export class SettingsManager {
  private settings: Settings;
  private readonly settingsPath: string;

  constructor(settingsPath?: string) {
    this.settingsPath = settingsPath || join(DEFAULT_DATA_DIR, 'settings.json');
    this.settings = this.loadSettings();
  }

  /**
   * Load settings from file, merging with defaults and env vars
   */
  private loadSettings(): Settings {
    let fileSettings: Partial<Settings> = {};

    // Try to load from file
    try {
      if (existsSync(this.settingsPath)) {
        const data = readFileSync(this.settingsPath, 'utf-8');
        const parsed = JSON.parse(data);

        // Handle legacy nested schema { env: {...} }
        if (parsed.env && typeof parsed.env === 'object') {
          fileSettings = this.migrateLegacySettings(parsed.env);
        } else {
          // Also migrate root-level legacy keys (CLAUDE_MEM_* prefix)
          fileSettings = this.migrateLegacySettings(parsed);
        }
      }
    } catch (error) {
      console.warn('[Settings] Failed to load settings file:', error);
    }

    // Merge: defaults < file < env
    const merged = { ...DEFAULTS };

    // Apply file settings
    for (const key of Object.keys(fileSettings) as SettingKey[]) {
      if (key in DEFAULTS) {
        (merged as Record<string, unknown>)[key] = this.parseValue(
          key,
          fileSettings[key]
        );
      }
    }

    // Apply environment variables (prefix: CLAUDE_MEM_)
    for (const key of Object.keys(DEFAULTS) as SettingKey[]) {
      const envKey = `CLAUDE_MEM_${key}`;
      const envValue = process.env[envKey];
      if (envValue !== undefined) {
        (merged as Record<string, unknown>)[key] = this.parseValue(key, envValue);
      }
    }

    return merged;
  }

  /**
   * Parse a value to its correct type
   */
  private parseValue(key: SettingKey, value: unknown): unknown {
    if (value === undefined || value === null) {
      return DEFAULTS[key];
    }

    if (BOOLEAN_KEYS.includes(key)) {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') return value.toLowerCase() === 'true';
      return Boolean(value);
    }

    if (NUMBER_KEYS.includes(key)) {
      if (typeof value === 'number') return value;
      const num = parseInt(String(value), 10);
      return isNaN(num) ? DEFAULTS[key] : num;
    }

    return value;
  }

  /**
   * Migrate legacy setting keys to new format
   */
  private migrateLegacySettings(
    legacy: Record<string, unknown>
  ): Partial<Settings> {
    const migrated: Partial<Settings> = {};

    // Map old keys to new keys
    const keyMap: Record<string, SettingKey> = {
      CLAUDE_MEM_WORKER_PORT: 'BACKEND_PORT',
      CLAUDE_MEM_WORKER_HOST: 'BACKEND_HOST',
      CLAUDE_MEM_WORKER_BIND: 'BACKEND_BIND',
      CLAUDE_MEM_PROVIDER: 'AI_PROVIDER',
      CLAUDE_MEM_MISTRAL_API_KEY: 'MISTRAL_API_KEY',
      CLAUDE_MEM_MISTRAL_MODEL: 'MISTRAL_MODEL',
      CLAUDE_MEM_GEMINI_API_KEY: 'GEMINI_API_KEY',
      CLAUDE_MEM_GEMINI_MODEL: 'GEMINI_MODEL',
      CLAUDE_MEM_OPENROUTER_API_KEY: 'OPENROUTER_API_KEY',
      CLAUDE_MEM_OPENROUTER_MODEL: 'OPENROUTER_MODEL',
      CLAUDE_MEM_OPENAI_API_KEY: 'OPENAI_API_KEY',
      CLAUDE_MEM_OPENAI_MODEL: 'OPENAI_MODEL',
      CLAUDE_MEM_OPENAI_BASE_URL: 'OPENAI_BASE_URL',
      CLAUDE_MEM_DATA_DIR: 'DATA_DIR',
      CLAUDE_MEM_LOG_LEVEL: 'LOG_LEVEL',
      CLAUDE_MEM_VECTOR_DB: 'VECTOR_DB',
      CLAUDE_MEM_EMBEDDING_MODEL: 'EMBEDDING_MODEL',
      CLAUDE_MEM_CONTEXT_OBSERVATIONS: 'CONTEXT_OBSERVATION_LIMIT',
      CLAUDE_MEM_BATCH_SIZE: 'BATCH_SIZE',
      CLAUDE_MEM_REMOTE_MODE: 'REMOTE_MODE',
      CLAUDE_MEM_REMOTE_URL: 'REMOTE_URL',
      CLAUDE_MEM_REMOTE_TOKEN: 'REMOTE_TOKEN',
    };

    for (const [oldKey, newKey] of Object.entries(keyMap)) {
      if (legacy[oldKey] !== undefined) {
        (migrated as Record<string, unknown>)[newKey] = legacy[oldKey];
      }
    }

    // Also check for new-style keys
    for (const key of Object.keys(legacy)) {
      if (key in DEFAULTS) {
        (migrated as Record<string, unknown>)[key] = legacy[key];
      }
    }

    return migrated;
  }

  /**
   * Get a setting value
   */
  get<K extends SettingKey>(key: K): SettingValue<K> {
    return this.settings[key];
  }

  /**
   * Get all settings
   */
  getAll(): Settings {
    return { ...this.settings };
  }

  /**
   * Update settings (in memory only)
   */
  set<K extends SettingKey>(key: K, value: SettingValue<K>): void {
    this.settings[key] = value;
  }

  /**
   * Save current settings to file
   */
  save(): void {
    try {
      const dir = dirname(this.settingsPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(
        this.settingsPath,
        JSON.stringify(this.settings, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('[Settings] Failed to save settings:', error);
      throw error;
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

let _instance: SettingsManager | null = null;

/**
 * Get the global settings manager instance
 */
export function getSettings(): SettingsManager {
  if (!_instance) {
    _instance = new SettingsManager();
  }
  return _instance;
}

/**
 * Load settings and return the settings object
 * Convenience function for quick access to all settings
 */
export function loadSettings(): Settings {
  return getSettings().getAll();
}

/**
 * Save settings to file
 * Convenience function for updating and persisting settings
 */
export function saveSettings(settings: Partial<Settings>): void {
  const manager = getSettings();
  for (const [key, value] of Object.entries(settings)) {
    if (key in DEFAULTS) {
      manager.set(key as keyof Settings, value as Settings[keyof Settings]);
    }
  }
  manager.save();
}

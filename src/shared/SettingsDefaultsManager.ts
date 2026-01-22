/**
 * SettingsDefaultsManager
 *
 * Single source of truth for all default configuration values.
 * Provides methods to get defaults with optional environment variable overrides.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { DEFAULT_OBSERVATION_TYPES_STRING, DEFAULT_OBSERVATION_CONCEPTS_STRING } from '../constants/observation-metadata.js';
// NOTE: Do NOT import logger here - it creates a circular dependency
// logger.ts depends on SettingsDefaultsManager for its initialization

export interface SettingsDefaults {
  CLAUDE_MEM_MODEL: string;
  CLAUDE_MEM_CONTEXT_OBSERVATIONS: string;
  CLAUDE_MEM_WORKER_PORT: string;
  CLAUDE_MEM_WORKER_HOST: string;
  CLAUDE_MEM_WORKER_BIND: string;  // Server bind address (0.0.0.0 for network access)
  CLAUDE_MEM_SKIP_TOOLS: string;
  // AI Provider Configuration
  CLAUDE_MEM_PROVIDER: string;  // 'claude' | 'gemini' | 'openrouter' | 'mistral'
  CLAUDE_MEM_GEMINI_API_KEY: string;
  CLAUDE_MEM_GEMINI_MODEL: string;  // 'gemini-2.5-flash-lite' | 'gemini-2.5-flash' | 'gemini-3-flash'
  CLAUDE_MEM_GEMINI_RATE_LIMITING_ENABLED: boolean;  // Enable rate limiting for free tier
  CLAUDE_MEM_OPENROUTER_API_KEY: string;
  CLAUDE_MEM_OPENROUTER_MODEL: string;
  CLAUDE_MEM_OPENROUTER_SITE_URL: string;
  CLAUDE_MEM_OPENROUTER_APP_NAME: string;
  CLAUDE_MEM_OPENROUTER_MAX_CONTEXT_MESSAGES: string;
  CLAUDE_MEM_OPENROUTER_MAX_TOKENS: string;
  CLAUDE_MEM_MISTRAL_API_KEY: string;
  CLAUDE_MEM_MISTRAL_MODEL: string;  // 'mistral-small-latest' | 'mistral-medium-latest' | 'mistral-large-latest'
  // System Configuration
  CLAUDE_MEM_DATA_DIR: string;
  CLAUDE_MEM_LOG_LEVEL: string;
  CLAUDE_MEM_PYTHON_VERSION: string;
  CLAUDE_CODE_PATH: string;
  CLAUDE_MEM_MODE: string;
  // Token Economics
  CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS: boolean;
  CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS: boolean;
  CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT: boolean;
  CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT: boolean;
  // Observation Filtering
  CLAUDE_MEM_CONTEXT_OBSERVATION_TYPES: string;
  CLAUDE_MEM_CONTEXT_OBSERVATION_CONCEPTS: string;
  // Display Configuration
  CLAUDE_MEM_CONTEXT_FULL_COUNT: string;
  CLAUDE_MEM_CONTEXT_FULL_FIELD: string;
  CLAUDE_MEM_CONTEXT_SESSION_COUNT: string;
  // Feature Toggles
  CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY: boolean;
  CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE: boolean;
  // Folder CLAUDE.md Generation
  CLAUDE_MEM_FOLDER_CLAUDEMD_ENABLED: boolean;  // Enable/disable folder CLAUDE.md generation
  CLAUDE_MEM_FOLDER_MD_EXCLUDE: string;  // JSON array of folder paths to exclude from CLAUDE.md generation
  // Vector Database Configuration
  CLAUDE_MEM_CHROMA_ENABLED: boolean;  // Disable Chroma to save RAM/avoid zombie processes (auto-disabled on Windows)
  CLAUDE_MEM_VECTOR_DB: string;  // 'chroma' | 'qdrant' | 'none' (disabled)
  CLAUDE_MEM_EMBEDDING_MODEL: string;  // Embedding model for Qdrant (e.g., 'Xenova/all-MiniLM-L6-v2')
  // Project Exclusion
  CLAUDE_MEM_EXCLUDE_PROJECTS: string;  // JSON array of glob patterns to exclude projects (e.g., '["temp-*", "test-?"]')
}

export class SettingsDefaultsManager {
  /**
   * Default values for all settings
   */
  private static readonly DEFAULTS: SettingsDefaults = {
    CLAUDE_MEM_MODEL: 'claude-sonnet-4-5',
    CLAUDE_MEM_CONTEXT_OBSERVATIONS: '50',
    CLAUDE_MEM_WORKER_PORT: '37777',
    CLAUDE_MEM_WORKER_HOST: '127.0.0.1',
    CLAUDE_MEM_WORKER_BIND: '127.0.0.1',  // Default to localhost, set to 0.0.0.0 for network access
    CLAUDE_MEM_SKIP_TOOLS: 'ListMcpResourcesTool,SlashCommand,Skill,TodoWrite,AskUserQuestion',
    // AI Provider Configuration
    CLAUDE_MEM_PROVIDER: 'claude',  // Default to Claude
    CLAUDE_MEM_GEMINI_API_KEY: '',  // Empty by default, can be set via UI or env
    CLAUDE_MEM_GEMINI_MODEL: 'gemini-2.5-flash-lite',  // Default Gemini model (highest free tier RPM)
    CLAUDE_MEM_GEMINI_RATE_LIMITING_ENABLED: true,  // Rate limiting ON by default for free tier users
    CLAUDE_MEM_OPENROUTER_API_KEY: '',  // Empty by default, can be set via UI or env
    CLAUDE_MEM_OPENROUTER_MODEL: 'xiaomi/mimo-v2-flash:free',  // Default OpenRouter model (free tier)
    CLAUDE_MEM_OPENROUTER_SITE_URL: '',  // Optional: for OpenRouter analytics
    CLAUDE_MEM_OPENROUTER_APP_NAME: 'claude-mem',  // App name for OpenRouter analytics
    CLAUDE_MEM_OPENROUTER_MAX_CONTEXT_MESSAGES: '20',  // Max messages in context window
    CLAUDE_MEM_OPENROUTER_MAX_TOKENS: '100000',  // Max estimated tokens (~100k safety limit)
    CLAUDE_MEM_MISTRAL_API_KEY: '',  // Empty by default, can be set via UI or env
    CLAUDE_MEM_MISTRAL_MODEL: 'mistral-small-latest',  // Default Mistral model (cost-effective)
    // System Configuration
    CLAUDE_MEM_DATA_DIR: join(homedir(), '.claude-mem'),
    CLAUDE_MEM_LOG_LEVEL: 'INFO',
    CLAUDE_MEM_PYTHON_VERSION: '3.13',
    CLAUDE_CODE_PATH: '', // Empty means auto-detect via 'which claude'
    CLAUDE_MEM_MODE: 'code', // Default mode profile
    // Token Economics
    CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS: true,
    CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS: true,
    CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT: true,
    CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT: true,
    // Observation Filtering
    CLAUDE_MEM_CONTEXT_OBSERVATION_TYPES: DEFAULT_OBSERVATION_TYPES_STRING,
    CLAUDE_MEM_CONTEXT_OBSERVATION_CONCEPTS: DEFAULT_OBSERVATION_CONCEPTS_STRING,
    // Display Configuration
    CLAUDE_MEM_CONTEXT_FULL_COUNT: '5',
    CLAUDE_MEM_CONTEXT_FULL_FIELD: 'narrative',
    CLAUDE_MEM_CONTEXT_SESSION_COUNT: '10',
    // Feature Toggles
    CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY: true,
    CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE: false,
    // Folder CLAUDE.md Generation
    CLAUDE_MEM_FOLDER_CLAUDEMD_ENABLED: false,  // Disabled by default to avoid codebase pollution
    CLAUDE_MEM_FOLDER_MD_EXCLUDE: '[]',  // Empty array by default
    // Vector Database Configuration
    CLAUDE_MEM_CHROMA_ENABLED: true,  // Enabled by default for semantic search
    CLAUDE_MEM_VECTOR_DB: 'chroma',  // Default to ChromaDB for backward compatibility
    CLAUDE_MEM_EMBEDDING_MODEL: 'Xenova/all-MiniLM-L6-v2',  // Default embedding model for Qdrant
    // Project Exclusion
    CLAUDE_MEM_EXCLUDE_PROJECTS: '[]',  // Empty array by default - no projects excluded
  };

  /**
   * Get all defaults as an object
   */
  static getAllDefaults(): SettingsDefaults {
    return { ...this.DEFAULTS };
  }

  /**
   * Get a default value from defaults (no environment variable override)
   */
  static get(key: keyof SettingsDefaults): string {
    return this.DEFAULTS[key];
  }

  /**
   * Get an integer default value
   */
  static getInt(key: keyof SettingsDefaults): number {
    const value = this.get(key);
    return parseInt(value, 10);
  }

  /**
   * Get a boolean default value
   */
  static getBool(key: keyof SettingsDefaults): boolean {
    const value = this.get(key);
    return value === 'true';
  }

  /**
   * Load settings from file with fallback to defaults
   * Returns merged settings with defaults as fallback
   * Handles all errors (missing file, corrupted JSON, permissions) by returning defaults
   */
  static loadFromFile(settingsPath: string): SettingsDefaults {
    try {
      if (!existsSync(settingsPath)) {
        const defaults = this.getAllDefaults();
        try {
          const dir = dirname(settingsPath);
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
          }
          writeFileSync(settingsPath, JSON.stringify(defaults, null, 2), 'utf-8');
          // Use console instead of logger to avoid circular dependency
          console.log('[SETTINGS] Created settings file with defaults:', settingsPath);
        } catch (error) {
          console.warn('[SETTINGS] Failed to create settings file, using in-memory defaults:', settingsPath, error);
        }
        return defaults;
      }

      const settingsData = readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(settingsData);

      // MIGRATION: Handle old nested schema { env: {...} }
      let flatSettings = settings;
      if (settings.env && typeof settings.env === 'object') {
        // Migrate from nested to flat schema
        flatSettings = settings.env;

        // Auto-migrate the file to flat schema
        try {
          writeFileSync(settingsPath, JSON.stringify(flatSettings, null, 2), 'utf-8');
          console.log('[SETTINGS] Migrated settings file from nested to flat schema:', settingsPath);
        } catch (error) {
          console.warn('[SETTINGS] Failed to auto-migrate settings file:', settingsPath, error);
          // Continue with in-memory migration even if write fails
        }
      }

      // Boolean settings that need migration from string to actual boolean
      const BOOLEAN_SETTINGS: Array<keyof SettingsDefaults> = [
        'CLAUDE_MEM_GEMINI_RATE_LIMITING_ENABLED',
        'CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS',
        'CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS',
        'CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT',
        'CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT',
        'CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY',
        'CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE',
        'CLAUDE_MEM_FOLDER_CLAUDEMD_ENABLED',
        'CLAUDE_MEM_CHROMA_ENABLED',
      ];

      // Merge file settings with defaults (flat schema)
      const result: SettingsDefaults = { ...this.DEFAULTS };
      let needsMigration = false;

      for (const key of Object.keys(this.DEFAULTS) as Array<keyof SettingsDefaults>) {
        if (flatSettings[key] !== undefined) {
          // Handle boolean migration from string to actual boolean
          if (BOOLEAN_SETTINGS.includes(key)) {
            const value = flatSettings[key];
            if (typeof value === 'string') {
              // Migrate string 'true'/'false' to actual boolean
              (result as Record<string, unknown>)[key] = value === 'true';
              needsMigration = true;
            } else {
              (result as Record<string, unknown>)[key] = value;
            }
          } else {
            (result as Record<string, unknown>)[key] = flatSettings[key];
          }
        }
      }

      // Auto-migrate settings file if needed
      if (needsMigration) {
        try {
          writeFileSync(settingsPath, JSON.stringify(result, null, 2), 'utf-8');
          console.log('[SETTINGS] Migrated boolean settings from strings to actual booleans:', settingsPath);
        } catch (error) {
          console.warn('[SETTINGS] Failed to auto-migrate boolean settings:', settingsPath, error);
        }
      }

      return result;
    } catch (error) {
      console.warn('[SETTINGS] Failed to load settings, using defaults:', settingsPath, error);
      return this.getAllDefaults();
    }
  }
}

/**
 * Plugin System Types
 *
 * Types for custom plugin processors that can modify observations
 * before/after storage or react to events.
 */

import type { ObservationRecord, SessionSummaryRecord, ObservationType } from './database.js';

/**
 * Plugin lifecycle hooks
 */
export interface PluginHooks {
  /**
   * Called before an observation is stored.
   * Can modify or filter the observation.
   * Return null to prevent storage.
   */
  onBeforeObservation?(observation: ObservationInput): ObservationInput | null | Promise<ObservationInput | null>;

  /**
   * Called after an observation is stored.
   * Good for notifications, exports, etc.
   */
  onAfterObservation?(observation: ObservationRecord): void | Promise<void>;

  /**
   * Called when a session summary is created.
   */
  onSummary?(summary: SessionSummaryRecord): void | Promise<void>;

  /**
   * Called when the plugin is loaded.
   */
  onLoad?(): void | Promise<void>;

  /**
   * Called when the plugin is unloaded.
   */
  onUnload?(): void | Promise<void>;
}

/**
 * Input for observation hook (before ID is assigned)
 */
export interface ObservationInput {
  memorySessionId: string;
  project: string;
  text: string;
  type: ObservationType;
  title?: string;
  subtitle?: string;
  concepts?: string;
  facts?: string;
  narrative?: string;
  filesRead?: string;
  filesModified?: string;
  promptNumber?: number;
  discoveryTokens?: number;
  gitBranch?: string;
  cwd?: string;
  repoPath?: string;
  decisionCategory?: string;
}

/**
 * Plugin configuration
 */
export interface PluginConfig {
  /** Plugin is enabled */
  enabled: boolean;
  /** Plugin-specific settings */
  settings?: Record<string, unknown>;
}

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  /** Plugin unique identifier */
  name: string;
  /** Human-readable display name */
  displayName?: string;
  /** Plugin version */
  version: string;
  /** Plugin description */
  description?: string;
  /** Plugin author */
  author?: string;
  /** Types of observations this plugin handles (empty = all) */
  observationTypes?: ObservationType[];
  /** Projects this plugin applies to (empty = all) */
  projects?: string[];
}

/**
 * Complete plugin definition
 */
export interface Plugin extends PluginHooks {
  /** Plugin metadata */
  metadata: PluginMetadata;
}

/**
 * Registered plugin with runtime state
 */
export interface RegisteredPlugin {
  /** Plugin instance */
  plugin: Plugin;
  /** Runtime configuration */
  config: PluginConfig;
  /** Load timestamp */
  loadedAt: number;
  /** Error if plugin failed to load */
  error?: string;
}

/**
 * Plugin registry record for persistence
 */
export interface PluginRegistryRecord {
  name: string;
  displayName?: string;
  version: string;
  description?: string;
  author?: string;
  enabled: boolean;
  settings: string; // JSON
  loadPath: string;
  observationTypes?: string; // JSON array
  projects?: string; // JSON array
  createdAt: string;
  createdAtEpoch: number;
  updatedAt?: string;
  updatedAtEpoch?: number;
}

/**
 * Plugin manager interface
 */
export interface IPluginManager {
  /**
   * Load all plugins from plugin directory
   */
  loadPlugins(): Promise<void>;

  /**
   * Register a plugin
   */
  registerPlugin(plugin: Plugin, config?: Partial<PluginConfig>): void;

  /**
   * Unregister a plugin
   */
  unregisterPlugin(name: string): void;

  /**
   * Get registered plugin
   */
  getPlugin(name: string): RegisteredPlugin | undefined;

  /**
   * Get all registered plugins
   */
  getAllPlugins(): RegisteredPlugin[];

  /**
   * Enable/disable a plugin
   */
  setPluginEnabled(name: string, enabled: boolean): void;

  /**
   * Update plugin settings
   */
  updatePluginSettings(name: string, settings: Record<string, unknown>): void;

  /**
   * Run pre-observation hooks
   */
  runBeforeObservation(observation: ObservationInput): Promise<ObservationInput | null>;

  /**
   * Run post-observation hooks
   */
  runAfterObservation(observation: ObservationRecord): Promise<void>;

  /**
   * Run summary hooks
   */
  runSummaryHooks(summary: SessionSummaryRecord): Promise<void>;
}

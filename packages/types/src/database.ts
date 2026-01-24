/**
 * Database model types for claude-mem
 * Used by @claude-mem/database and consumers
 */

/**
 * Observation types - granular categorization of work
 */
export type ObservationType =
  // Work Types (changes to the codebase)
  | 'bugfix'           // Something was broken, now fixed
  | 'feature'          // New capability or functionality added
  | 'refactor'         // Code restructured, behavior unchanged
  | 'change'           // Generic modification
  // Documentation & Config
  | 'docs'             // Documentation changes (README, comments, guides)
  | 'config'           // Configuration/environment changes
  // Quality & Testing
  | 'test'             // Test implementation, coverage improvements
  | 'security'         // Security fixes, vulnerability patches
  | 'performance'      // Optimization, profiling, speed improvements
  // Infrastructure
  | 'deploy'           // CI/CD, release, deployment changes
  | 'infra'            // Infrastructure, DevOps, cloud resources
  | 'migration'        // Database migrations, data transforms
  // Knowledge Types
  | 'discovery'        // Learning about existing system
  | 'decision'         // Architectural/design choice with rationale
  | 'research'         // Investigation, analysis, exploration
  // Integration
  | 'api'              // API changes, endpoint modifications
  | 'integration'      // Third-party service integration
  | 'dependency'       // Package updates, dependency changes
  // Planning & Tasks
  | 'task'             // Todo item, planned work
  | 'plan'             // Implementation plan, roadmap
  // Manual Memory
  | 'note'             // Manual note or bookmark saved via MCP
  // Session
  | 'session-request'; // User prompt/request tracking

/**
 * Observation type metadata for UI rendering
 */
export interface ObservationTypeConfig {
  id: ObservationType;
  label: string;
  description: string;
  emoji: string;
  icon: string;        // Phosphor icon class
  color: string;       // Tailwind color class
  workEmoji: string;   // Emoji for work indicator
}

/**
 * Session status
 */
export type SessionStatus = 'active' | 'completed' | 'failed';

/**
 * Memory tier for Sleep Agent
 */
export type MemoryTier = 'core' | 'working' | 'archive' | 'ephemeral';

/**
 * SDK Session database record
 */
export interface SdkSessionRecord {
  id: number;
  content_session_id: string;
  memory_session_id: string | null;
  project: string;
  user_prompt: string | null;
  working_directory: string | null;
  started_at: string;
  started_at_epoch: number;
  completed_at: string | null;
  completed_at_epoch: number | null;
  status: SessionStatus;
  worker_port?: number;
  prompt_counter?: number;
  // Git worktree support
  repo_path?: string | null;
  is_worktree?: boolean;
  branch?: string | null;
}

/**
 * Observation database record
 */
export interface ObservationRecord {
  id: number;
  memory_session_id: string;
  project: string;
  text: string | null;
  type: ObservationType;
  created_at: string;
  created_at_epoch: number;
  title?: string;
  subtitle?: string;
  narrative?: string;
  concept?: string;
  concepts?: string;
  facts?: string;
  source_files?: string;
  files_read?: string;
  files_modified?: string;
  git_branch?: string;
  cwd?: string;
  prompt_number?: number;
  discovery_tokens?: number;
  // Git worktree support
  repo_path?: string;
  // Decision tracking
  decision_category?: string;
  superseded_by?: number;
  supersedes?: number;
  superseded_at?: string;
  // Memory tiering (Sleep Agent)
  memory_tier?: MemoryTier;
  tier_changed_at?: string;
  access_count?: number;
  last_accessed_at?: string;
  last_accessed_at_epoch?: number;
  consolidation_score?: number;
  // Importance scoring
  pinned?: boolean;
  importance_boost?: number;
}

/**
 * Link types for observation relationships
 */
export type ObservationLinkType =
  | 'related'      // General relationship
  | 'depends_on'   // This observation depends on another
  | 'blocks'       // This observation blocks another
  | 'references'   // References another observation
  | 'supersedes'   // Newer version of an observation
  | 'similar'      // Similar content or topic
  | 'contradicts'  // Contradicting information
  | 'extends';     // Extends or builds upon another

/**
 * Observation link database record
 */
export interface ObservationLinkRecord {
  id: number;
  source_id: number;
  target_id: number;
  link_type: ObservationLinkType;
  description?: string;
  created_at: string;
  created_at_epoch: number;
}

/**
 * Observation template database record
 */
export interface ObservationTemplateRecord {
  id: number;
  name: string;
  description?: string;
  type: ObservationType;
  project?: string;
  fields: string; // JSON string of template fields
  is_default?: boolean;
  is_system?: boolean;
  created_at: string;
  created_at_epoch: number;
  updated_at?: string;
  updated_at_epoch?: number;
}

/**
 * Parsed template fields structure
 */
export interface TemplateFields {
  [key: string]: string | string[] | boolean | number | undefined;
}

/**
 * Project settings database record
 */
export interface ProjectSettingsRecord {
  id: number;
  project: string;
  display_name?: string;
  description?: string;
  settings: string; // JSON string
  metadata: string; // JSON string
  observation_count?: number;
  session_count?: number;
  last_activity_epoch?: number;
  created_at: string;
  created_at_epoch: number;
  updated_at?: string;
  updated_at_epoch?: number;
}

/**
 * Parsed project settings structure
 */
export interface ProjectSettingsData {
  // Observation processing settings
  autoGenerateClaudeMd?: boolean;
  claudeMdInterval?: number;
  // Memory tier settings
  defaultTier?: MemoryTier;
  autoArchiveDays?: number;
  // Display preferences
  theme?: string;
  showTokens?: boolean;
  // Custom settings
  [key: string]: unknown;
}

/**
 * Session Summary database record
 */
export interface SessionSummaryRecord {
  id: number;
  memory_session_id: string;
  project: string;
  request: string | null;
  investigated: string | null;
  learned: string | null;
  completed: string | null;
  next_steps: string | null;
  created_at: string;
  created_at_epoch: number;
  prompt_number?: number;
  discovery_tokens?: number;
}

/**
 * User Prompt database record
 */
export interface UserPromptRecord {
  id: number;
  content_session_id: string;
  prompt_number: number;
  prompt_text: string;
  project?: string;
  created_at: string;
  created_at_epoch: number;
}

/**
 * Document types - categorization of stored documentation
 */
export type DocumentType =
  | 'library-docs'   // API/library documentation (Context7)
  | 'web-content'    // Captured web pages
  | 'api-reference'  // API reference documentation
  | 'code-example'   // Code snippets and examples
  | 'tutorial'       // Tutorial content
  | 'custom';        // User-uploaded or custom content

/**
 * Document database record - stores MCP documentation lookups
 */
export interface DocumentRecord {
  id: number;
  project: string;
  source: string;               // Library ID, URL, or identifier
  source_tool: string;          // MCP tool that captured this (e.g., mcp__context7__query-docs)
  title: string | null;
  content: string;              // Full documentation text
  content_hash: string;         // SHA256 hash for deduplication
  type: DocumentType;
  metadata: string | null;      // JSON: { language, framework, version, query, etc. }
  memory_session_id: string | null;
  observation_id: number | null;
  access_count: number;
  last_accessed_epoch: number;
  created_at: string;
  created_at_epoch: number;
}

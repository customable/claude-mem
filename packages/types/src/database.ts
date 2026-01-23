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
 * Complete observation type configuration
 */
export const OBSERVATION_TYPES: Record<ObservationType, ObservationTypeConfig> = {
  // Work Types
  bugfix: {
    id: 'bugfix',
    label: 'Bug Fix',
    description: 'Something was broken, now fixed',
    emoji: '🔴',
    icon: 'ph--bug',
    color: 'text-error',
    workEmoji: '🛠️',
  },
  feature: {
    id: 'feature',
    label: 'Feature',
    description: 'New capability or functionality added',
    emoji: '🟣',
    icon: 'ph--star',
    color: 'text-secondary',
    workEmoji: '🛠️',
  },
  refactor: {
    id: 'refactor',
    label: 'Refactor',
    description: 'Code restructured, behavior unchanged',
    emoji: '🔄',
    icon: 'ph--arrows-clockwise',
    color: 'text-info',
    workEmoji: '🛠️',
  },
  change: {
    id: 'change',
    label: 'Change',
    description: 'Generic modification',
    emoji: '✅',
    icon: 'ph--check-circle',
    color: 'text-success',
    workEmoji: '🛠️',
  },
  // Documentation & Config
  docs: {
    id: 'docs',
    label: 'Documentation',
    description: 'Documentation changes (README, comments, guides)',
    emoji: '📝',
    icon: 'ph--file-text',
    color: 'text-base-content',
    workEmoji: '📝',
  },
  config: {
    id: 'config',
    label: 'Config',
    description: 'Configuration/environment changes',
    emoji: '⚙️',
    icon: 'ph--gear',
    color: 'text-base-content/80',
    workEmoji: '🛠️',
  },
  // Quality & Testing
  test: {
    id: 'test',
    label: 'Test',
    description: 'Test implementation, coverage improvements',
    emoji: '🧪',
    icon: 'ph--test-tube',
    color: 'text-accent',
    workEmoji: '🧪',
  },
  security: {
    id: 'security',
    label: 'Security',
    description: 'Security fixes, vulnerability patches',
    emoji: '🔒',
    icon: 'ph--shield-check',
    color: 'text-error',
    workEmoji: '🔒',
  },
  performance: {
    id: 'performance',
    label: 'Performance',
    description: 'Optimization, profiling, speed improvements',
    emoji: '⚡',
    icon: 'ph--lightning',
    color: 'text-warning',
    workEmoji: '⚡',
  },
  // Infrastructure
  deploy: {
    id: 'deploy',
    label: 'Deployment',
    description: 'CI/CD, release, deployment changes',
    emoji: '🚀',
    icon: 'ph--rocket-launch',
    color: 'text-primary',
    workEmoji: '🚀',
  },
  infra: {
    id: 'infra',
    label: 'Infrastructure',
    description: 'Infrastructure, DevOps, cloud resources',
    emoji: '🏗️',
    icon: 'ph--buildings',
    color: 'text-neutral',
    workEmoji: '🏗️',
  },
  migration: {
    id: 'migration',
    label: 'Migration',
    description: 'Database migrations, data transforms',
    emoji: '🔀',
    icon: 'ph--database',
    color: 'text-info',
    workEmoji: '🔀',
  },
  // Knowledge Types
  discovery: {
    id: 'discovery',
    label: 'Discovery',
    description: 'Learning about existing system',
    emoji: '🔵',
    icon: 'ph--magnifying-glass',
    color: 'text-primary',
    workEmoji: '🔍',
  },
  decision: {
    id: 'decision',
    label: 'Decision',
    description: 'Architectural/design choice with rationale',
    emoji: '⚖️',
    icon: 'ph--scales',
    color: 'text-warning',
    workEmoji: '⚖️',
  },
  research: {
    id: 'research',
    label: 'Research',
    description: 'Investigation, analysis, exploration',
    emoji: '🔬',
    icon: 'ph--flask',
    color: 'text-primary',
    workEmoji: '🔍',
  },
  // Integration
  api: {
    id: 'api',
    label: 'API',
    description: 'API changes, endpoint modifications',
    emoji: '🔌',
    icon: 'ph--plugs-connected',
    color: 'text-secondary',
    workEmoji: '🛠️',
  },
  integration: {
    id: 'integration',
    label: 'Integration',
    description: 'Third-party service integration',
    emoji: '🔗',
    icon: 'ph--link',
    color: 'text-accent',
    workEmoji: '🛠️',
  },
  dependency: {
    id: 'dependency',
    label: 'Dependency',
    description: 'Package updates, dependency changes',
    emoji: '📦',
    icon: 'ph--package',
    color: 'text-base-content/70',
    workEmoji: '📦',
  },
  // Planning & Tasks
  task: {
    id: 'task',
    label: 'Task',
    description: 'Todo item, planned work',
    emoji: '☑️',
    icon: 'ph--check-square',
    color: 'text-accent',
    workEmoji: '☑️',
  },
  plan: {
    id: 'plan',
    label: 'Plan',
    description: 'Implementation plan, roadmap',
    emoji: '📋',
    icon: 'ph--list-checks',
    color: 'text-info',
    workEmoji: '📋',
  },
  // Manual Memory
  note: {
    id: 'note',
    label: 'Note',
    description: 'Manual note or bookmark saved via MCP',
    emoji: '📌',
    icon: 'ph--note',
    color: 'text-warning',
    workEmoji: '📌',
  },
  // Session
  'session-request': {
    id: 'session-request',
    label: 'Request',
    description: 'User prompt/request tracking',
    emoji: '💬',
    icon: 'ph--chat-text',
    color: 'text-base-content/60',
    workEmoji: '💬',
  },
};

/**
 * Observation concepts - knowledge categorization
 */
export type ObservationConcept =
  | 'how-it-works'     // Understanding mechanisms
  | 'why-it-exists'    // Purpose or rationale
  | 'what-changed'     // Modifications made
  | 'problem-solution' // Issues and their fixes
  | 'gotcha'           // Traps or edge cases
  | 'pattern'          // Reusable approach
  | 'trade-off'        // Pros/cons of a decision
  | 'best-practice'    // Recommended approach
  | 'anti-pattern'     // What to avoid
  | 'architecture'     // System design
  | 'workflow';        // Process or procedure

/**
 * Observation concept metadata
 */
export interface ObservationConceptConfig {
  id: ObservationConcept;
  label: string;
  description: string;
}

export const OBSERVATION_CONCEPTS: Record<ObservationConcept, ObservationConceptConfig> = {
  'how-it-works': {
    id: 'how-it-works',
    label: 'How It Works',
    description: 'Understanding mechanisms',
  },
  'why-it-exists': {
    id: 'why-it-exists',
    label: 'Why It Exists',
    description: 'Purpose or rationale',
  },
  'what-changed': {
    id: 'what-changed',
    label: 'What Changed',
    description: 'Modifications made',
  },
  'problem-solution': {
    id: 'problem-solution',
    label: 'Problem-Solution',
    description: 'Issues and their fixes',
  },
  gotcha: {
    id: 'gotcha',
    label: 'Gotcha',
    description: 'Traps or edge cases',
  },
  pattern: {
    id: 'pattern',
    label: 'Pattern',
    description: 'Reusable approach',
  },
  'trade-off': {
    id: 'trade-off',
    label: 'Trade-Off',
    description: 'Pros/cons of a decision',
  },
  'best-practice': {
    id: 'best-practice',
    label: 'Best Practice',
    description: 'Recommended approach',
  },
  'anti-pattern': {
    id: 'anti-pattern',
    label: 'Anti-Pattern',
    description: 'What to avoid',
  },
  architecture: {
    id: 'architecture',
    label: 'Architecture',
    description: 'System design',
  },
  workflow: {
    id: 'workflow',
    label: 'Workflow',
    description: 'Process or procedure',
  },
};

/**
 * Session status
 */
export type SessionStatus = 'active' | 'completed' | 'failed';

/**
 * SDK Session database record
 */
export interface SdkSessionRecord {
  id: number;
  content_session_id: string;
  memory_session_id: string | null;
  project: string;
  user_prompt: string | null;
  started_at: string;
  started_at_epoch: number;
  completed_at: string | null;
  completed_at_epoch: number | null;
  status: SessionStatus;
  worker_port?: number;
  prompt_counter?: number;
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
  prompt_number?: number;
  discovery_tokens?: number;
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

/**
 * Latest user prompt with session join
 */
export interface LatestPromptResult {
  id: number;
  content_session_id: string;
  memory_session_id: string;
  project: string;
  prompt_number: number;
  prompt_text: string;
  created_at_epoch: number;
}

/**
 * Observation with context (for time-based queries)
 */
export interface ObservationWithContext {
  id: number;
  memory_session_id: string;
  project: string;
  text: string | null;
  type: string;
  created_at: string;
  created_at_epoch: number;
  title?: string;
  concept?: string;
  source_files?: string;
  prompt_number?: number;
  discovery_tokens?: number;
}

/**
 * Schema information from SQLite PRAGMA
 */
export interface TableColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

/**
 * Index information from SQLite PRAGMA
 */
export interface IndexInfo {
  seq: number;
  name: string;
  unique: number;
  origin: string;
  partial: number;
}

/**
 * Schema version record
 */
export interface SchemaVersion {
  version: number;
}

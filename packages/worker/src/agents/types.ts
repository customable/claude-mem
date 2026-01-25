/**
 * Agent Types
 *
 * Defines the interface for AI agents. This makes it easy to add
 * new providers (Mistral, Gemini, OpenAI) by implementing the same interface.
 */

/**
 * Role in a conversation
 */
export type MessageRole = 'user' | 'assistant';

/**
 * A message in a conversation
 */
export interface ConversationMessage {
  role: MessageRole;
  content: string;
}

/**
 * Result of an agent query
 */
export interface AgentResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  stopReason?: string;
}

/**
 * Options for agent queries
 */
export interface AgentQueryOptions {
  /** System prompt */
  system?: string;
  /** Conversation history */
  messages: ConversationMessage[];
  /** Max tokens to generate */
  maxTokens?: number;
  /** Temperature (0-1) */
  temperature?: number;
  /** Stop sequences */
  stopSequences?: string[];
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Agent interface - all AI providers implement this
 */
export interface Agent {
  /** Provider name for logging/identification */
  readonly name: string;

  /** Check if agent is available (has credentials, etc.) */
  isAvailable(): boolean;

  /** Query the agent */
  query(options: AgentQueryOptions): Promise<AgentResponse>;
}

/**
 * Agent factory function type
 */
export type AgentFactory = () => Agent;

/**
 * Agent provider definition for the registry
 */
export interface AgentProviderDefinition {
  /** Unique provider name (e.g., 'anthropic', 'mistral') */
  name: string;
  /** Display name for UI (e.g., 'Anthropic Claude') */
  displayName: string;
  /** Environment variable key for API credentials */
  envKey: string;
  /** Check if provider is available (has credentials) */
  isAvailable: () => boolean;
  /** Factory function to create the agent */
  create: () => Agent;
  /** Priority for fallback order (higher = preferred) */
  priority?: number;
}

/**
 * Parsed observation from agent response
 * Types synchronized with ObservationType in @claude-mem/types
 */
export interface ParsedObservation {
  type:
    | 'bugfix'
    | 'feature'
    | 'refactor'
    | 'change'
    | 'docs'
    | 'config'
    | 'test'
    | 'security'
    | 'performance'
    | 'deploy'
    | 'infra'
    | 'migration'
    | 'discovery'
    | 'decision'
    | 'research'
    | 'api'
    | 'integration'
    | 'dependency'
    | 'task'
    | 'plan'
    | 'note'
    | 'session-request';
  title: string;
  text: string;
  subtitle?: string;
  narrative?: string;
  facts?: string[];
  concepts?: string[];
  concept?: string;
  filesRead?: string[];
  filesModified?: string[];
  gitBranch?: string;
  decisionCategory?: string;
}

/**
 * Parsed summary from agent response
 */
export interface ParsedSummary {
  request: string;
  investigated: string;
  learned: string;
  completed: string;
  nextSteps: string;
}

/**
 * Response from observation extraction
 */
export interface ObservationExtractionResult {
  observations: ParsedObservation[];
  summary?: ParsedSummary;
  sessionId?: string;
  tokens: {
    input: number;
    output: number;
  };
}

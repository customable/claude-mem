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
 * Parsed observation from agent response
 */
export interface ParsedObservation {
  type: 'bugfix' | 'feature' | 'refactor' | 'change' | 'discovery' | 'decision' | 'session-request';
  title: string;
  text: string;
  subtitle?: string;
  narrative?: string;
  facts?: string[];
  concepts?: string[];
  filesRead?: string[];
  filesModified?: string[];
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

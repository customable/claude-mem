/**
 * Anthropic SDK Agent
 *
 * Uses the official Anthropic SDK for Claude API access.
 * This is the primary/default agent for observation extraction.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createLogger, loadSettings } from '@claude-mem/shared';
import type { Agent, AgentQueryOptions, AgentResponse, ConversationMessage } from './types.js';

const logger = createLogger('anthropic-agent');

/**
 * Configuration for Anthropic Agent
 */
export interface AnthropicAgentConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Anthropic SDK Agent implementation
 */
export class AnthropicAgent implements Agent {
  readonly name = 'anthropic';

  private client: Anthropic | null = null;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly apiKey: string;

  constructor(config: AnthropicAgentConfig = {}) {
    const settings = loadSettings();

    this.apiKey = config.apiKey || settings.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '';
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 4096;
  }

  /**
   * Check if the agent has valid credentials
   */
  isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Get or create the Anthropic client
   */
  private getClient(): Anthropic {
    if (!this.client) {
      if (!this.apiKey) {
        throw new Error('Anthropic API key not configured');
      }
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
    return this.client;
  }

  /**
   * Query Claude via the Anthropic SDK
   */
  async query(options: AgentQueryOptions): Promise<AgentResponse> {
    const client = this.getClient();

    const messages = options.messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    try {
      const response = await client.messages.create({
        model: this.model,
        max_tokens: options.maxTokens || this.maxTokens,
        system: options.system,
        messages,
        temperature: options.temperature,
        stop_sequences: options.stopSequences,
      });

      // Extract text content from response
      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return {
        content: textContent,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model: response.model,
        stopReason: response.stop_reason ?? undefined,
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Anthropic API error:', { message: err.message });
      throw error;
    }
  }
}

/**
 * Create an Anthropic agent with default configuration
 */
export function createAnthropicAgent(config?: AnthropicAgentConfig): AnthropicAgent {
  return new AnthropicAgent(config);
}

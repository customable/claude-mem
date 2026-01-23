/**
 * Mistral Agent
 *
 * Uses the official Mistral SDK for API access.
 * Great option for high-volume processing (1B free tokens/month!).
 */

import { Mistral } from '@mistralai/mistralai';
import { createLogger, loadSettings } from '@claude-mem/shared';
import type { Agent, AgentQueryOptions, AgentResponse } from './types.js';

const logger = createLogger('mistral-agent');

/**
 * Configuration for Mistral Agent
 */
export interface MistralAgentConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Mistral Agent implementation
 */
export class MistralAgent implements Agent {
  readonly name = 'mistral';

  private client: Mistral | null = null;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly apiKey: string;

  constructor(config: MistralAgentConfig = {}) {
    const settings = loadSettings();

    this.apiKey = config.apiKey || settings.MISTRAL_API_KEY || process.env.MISTRAL_API_KEY || '';
    this.model = config.model || settings.MISTRAL_MODEL || 'mistral-small-latest';
    this.maxTokens = config.maxTokens || 4096;
  }

  /**
   * Check if the agent has valid credentials
   */
  isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Get or create the Mistral client
   */
  private getClient(): Mistral {
    if (!this.client) {
      if (!this.apiKey) {
        throw new Error('Mistral API key not configured');
      }
      this.client = new Mistral({ apiKey: this.apiKey });
    }
    return this.client;
  }

  /**
   * Query Mistral API
   */
  async query(options: AgentQueryOptions): Promise<AgentResponse> {
    const client = this.getClient();

    // Build messages array with system message first
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (options.system) {
      messages.push({ role: 'system', content: options.system });
    }

    for (const msg of options.messages) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    try {
      const response = await client.chat.complete({
        model: this.model,
        messages,
        maxTokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature,
        stop: options.stopSequences,
      });

      // Extract content from response
      const choice = response.choices?.[0];
      const content = choice?.message?.content || '';
      const textContent = typeof content === 'string' ? content : '';

      return {
        content: textContent,
        inputTokens: response.usage?.promptTokens || 0,
        outputTokens: response.usage?.completionTokens || 0,
        model: response.model || this.model,
        stopReason: choice?.finishReason ?? undefined,
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Mistral API error:', { message: err.message });
      throw error;
    }
  }
}

/**
 * Create a Mistral agent with default configuration
 */
export function createMistralAgent(config?: MistralAgentConfig): MistralAgent {
  return new MistralAgent(config);
}

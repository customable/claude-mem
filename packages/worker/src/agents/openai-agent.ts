/**
 * OpenAI Agent (Issue #112)
 *
 * Uses the OpenAI Chat Completions API.
 * Supports both OpenAI and OpenAI-compatible APIs (via OPENAI_BASE_URL).
 */

import { createLogger, loadSettings } from '@claude-mem/shared';
import type { Agent, AgentQueryOptions, AgentResponse } from './types.js';

const logger = createLogger('openai-agent');

/**
 * Configuration for OpenAI Agent
 */
export interface OpenAIAgentConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  baseUrl?: string;
}

/**
 * OpenAI Agent implementation
 *
 * Uses the Chat Completions API for text generation.
 */
export class OpenAIAgent implements Agent {
  readonly name = 'openai';

  private readonly model: string;
  private readonly maxTokens: number;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: OpenAIAgentConfig = {}) {
    const settings = loadSettings();

    this.apiKey = config.apiKey || settings.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
    this.model = config.model || settings.OPENAI_MODEL || 'gpt-4o-mini';
    this.maxTokens = config.maxTokens || 4096;
    this.baseUrl = config.baseUrl || settings.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  }

  /**
   * Check if the agent has valid credentials
   */
  isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Query OpenAI API
   */
  async query(options: AgentQueryOptions): Promise<AgentResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

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

    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          max_tokens: options.maxTokens || this.maxTokens,
          temperature: options.temperature,
          stop: options.stopSequences,
        }),
        signal: options.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json() as {
        id: string;
        model: string;
        choices: Array<{
          message: { content: string };
          finish_reason: string;
        }>;
        usage: {
          prompt_tokens: number;
          completion_tokens: number;
        };
      };

      const choice = data.choices?.[0];
      const content = choice?.message?.content || '';

      return {
        content,
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        model: data.model || this.model,
        stopReason: choice?.finish_reason,
      };
    } catch (error) {
      const err = error as Error;
      logger.error('OpenAI API error:', { message: err.message });
      throw error;
    }
  }
}

/**
 * Create an OpenAI agent with default configuration
 */
export function createOpenAIAgent(config?: OpenAIAgentConfig): OpenAIAgent {
  return new OpenAIAgent(config);
}

/**
 * OpenRouter Agent (Issue #112)
 *
 * Uses the OpenRouter API (OpenAI-compatible) with multi-model support.
 * OpenRouter provides access to many models with automatic fallback.
 */

import { createLogger, loadSettings } from '@claude-mem/shared';
import type { Agent, AgentQueryOptions, AgentResponse } from './types.js';

const logger = createLogger('openrouter-agent');

/**
 * Configuration for OpenRouter Agent
 */
export interface OpenRouterAgentConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  /** Optional site URL for OpenRouter attribution */
  siteUrl?: string;
  /** Optional site name for OpenRouter attribution */
  siteName?: string;
}

/**
 * OpenRouter Agent implementation
 *
 * Uses the OpenRouter API for multi-model access.
 * Supports free models and paid models with automatic fallback.
 */
export class OpenRouterAgent implements Agent {
  readonly name = 'openrouter';

  private readonly model: string;
  private readonly maxTokens: number;
  private readonly apiKey: string;
  private readonly siteUrl: string;
  private readonly siteName: string;

  private static readonly BASE_URL = 'https://openrouter.ai/api/v1';

  constructor(config: OpenRouterAgentConfig = {}) {
    const settings = loadSettings();

    this.apiKey = config.apiKey || settings.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || '';
    this.model = config.model || settings.OPENROUTER_MODEL || 'xiaomi/mimo-v2-flash:free';
    this.maxTokens = config.maxTokens || 4096;
    this.siteUrl = config.siteUrl || 'https://github.com/claude-mem/claude-mem';
    this.siteName = config.siteName || 'claude-mem';
  }

  /**
   * Check if the agent has valid credentials
   */
  isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Query OpenRouter API
   */
  async query(options: AgentQueryOptions): Promise<AgentResponse> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
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

    const url = `${OpenRouterAgent.BASE_URL}/chat/completions`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': this.siteUrl,
          'X-Title': this.siteName,
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
        throw new Error(`OpenRouter API error ${response.status}: ${errorBody}`);
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
      logger.error('OpenRouter API error:', { message: err.message });
      throw error;
    }
  }
}

/**
 * Create an OpenRouter agent with default configuration
 */
export function createOpenRouterAgent(config?: OpenRouterAgentConfig): OpenRouterAgent {
  return new OpenRouterAgent(config);
}

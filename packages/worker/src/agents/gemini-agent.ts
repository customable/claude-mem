/**
 * Gemini Agent (Issue #112)
 *
 * Uses the Google Generative AI (Gemini) API.
 * Good option for cost-effective processing with Gemini 2.5 Flash.
 */

import { createLogger, loadSettings } from '@claude-mem/shared';
import type { Agent, AgentQueryOptions, AgentResponse } from './types.js';

const logger = createLogger('gemini-agent');

/**
 * Configuration for Gemini Agent
 */
export interface GeminiAgentConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Gemini Agent implementation
 *
 * Uses the Generative Language API for text generation.
 */
export class GeminiAgent implements Agent {
  readonly name = 'gemini';

  private readonly model: string;
  private readonly maxTokens: number;
  private readonly apiKey: string;

  private static readonly BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(config: GeminiAgentConfig = {}) {
    const settings = loadSettings();

    this.apiKey = config.apiKey || settings.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    this.model = config.model || settings.GEMINI_MODEL || 'gemini-2.5-flash-lite';
    this.maxTokens = config.maxTokens || 4096;
  }

  /**
   * Check if the agent has valid credentials
   */
  isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Query Gemini API
   */
  async query(options: AgentQueryOptions): Promise<AgentResponse> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    // Build contents array for Gemini API
    // Gemini uses a different format: system instruction is separate
    const contents: Array<{
      role: 'user' | 'model';
      parts: Array<{ text: string }>;
    }> = [];

    for (const msg of options.messages) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    const url = `${GeminiAgent.BASE_URL}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const requestBody: {
      contents: typeof contents;
      systemInstruction?: { parts: Array<{ text: string }> };
      generationConfig: {
        maxOutputTokens: number;
        temperature?: number;
        stopSequences?: string[];
      };
    } = {
      contents,
      generationConfig: {
        maxOutputTokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature,
        stopSequences: options.stopSequences,
      },
    };

    // Add system instruction if provided
    if (options.system) {
      requestBody.systemInstruction = {
        parts: [{ text: options.system }],
      };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: options.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json() as {
        candidates: Array<{
          content: {
            parts: Array<{ text: string }>;
            role: string;
          };
          finishReason: string;
        }>;
        usageMetadata: {
          promptTokenCount: number;
          candidatesTokenCount: number;
          totalTokenCount: number;
        };
      };

      const candidate = data.candidates?.[0];
      const content = candidate?.content?.parts?.map(p => p.text).join('') || '';

      return {
        content,
        inputTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        model: this.model,
        stopReason: candidate?.finishReason,
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Gemini API error:', { message: err.message });
      throw error;
    }
  }
}

/**
 * Create a Gemini agent with default configuration
 */
export function createGeminiAgent(config?: GeminiAgentConfig): GeminiAgent {
  return new GeminiAgent(config);
}

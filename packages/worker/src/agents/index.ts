/**
 * Agent Registry
 *
 * Central registry for AI agents. Provides:
 * - Agent factory functions
 * - Provider selection based on settings
 * - Easy extensibility for new providers
 */

import { loadSettings } from '@claude-mem/shared';
import type { Agent } from './types.js';
import { AnthropicAgent, createAnthropicAgent } from './anthropic-agent.js';
import { MistralAgent, createMistralAgent } from './mistral-agent.js';

// Re-export types and agents
export * from './types.js';
export { AnthropicAgent, createAnthropicAgent } from './anthropic-agent.js';
export { MistralAgent, createMistralAgent } from './mistral-agent.js';

/**
 * Supported AI providers
 */
export type AIProvider = 'anthropic' | 'mistral' | 'gemini' | 'openai' | 'openrouter';

/**
 * Agent registry - maps provider names to agent instances
 */
const agentRegistry = new Map<AIProvider, Agent>();

/**
 * Get or create an agent for the specified provider
 */
export function getAgent(provider: AIProvider): Agent {
  // Check registry first
  const existing = agentRegistry.get(provider);
  if (existing) {
    return existing;
  }

  // Create new agent based on provider
  let agent: Agent;

  switch (provider) {
    case 'anthropic':
      agent = createAnthropicAgent();
      break;
    case 'mistral':
      agent = createMistralAgent();
      break;
    case 'gemini':
    case 'openai':
    case 'openrouter':
      // TODO: Add these providers when needed
      throw new Error(`Provider '${provider}' not yet implemented. Pull requests welcome!`);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  // Cache and return
  agentRegistry.set(provider, agent);
  return agent;
}

/**
 * Get the default agent based on settings
 */
export function getDefaultAgent(): Agent {
  const settings = loadSettings();
  const provider = settings.AI_PROVIDER as AIProvider;

  // Try configured provider first
  try {
    const agent = getAgent(provider);
    if (agent.isAvailable()) {
      return agent;
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback chain: mistral -> anthropic
  const fallbackOrder: AIProvider[] = ['mistral', 'anthropic'];

  for (const fallbackProvider of fallbackOrder) {
    try {
      const agent = getAgent(fallbackProvider);
      if (agent.isAvailable()) {
        return agent;
      }
    } catch {
      continue;
    }
  }

  throw new Error('No AI provider available. Please configure MISTRAL_API_KEY or ANTHROPIC_API_KEY.');
}

/**
 * Clear the agent registry (for testing)
 */
export function clearAgentRegistry(): void {
  agentRegistry.clear();
}

/**
 * Register a custom agent
 * This allows external code to add new providers without modifying this file
 */
export function registerAgent(provider: AIProvider, agent: Agent): void {
  agentRegistry.set(provider, agent);
}

/**
 * Agent Registry
 *
 * Central registry for AI agents. Provides:
 * - Dynamic provider registration
 * - Configurable fallback order
 * - Easy extensibility for new providers
 */

import { loadSettings } from '@claude-mem/shared';
import type { Agent, AgentProviderDefinition } from './types.js';
import { createAnthropicAgent } from './anthropic-agent.js';
import { createMistralAgent } from './mistral-agent.js';

// Re-export types and agents
export * from './types.js';
export { AnthropicAgent, createAnthropicAgent } from './anthropic-agent.js';
export { MistralAgent, createMistralAgent } from './mistral-agent.js';

/**
 * Provider registry - stores provider definitions
 */
const providerRegistry = new Map<string, AgentProviderDefinition>();

/**
 * Agent instance cache - stores created agents
 */
const agentCache = new Map<string, Agent>();

/**
 * Register a provider
 */
export function registerProvider(definition: AgentProviderDefinition): void {
  providerRegistry.set(definition.name, definition);
}

/**
 * Unregister a provider
 */
export function unregisterProvider(name: string): void {
  providerRegistry.delete(name);
  agentCache.delete(name);
}

/**
 * Get all registered providers
 */
export function getRegisteredProviders(): AgentProviderDefinition[] {
  return [...providerRegistry.values()];
}

/**
 * Get available providers (those with credentials configured)
 */
export function getAvailableProviders(): AgentProviderDefinition[] {
  return getRegisteredProviders()
    .filter((p) => p.isAvailable())
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

/**
 * Get or create an agent for the specified provider
 */
export function getAgent(providerName: string): Agent {
  // Check cache first
  const cached = agentCache.get(providerName);
  if (cached) {
    return cached;
  }

  // Get provider definition
  const definition = providerRegistry.get(providerName);
  if (!definition) {
    const available = getRegisteredProviders().map((p) => p.name).join(', ');
    throw new Error(`Unknown provider: ${providerName}. Available: ${available}`);
  }

  // Create agent
  const agent = definition.create();
  agentCache.set(providerName, agent);
  return agent;
}

/**
 * Get the default agent based on settings
 */
export function getDefaultAgent(): Agent {
  const settings = loadSettings();
  const configuredProvider = settings.AI_PROVIDER as string;

  // Try configured provider first
  if (configuredProvider && providerRegistry.has(configuredProvider)) {
    try {
      const agent = getAgent(configuredProvider);
      if (agent.isAvailable()) {
        return agent;
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Use settings-based fallback order, or default to priority-based
  const fallbackOrder = settings.AI_PROVIDER_FALLBACK as string[] | undefined;

  const providersToTry = fallbackOrder && fallbackOrder.length > 0
    ? fallbackOrder
    : getAvailableProviders().map((p) => p.name);

  for (const providerName of providersToTry) {
    if (!providerRegistry.has(providerName)) {
      continue;
    }
    try {
      const agent = getAgent(providerName);
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
 * Clear the agent cache (for testing)
 */
export function clearAgentCache(): void {
  agentCache.clear();
}

/**
 * Clear both registry and cache (for testing)
 */
export function clearAgentRegistry(): void {
  providerRegistry.clear();
  agentCache.clear();
}

/**
 * Register a custom agent (legacy compatibility)
 * @deprecated Use registerProvider instead
 */
export function registerAgent(provider: string, agent: Agent): void {
  agentCache.set(provider, agent);
}

// =============================================================================
// Built-in Provider Registrations
// =============================================================================

// Mistral - higher priority (cheaper, good quality)
registerProvider({
  name: 'mistral',
  displayName: 'Mistral AI',
  envKey: 'MISTRAL_API_KEY',
  isAvailable: () => !!process.env.MISTRAL_API_KEY,
  create: createMistralAgent,
  priority: 20,
});

// Anthropic - lower priority (more expensive)
registerProvider({
  name: 'anthropic',
  displayName: 'Anthropic Claude',
  envKey: 'ANTHROPIC_API_KEY',
  isAvailable: () => !!process.env.ANTHROPIC_API_KEY,
  create: createAnthropicAgent,
  priority: 10,
});

// Placeholder for future providers
// registerProvider({
//   name: 'openai',
//   displayName: 'OpenAI',
//   envKey: 'OPENAI_API_KEY',
//   isAvailable: () => !!process.env.OPENAI_API_KEY,
//   create: () => { throw new Error('OpenAI not yet implemented'); },
//   priority: 15,
// });

// Legacy type export for backwards compatibility
export type AIProvider = 'anthropic' | 'mistral' | 'gemini' | 'openai' | 'openrouter';

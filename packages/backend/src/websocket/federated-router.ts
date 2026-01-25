/**
 * Federated Router (Issue #263)
 *
 * Routes tasks to the appropriate hub based on priority, weight, labels, and load.
 * Supports multiple routing strategies for distributed worker pools.
 */

import { createLogger } from '@claude-mem/shared';
import type { HubRegistry } from '../services/hub-registry.js';
import type { RoutingStrategy } from '@claude-mem/types';

const logger = createLogger('federated-router');

// Hub with health info for routing decisions
interface RoutableHub {
  id: string;
  name: string;
  priority: number;
  weight: number;
  region?: string;
  labels?: Record<string, string>;
  capabilities?: string[];
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  connectedWorkers: number;
  activeWorkers: number;
  avgLatencyMs?: number;
}

export interface TaskRoutingOptions {
  capability: string;
  preferHubs?: string[];
  preferLabels?: Record<string, string>;
  preferRegion?: string;
  strategy?: RoutingStrategy;
}

export class FederatedRouter {
  // Track round-robin state per capability
  private roundRobinIndex: Map<string, number> = new Map();

  constructor(private readonly hubRegistry: HubRegistry) {}

  /**
   * Route a task to the best available hub
   */
  async routeTask(options: TaskRoutingOptions): Promise<string | null> {
    const { capability, preferHubs, preferLabels, preferRegion, strategy = 'priority' } = options;

    // Get all healthy hubs with the required capability
    const hubs = await this.hubRegistry.getHealthyHubs(capability);

    if (hubs.length === 0) {
      logger.warn(`No healthy hubs available for capability: ${capability}`);
      return null;
    }

    // Convert to routable format
    const routableHubs: RoutableHub[] = hubs.map((h) => ({
      id: h.id,
      name: h.name,
      priority: h.priority,
      weight: h.weight,
      region: h.region,
      labels: h.labels,
      capabilities: h.capabilities,
      status: h.status as RoutableHub['status'],
      connectedWorkers: h.connected_workers,
      activeWorkers: h.active_workers,
      avgLatencyMs: h.avg_latency_ms,
    }));

    // Apply preferences (filter/boost preferred hubs)
    let candidates = this.applyPreferences(routableHubs, {
      preferHubs,
      preferLabels,
      preferRegion,
    });

    // If no preferred candidates match, fall back to all hubs
    if (candidates.length === 0) {
      candidates = routableHubs;
    }

    // Route based on strategy
    const selectedHub = this.selectHub(candidates, capability, strategy);

    if (selectedHub) {
      logger.debug(`Routed task (${capability}) to hub ${selectedHub.name} via ${strategy}`);
      return selectedHub.id;
    }

    return null;
  }

  /**
   * Apply routing preferences to filter/sort hubs
   */
  private applyPreferences(
    hubs: RoutableHub[],
    preferences: {
      preferHubs?: string[];
      preferLabels?: Record<string, string>;
      preferRegion?: string;
    }
  ): RoutableHub[] {
    let candidates = [...hubs];

    // Filter by preferred hub IDs
    if (preferences.preferHubs && preferences.preferHubs.length > 0) {
      const preferred = candidates.filter((h) => preferences.preferHubs!.includes(h.id));
      if (preferred.length > 0) {
        candidates = preferred;
      }
    }

    // Filter by preferred region
    if (preferences.preferRegion) {
      const regional = candidates.filter((h) => h.region === preferences.preferRegion);
      if (regional.length > 0) {
        candidates = regional;
      }
    }

    // Filter by preferred labels
    if (preferences.preferLabels && Object.keys(preferences.preferLabels).length > 0) {
      const labeled = candidates.filter((h) => {
        if (!h.labels) return false;
        return Object.entries(preferences.preferLabels!).every(
          ([key, value]) => h.labels![key] === value
        );
      });
      if (labeled.length > 0) {
        candidates = labeled;
      }
    }

    return candidates;
  }

  /**
   * Select a hub based on the routing strategy
   */
  private selectHub(
    hubs: RoutableHub[],
    capability: string,
    strategy: RoutingStrategy
  ): RoutableHub | null {
    if (hubs.length === 0) return null;

    // Filter out offline hubs
    const availableHubs = hubs.filter((h) => h.status !== 'offline');
    if (availableHubs.length === 0) return null;

    switch (strategy) {
      case 'priority':
        return this.routeByPriority(availableHubs);
      case 'weighted':
        return this.routeByWeight(availableHubs);
      case 'round-robin':
        return this.routeByRoundRobin(availableHubs, capability);
      case 'least-loaded':
        return this.routeByLeastLoaded(availableHubs);
      default:
        return this.routeByPriority(availableHubs);
    }
  }

  /**
   * Route by priority (highest priority first, with health consideration)
   */
  private routeByPriority(hubs: RoutableHub[]): RoutableHub | null {
    // Sort by priority (desc), then by status (healthy > degraded > unhealthy)
    const sorted = [...hubs].sort((a, b) => {
      // Healthy hubs get a boost
      const statusWeight = { healthy: 100, degraded: 50, unhealthy: 0, offline: -1000 };
      const aScore = a.priority + statusWeight[a.status];
      const bScore = b.priority + statusWeight[b.status];
      return bScore - aScore;
    });

    return sorted[0] || null;
  }

  /**
   * Route by weight (probabilistic distribution)
   */
  private routeByWeight(hubs: RoutableHub[]): RoutableHub | null {
    // Only consider healthy/degraded hubs for weighted routing
    const healthyHubs = hubs.filter((h) => h.status === 'healthy' || h.status === 'degraded');
    if (healthyHubs.length === 0) {
      // Fall back to any available hub
      return hubs[0] || null;
    }

    // Apply health penalty to weights
    const adjustedHubs = healthyHubs.map((h) => ({
      hub: h,
      adjustedWeight: h.status === 'degraded' ? h.weight * 0.5 : h.weight,
    }));

    const totalWeight = adjustedHubs.reduce((sum, h) => sum + h.adjustedWeight, 0);
    if (totalWeight === 0) return healthyHubs[0];

    const random = Math.random() * totalWeight;
    let cumulative = 0;

    for (const { hub, adjustedWeight } of adjustedHubs) {
      cumulative += adjustedWeight;
      if (random <= cumulative) {
        return hub;
      }
    }

    return healthyHubs[0];
  }

  /**
   * Route by round-robin (fair distribution)
   */
  private routeByRoundRobin(hubs: RoutableHub[], capability: string): RoutableHub | null {
    // Only consider healthy hubs
    const healthyHubs = hubs.filter((h) => h.status === 'healthy');
    if (healthyHubs.length === 0) {
      return hubs[0] || null;
    }

    // Get current index for this capability
    const currentIndex = this.roundRobinIndex.get(capability) || 0;
    const nextIndex = (currentIndex + 1) % healthyHubs.length;
    this.roundRobinIndex.set(capability, nextIndex);

    return healthyHubs[currentIndex % healthyHubs.length];
  }

  /**
   * Route by least loaded (hub with most available capacity)
   */
  private routeByLeastLoaded(hubs: RoutableHub[]): RoutableHub | null {
    // Only consider healthy hubs
    const healthyHubs = hubs.filter((h) => h.status === 'healthy' || h.status === 'degraded');
    if (healthyHubs.length === 0) {
      return hubs[0] || null;
    }

    // Sort by (connectedWorkers - activeWorkers) descending (most idle workers first)
    // Then by avgLatencyMs ascending (lowest latency first)
    const sorted = [...healthyHubs].sort((a, b) => {
      const aIdle = a.connectedWorkers - a.activeWorkers;
      const bIdle = b.connectedWorkers - b.activeWorkers;

      if (aIdle !== bIdle) {
        return bIdle - aIdle; // More idle workers = better
      }

      // Tie-breaker: lower latency
      const aLatency = a.avgLatencyMs ?? Infinity;
      const bLatency = b.avgLatencyMs ?? Infinity;
      return aLatency - bLatency;
    });

    return sorted[0] || null;
  }

  /**
   * Get routing statistics
   */
  getStats(): { roundRobinState: Record<string, number> } {
    return {
      roundRobinState: Object.fromEntries(this.roundRobinIndex),
    };
  }
}

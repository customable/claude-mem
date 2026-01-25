/**
 * Channel Manager
 *
 * Manages channel subscriptions for the unified WebSocket system.
 * Supports wildcard patterns (e.g., 'session:*' matches 'session:started').
 *
 * Issue #264: Unified WebSocket System with Channels
 */

import { createLogger } from '@claude-mem/shared';
import type { ChannelEvent, ChannelPattern } from '@claude-mem/types';

const logger = createLogger('channel-manager');

export class ChannelManager {
  /**
   * Map of channel pattern -> Set of client IDs subscribed to that pattern
   */
  private subscriptions: Map<ChannelPattern, Set<string>> = new Map();

  /**
   * Map of client ID -> Set of patterns they are subscribed to
   * (for efficient cleanup on disconnect)
   */
  private clientPatterns: Map<string, Set<ChannelPattern>> = new Map();

  /**
   * Subscribe a client to one or more channel patterns
   *
   * @param clientId - Unique client identifier
   * @param patterns - Channel patterns to subscribe to (e.g., ['session:*', 'task:completed'])
   * @returns List of successfully subscribed patterns
   */
  subscribe(clientId: string, patterns: ChannelPattern[]): ChannelPattern[] {
    const subscribed: ChannelPattern[] = [];

    for (const pattern of patterns) {
      // Get or create the set of clients for this pattern
      let clients = this.subscriptions.get(pattern);
      if (!clients) {
        clients = new Set();
        this.subscriptions.set(pattern, clients);
      }

      // Add client to pattern
      if (!clients.has(clientId)) {
        clients.add(clientId);
        subscribed.push(pattern);

        // Track pattern for this client
        let clientSubs = this.clientPatterns.get(clientId);
        if (!clientSubs) {
          clientSubs = new Set();
          this.clientPatterns.set(clientId, clientSubs);
        }
        clientSubs.add(pattern);
      }
    }

    if (subscribed.length > 0) {
      logger.debug(`Client ${clientId} subscribed to: ${subscribed.join(', ')}`);
    }

    return subscribed;
  }

  /**
   * Unsubscribe a client from one or more channel patterns
   *
   * @param clientId - Unique client identifier
   * @param patterns - Channel patterns to unsubscribe from
   */
  unsubscribe(clientId: string, patterns: ChannelPattern[]): void {
    const unsubscribed: ChannelPattern[] = [];

    for (const pattern of patterns) {
      const clients = this.subscriptions.get(pattern);
      if (clients && clients.has(clientId)) {
        clients.delete(clientId);
        unsubscribed.push(pattern);

        // Clean up empty pattern sets
        if (clients.size === 0) {
          this.subscriptions.delete(pattern);
        }

        // Remove from client tracking
        const clientSubs = this.clientPatterns.get(clientId);
        if (clientSubs) {
          clientSubs.delete(pattern);
        }
      }
    }

    if (unsubscribed.length > 0) {
      logger.debug(`Client ${clientId} unsubscribed from: ${unsubscribed.join(', ')}`);
    }
  }

  /**
   * Remove all subscriptions for a client (called on disconnect)
   *
   * @param clientId - Unique client identifier
   */
  removeClient(clientId: string): void {
    const clientSubs = this.clientPatterns.get(clientId);
    if (clientSubs) {
      for (const pattern of clientSubs) {
        const clients = this.subscriptions.get(pattern);
        if (clients) {
          clients.delete(clientId);
          if (clients.size === 0) {
            this.subscriptions.delete(pattern);
          }
        }
      }
      this.clientPatterns.delete(clientId);
      logger.debug(`Client ${clientId} removed, cleaned up ${clientSubs.size} subscriptions`);
    }
  }

  /**
   * Get all client IDs that should receive an event on the given channel
   *
   * This handles wildcard matching:
   * - 'session:*' matches 'session:started', 'session:ended', etc.
   * - '*' matches all channels
   * - Exact matches work as expected
   *
   * @param channel - The channel event to match
   * @returns Set of client IDs subscribed to matching patterns
   */
  getSubscribers(channel: ChannelEvent): Set<string> {
    const subscribers = new Set<string>();

    for (const [pattern, clients] of this.subscriptions) {
      if (this.matches(pattern, channel)) {
        for (const clientId of clients) {
          subscribers.add(clientId);
        }
      }
    }

    return subscribers;
  }

  /**
   * Get all patterns a client is subscribed to
   *
   * @param clientId - Unique client identifier
   * @returns Array of subscribed patterns
   */
  getClientSubscriptions(clientId: string): ChannelPattern[] {
    const subs = this.clientPatterns.get(clientId);
    return subs ? Array.from(subs) : [];
  }

  /**
   * Get statistics about subscriptions
   */
  getStats(): { totalPatterns: number; totalClients: number; patternCounts: Record<string, number> } {
    const patternCounts: Record<string, number> = {};
    for (const [pattern, clients] of this.subscriptions) {
      patternCounts[pattern] = clients.size;
    }

    return {
      totalPatterns: this.subscriptions.size,
      totalClients: this.clientPatterns.size,
      patternCounts,
    };
  }

  /**
   * Check if a pattern matches a channel
   *
   * Matching rules:
   * - '*' matches everything
   * - Exact match: 'session:started' matches 'session:started'
   * - Wildcard suffix: 'session:*' matches 'session:started', 'session:ended'
   *
   * @param pattern - The subscription pattern
   * @param channel - The channel event to match against
   * @returns true if the pattern matches the channel
   */
  private matches(pattern: ChannelPattern, channel: ChannelEvent): boolean {
    // Global wildcard matches everything
    if (pattern === '*') {
      return true;
    }

    // Exact match
    if (pattern === channel) {
      return true;
    }

    // Wildcard suffix (e.g., 'session:*' matches 'session:started')
    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -1); // 'session:'
      return channel.startsWith(prefix);
    }

    return false;
  }
}

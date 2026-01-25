/**
 * Hub Registry Service (Issue #263)
 *
 * Manages the registry of worker hubs. The backend has a built-in hub,
 * and external hubs can federate with it.
 */

import { randomUUID } from 'node:crypto';
import { createLogger } from '@claude-mem/shared';
import { mikroOrm } from '@claude-mem/database';
import type {
  HubRecord,
  CreateHubInput,
  UpdateHubInput,
  HubHealthUpdate,
  HubType,
  HubStatus,
} from '@claude-mem/types';

// Import types and values from the mikroOrm namespace
type SqlEntityManager = mikroOrm.SqlEntityManager;
type HubType_ = InstanceType<typeof mikroOrm.Hub>;
const Hub = mikroOrm.Hub;

const logger = createLogger('hub-registry');

// Built-in hub ID (constant across restarts)
export const BUILTIN_HUB_ID = 'builtin-hub';
export const BUILTIN_HUB_NAME = 'Local Hub';

export class HubRegistry {
  constructor(private readonly em: SqlEntityManager) {}

  /**
   * Initialize the hub registry (called on backend startup)
   * Creates the built-in hub if it doesn't exist
   */
  async initialize(): Promise<HubType_> {
    let builtinHub = await this.em.findOne(Hub, { id: BUILTIN_HUB_ID });

    if (!builtinHub) {
      builtinHub = new Hub();
      builtinHub.id = BUILTIN_HUB_ID;
      builtinHub.name = BUILTIN_HUB_NAME;
      builtinHub.type = 'builtin';
      builtinHub.priority = 100; // Built-in hub has highest priority
      builtinHub.weight = 100;
      builtinHub.status = 'healthy';
      builtinHub.created_at = new Date();
      builtinHub.last_heartbeat = new Date();
      this.em.persist(builtinHub);
      await this.em.flush();
      logger.info('Created built-in hub');
    } else {
      // Update status on restart
      builtinHub.status = 'healthy';
      builtinHub.last_heartbeat = new Date();
      await this.em.flush();
      logger.info('Restored built-in hub');
    }

    return builtinHub;
  }

  /**
   * Register a new external hub
   */
  async registerHub(input: CreateHubInput): Promise<HubType_> {
    const hub = new Hub();
    hub.id = randomUUID();
    hub.name = input.name;
    hub.type = input.type || 'external';
    hub.endpoint = input.endpoint;
    hub.priority = input.priority ?? 50;
    hub.weight = input.weight ?? 100;
    hub.region = input.region;
    hub.labels = input.labels;
    hub.status = 'healthy';
    hub.created_at = new Date();
    hub.last_heartbeat = new Date();

    this.em.persist(hub);
    await this.em.flush();

    logger.info(`Registered external hub: ${hub.name} (${hub.id})`);
    return hub;
  }

  /**
   * Update a hub's configuration
   */
  async updateHub(id: string, input: UpdateHubInput): Promise<HubType_ | null> {
    const hub = await this.em.findOne(Hub, { id });
    if (!hub) {
      return null;
    }

    if (input.name !== undefined) hub.name = input.name;
    if (input.priority !== undefined) hub.priority = input.priority;
    if (input.weight !== undefined) hub.weight = input.weight;
    if (input.region !== undefined) hub.region = input.region;
    if (input.labels !== undefined) hub.labels = input.labels;
    if (input.status !== undefined) hub.status = input.status;

    await this.em.flush();
    logger.debug(`Updated hub: ${hub.name}`);
    return hub;
  }

  /**
   * Update a hub's health status
   */
  async updateHubHealth(id: string, health: HubHealthUpdate): Promise<void> {
    const hub = await this.em.findOne(Hub, { id });
    if (!hub) {
      logger.warn(`Hub not found for health update: ${id}`);
      return;
    }

    hub.status = health.status;
    hub.connected_workers = health.connectedWorkers;
    hub.active_workers = health.activeWorkers;
    hub.avg_latency_ms = health.avgLatencyMs;
    hub.last_heartbeat = new Date();
    if (health.capabilities) {
      hub.capabilities = health.capabilities;
    }

    await this.em.flush();
  }

  /**
   * Remove a hub (only external hubs can be removed)
   */
  async removeHub(id: string): Promise<boolean> {
    if (id === BUILTIN_HUB_ID) {
      logger.warn('Cannot remove built-in hub');
      return false;
    }

    const hub = await this.em.findOne(Hub, { id });
    if (!hub) {
      return false;
    }

    this.em.remove(hub);
    await this.em.flush();
    logger.info(`Removed hub: ${hub.name}`);
    return true;
  }

  /**
   * Get a hub by ID
   */
  async getHub(id: string): Promise<HubType_ | null> {
    return this.em.findOne(Hub, { id });
  }

  /**
   * Get the built-in hub
   */
  async getBuiltinHub(): Promise<HubType_ | null> {
    return this.em.findOne(Hub, { id: BUILTIN_HUB_ID });
  }

  /**
   * List all hubs
   */
  async listHubs(): Promise<HubType_[]> {
    return this.em.find(Hub, {}, { orderBy: { priority: 'DESC', name: 'ASC' } });
  }

  /**
   * Get healthy hubs (optionally filtered by capability)
   */
  async getHealthyHubs(capability?: string): Promise<HubType_[]> {
    const hubs = await this.em.find(
      Hub,
      { status: { $ne: 'offline' } },
      { orderBy: { priority: 'DESC' } }
    );

    if (!capability) {
      return hubs;
    }

    // Filter by capability
    return hubs.filter((hub) => {
      if (!hub.capabilities) return true; // No restriction
      return hub.capabilities.includes(capability);
    });
  }

  /**
   * Get hubs by region
   */
  async getHubsByRegion(region: string): Promise<HubType_[]> {
    return this.em.find(
      Hub,
      { region, status: { $ne: 'offline' } },
      { orderBy: { priority: 'DESC' } }
    );
  }

  /**
   * Get hubs by labels
   */
  async getHubsByLabels(labels: Record<string, string>): Promise<HubType_[]> {
    const hubs = await this.em.find(Hub, { status: { $ne: 'offline' } });

    return hubs.filter((hub) => {
      if (!hub.labels) return false;
      return Object.entries(labels).every(([key, value]) => hub.labels![key] === value);
    });
  }

  /**
   * Convert entity to record
   */
  toRecord(hub: HubType_): HubRecord {
    return {
      id: hub.id,
      name: hub.name,
      type: hub.type as HubType,
      endpoint: hub.endpoint,
      priority: hub.priority,
      weight: hub.weight,
      region: hub.region,
      labels: hub.labels,
      capabilities: hub.capabilities,
      status: hub.status as HubStatus,
      connectedWorkers: hub.connected_workers,
      activeWorkers: hub.active_workers,
      avgLatencyMs: hub.avg_latency_ms,
      createdAt: hub.created_at,
      lastHeartbeat: hub.last_heartbeat,
    };
  }
}

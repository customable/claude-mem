/**
 * Hub Federation Types (Issue #263)
 *
 * Types for WorkerHub federation, token-based authentication,
 * and distributed worker pool management.
 */

// ============================================================================
// Token Types
// ============================================================================

export type TokenScope = 'instance' | 'group' | 'project';

export interface WorkerTokenRecord {
  id: string;
  name: string;
  tokenPrefix: string; // "cmwt-abc" for display (never expose full hash)
  scope: TokenScope;
  hubId?: string;
  projectFilter?: string;
  capabilities?: string[];
  labels?: Record<string, string>;
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
  revokedAt?: Date;
}

export interface CreateTokenInput {
  name: string;
  scope?: TokenScope;
  hubId?: string;
  projectFilter?: string;
  capabilities?: string[];
  labels?: Record<string, string>;
  expiresAt?: Date;
}

export interface CreateTokenResult {
  token: WorkerTokenRecord;
  plainToken: string; // Only returned once on creation
}

// ============================================================================
// Worker Registration Types
// ============================================================================

export type RegistrationStatus = 'online' | 'offline';

export interface WorkerRegistrationRecord {
  id: string;
  tokenId: string;
  systemId: string;
  hostname?: string;
  workerId?: string;
  labels?: Record<string, string>;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
  status: RegistrationStatus;
  connectedAt: Date;
  disconnectedAt?: Date;
  lastHeartbeat?: Date;
}

// ============================================================================
// Hub Types
// ============================================================================

export type HubType = 'builtin' | 'external';
export type HubStatus = 'healthy' | 'degraded' | 'unhealthy' | 'offline';

export interface HubRecord {
  id: string;
  name: string;
  type: HubType;
  endpoint?: string;
  priority: number;
  weight: number;
  region?: string;
  labels?: Record<string, string>;
  capabilities?: string[];
  status: HubStatus;
  connectedWorkers: number;
  activeWorkers: number;
  avgLatencyMs?: number;
  createdAt: Date;
  lastHeartbeat?: Date;
}

export interface CreateHubInput {
  name: string;
  type?: HubType;
  endpoint?: string;
  priority?: number;
  weight?: number;
  region?: string;
  labels?: Record<string, string>;
}

export interface UpdateHubInput {
  name?: string;
  priority?: number;
  weight?: number;
  region?: string;
  labels?: Record<string, string>;
  status?: HubStatus;
}

export interface HubHealthUpdate {
  status: HubStatus;
  connectedWorkers: number;
  activeWorkers: number;
  avgLatencyMs?: number;
  capabilities?: string[];
}

// ============================================================================
// Routing Types
// ============================================================================

export type RoutingStrategy = 'priority' | 'weighted' | 'round-robin' | 'least-loaded';

export interface TaskRoutingRule {
  capability: string;
  preferHubs?: string[];
  preferTags?: string[];
  preferRegion?: string;
  strategy: RoutingStrategy;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface TokenListResponse {
  tokens: WorkerTokenRecord[];
  total: number;
}

export interface TokenDetailResponse extends WorkerTokenRecord {
  registrations: WorkerRegistrationRecord[];
}

export interface HubListResponse {
  hubs: HubRecord[];
  total: number;
}

export interface HubDetailResponse extends HubRecord {
  workers: WorkerRegistrationRecord[];
}

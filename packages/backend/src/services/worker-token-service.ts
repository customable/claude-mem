/**
 * Worker Token Service (Issue #263)
 *
 * Manages worker authentication tokens following GitLab/Forgejo runner patterns.
 * Tokens can be created, validated, and revoked.
 */

import { randomUUID, createHash, randomBytes } from 'node:crypto';
import { createLogger } from '@claude-mem/shared';
import { mikroOrm } from '@claude-mem/database';

// Import types and values from the mikroOrm namespace
type SqlEntityManager = mikroOrm.SqlEntityManager;
type WorkerTokenType = InstanceType<typeof mikroOrm.WorkerToken>;
type WorkerRegistrationType = InstanceType<typeof mikroOrm.WorkerRegistration>;
const WorkerToken = mikroOrm.WorkerToken;
const WorkerRegistration = mikroOrm.WorkerRegistration;
import type {
  CreateTokenInput,
  CreateTokenResult,
  WorkerTokenRecord,
  WorkerRegistrationRecord,
  TokenScope,
} from '@claude-mem/types';

const logger = createLogger('worker-token-service');

// Token prefix for easy identification
const TOKEN_PREFIX = 'cmwt';

/**
 * Hash a token using SHA-256
 * Note: For production, consider using bcrypt for proper password hashing
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a secure random token
 */
function generateToken(): string {
  const random = randomBytes(24).toString('base64url');
  return `${TOKEN_PREFIX}-${random}`;
}

/**
 * Extract the displayable prefix from a token
 */
function getTokenPrefix(token: string): string {
  return token.substring(0, 12);
}

export class WorkerTokenService {
  constructor(private readonly em: SqlEntityManager) {}

  /**
   * Create a new worker token
   */
  async createToken(input: CreateTokenInput): Promise<CreateTokenResult> {
    const plainToken = generateToken();
    const tokenHash = hashToken(plainToken);
    const tokenPrefix = getTokenPrefix(plainToken);

    const token = new WorkerToken();
    token.id = randomUUID();
    token.name = input.name;
    token.token_hash = tokenHash;
    token.token_prefix = tokenPrefix;
    token.scope = input.scope || 'instance';
    token.hub_id = input.hubId;
    token.project_filter = input.projectFilter;
    token.capabilities = input.capabilities;
    token.labels = input.labels;
    token.created_at = new Date();
    token.expires_at = input.expiresAt;

    this.em.persist(token);
    await this.em.flush();

    logger.info(`Created worker token: ${token.name} (${tokenPrefix}...)`);

    return {
      token: this.toRecord(token),
      plainToken, // Only returned once!
    };
  }

  /**
   * Validate a token and return the token record if valid
   */
  async validateToken(plainToken: string): Promise<WorkerTokenType | null> {
    if (!plainToken.startsWith(TOKEN_PREFIX)) {
      return null;
    }

    const tokenHash = hashToken(plainToken);
    const token = await this.em.findOne(WorkerToken, { token_hash: tokenHash });

    if (!token) {
      return null;
    }

    // Check if revoked
    if (token.revoked_at) {
      logger.debug(`Token ${token.token_prefix}... is revoked`);
      return null;
    }

    // Check if expired
    if (token.expires_at && token.expires_at < new Date()) {
      logger.debug(`Token ${token.token_prefix}... is expired`);
      return null;
    }

    // Update last used
    token.last_used_at = new Date();
    await this.em.flush();

    return token;
  }

  /**
   * Revoke a token by ID
   */
  async revokeToken(id: string): Promise<boolean> {
    const token = await this.em.findOne(WorkerToken, { id });
    if (!token) {
      return false;
    }

    token.revoked_at = new Date();
    await this.em.flush();

    logger.info(`Revoked worker token: ${token.name} (${token.token_prefix}...)`);
    return true;
  }

  /**
   * List all tokens (without hashes)
   */
  async listTokens(): Promise<WorkerTokenRecord[]> {
    const tokens = await this.em.find(WorkerToken, {}, { orderBy: { created_at: 'DESC' } });
    return tokens.map((t) => this.toRecord(t));
  }

  /**
   * Get a token by ID
   */
  async getToken(id: string): Promise<WorkerTokenRecord | null> {
    const token = await this.em.findOne(WorkerToken, { id });
    return token ? this.toRecord(token) : null;
  }

  /**
   * Get workers using a token
   */
  async getTokenWorkers(tokenId: string): Promise<WorkerRegistrationRecord[]> {
    const registrations = await this.em.find(
      WorkerRegistration,
      { token: { id: tokenId } },
      { orderBy: { connected_at: 'DESC' } }
    );
    return registrations.map((r) => this.registrationToRecord(r));
  }

  /**
   * Create or update a worker registration
   */
  async registerWorker(
    tokenId: string,
    systemId: string,
    data: {
      hostname?: string;
      workerId?: string;
      labels?: Record<string, string>;
      capabilities?: string[];
      metadata?: Record<string, unknown>;
    }
  ): Promise<WorkerRegistrationType> {
    // Find existing registration by system_id
    let registration = await this.em.findOne(WorkerRegistration, { system_id: systemId });

    if (registration) {
      // Update existing
      registration.worker_id = data.workerId;
      registration.labels = data.labels;
      registration.capabilities = data.capabilities;
      registration.metadata = data.metadata;
      registration.status = 'online';
      registration.last_heartbeat = new Date();
    } else {
      // Create new
      const token = await this.em.findOneOrFail(WorkerToken, { id: tokenId });
      registration = new WorkerRegistration();
      registration.id = randomUUID();
      registration.setToken(token);
      registration.system_id = systemId;
      registration.hostname = data.hostname;
      registration.worker_id = data.workerId;
      registration.labels = data.labels;
      registration.capabilities = data.capabilities;
      registration.metadata = data.metadata;
      registration.status = 'online';
      registration.connected_at = new Date();
      registration.last_heartbeat = new Date();
      this.em.persist(registration);
    }

    await this.em.flush();
    return registration;
  }

  /**
   * Mark a worker as disconnected
   */
  async disconnectWorker(systemId: string): Promise<void> {
    const registration = await this.em.findOne(WorkerRegistration, { system_id: systemId });
    if (registration) {
      registration.status = 'offline';
      registration.disconnected_at = new Date();
      await this.em.flush();
    }
  }

  /**
   * Update worker heartbeat
   */
  async updateHeartbeat(systemId: string): Promise<void> {
    const registration = await this.em.findOne(WorkerRegistration, { system_id: systemId });
    if (registration) {
      registration.last_heartbeat = new Date();
      await this.em.flush();
    }
  }

  /**
   * Get all online workers for a token
   */
  async getOnlineWorkers(tokenId: string): Promise<WorkerRegistrationType[]> {
    return this.em.find(WorkerRegistration, {
      token: { id: tokenId },
      status: 'online',
    });
  }

  /**
   * Convert entity to record (without sensitive data)
   */
  private toRecord(token: WorkerTokenType): WorkerTokenRecord {
    return {
      id: token.id,
      name: token.name,
      tokenPrefix: token.token_prefix,
      scope: token.scope as TokenScope,
      hubId: token.hub_id,
      projectFilter: token.project_filter,
      capabilities: token.capabilities,
      labels: token.labels,
      createdAt: token.created_at,
      expiresAt: token.expires_at,
      lastUsedAt: token.last_used_at,
      revokedAt: token.revoked_at,
    };
  }

  /**
   * Convert registration entity to record
   */
  private registrationToRecord(reg: WorkerRegistrationType): WorkerRegistrationRecord {
    return {
      id: reg.id,
      tokenId: reg.token.id,
      systemId: reg.system_id,
      hostname: reg.hostname,
      workerId: reg.worker_id,
      labels: reg.labels,
      capabilities: reg.capabilities,
      metadata: reg.metadata,
      status: reg.status,
      connectedAt: reg.connected_at,
      disconnectedAt: reg.disconnected_at,
      lastHeartbeat: reg.last_heartbeat,
    };
  }
}

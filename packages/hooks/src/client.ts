/**
 * Backend Client
 *
 * HTTP client for communicating with the backend API.
 * Handles health checks, auth, and graceful degradation.
 * Queues events offline when backend is unavailable (Issue #253).
 */

import {
  loadSettings,
  HOOK_TIMEOUTS,
  getTimeout,
  getOfflineQueue,
  createLogger,
  type OfflineQueue,
} from '@claude-mem/shared';

const logger = createLogger('backend-client');

/**
 * Backend client configuration
 */
export interface BackendClientConfig {
  /** Backend URL (defaults to settings) */
  baseUrl?: string;
  /** Auth token for remote mode */
  authToken?: string;
  /** Request timeout in ms */
  timeout?: number;
}

/**
 * Backend client for hook-to-backend communication
 */
export class BackendClient {
  private readonly baseUrl: string;
  private readonly authToken: string;
  private readonly timeout: number;
  private readonly offlineQueue: OfflineQueue;
  private syncInProgress = false;

  constructor(config: BackendClientConfig = {}) {
    this.offlineQueue = getOfflineQueue();
    const settings = loadSettings();

    // Build base URL
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    } else if (settings.REMOTE_MODE && settings.REMOTE_URL) {
      this.baseUrl = settings.REMOTE_URL;
    } else {
      const host = settings.BACKEND_HOST || '127.0.0.1';
      const port = settings.BACKEND_PORT || 37777;
      this.baseUrl = `http://${this.formatHost(host)}:${port}`;
    }

    this.authToken = config.authToken || settings.REMOTE_TOKEN || '';
    this.timeout = config.timeout || getTimeout(HOOK_TIMEOUTS.DEFAULT);
  }

  /**
   * Format host for URL (handle IPv6)
   */
  private formatHost(host: string): string {
    if (host.includes(':') && !host.startsWith('[')) {
      return `[${host}]`;
    }
    return host;
  }

  /**
   * Check if core systems are ready (fast check)
   */
  async isCoreReady(timeout = getTimeout(HOOK_TIMEOUTS.HEALTH_CHECK)): Promise<boolean> {
    try {
      const response = await this.fetch('/api/health', { timeout });
      if (!response.ok) return false;
      const data = await response.json() as { coreReady?: boolean };
      return data.coreReady === true;
    } catch {
      return false;
    }
  }

  /**
   * GET request
   */
  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const response = await this.fetch(url.pathname + url.search);
    if (!response.ok) {
      throw new Error(`GET ${path} failed: ${response.status}`);
    }
    return await response.json() as Promise<T>;
  }

  /**
   * POST request
   */
  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await this.fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`POST ${path} failed: ${response.status}`);
    }
    return await response.json() as Promise<T>;
  }

  /**
   * POST request with offline fallback (Issue #253)
   * If backend is unavailable, queues the request for later sync.
   *
   * @param path API path
   * @param body Request body
   * @param eventType Event type for queue (e.g., 'hook:user-prompt-submit')
   * @returns Response or null if queued
   */
  async postWithFallback<T>(
    path: string,
    body: unknown,
    eventType: string
  ): Promise<{ data: T | null; queued: boolean }> {
    try {
      // Try to sync any pending queue items first
      await this.syncQueue();

      // Make the request
      const data = await this.post<T>(path, body);
      return { data, queued: false };
    } catch (error) {
      // Queue for later
      const id = this.offlineQueue.enqueue(eventType, { path, body });
      logger.info(`Request queued offline: ${eventType}`, { id, path });
      return { data: null, queued: true };
    }
  }

  /**
   * Sync offline queue with backend (Issue #253)
   * Attempts to replay queued requests when backend is available.
   */
  async syncQueue(): Promise<{ synced: number; failed: number }> {
    if (this.syncInProgress) return { synced: 0, failed: 0 };
    if (this.offlineQueue.isEmpty()) return { synced: 0, failed: 0 };

    this.syncInProgress = true;
    let synced = 0;
    let failed = 0;

    try {
      // Check if backend is available
      const isReady = await this.isCoreReady();
      if (!isReady) {
        return { synced, failed };
      }

      // Process queue entries (oldest first)
      const entries = this.offlineQueue.peek(50); // Process in batches
      const successIds: string[] = [];
      const failedIds: string[] = [];

      for (const entry of entries) {
        try {
          const payload = entry.payload as { path: string; body: unknown };
          await this.post(payload.path, payload.body);
          successIds.push(entry.id);
          synced++;
        } catch {
          failedIds.push(entry.id);
          failed++;
        }
      }

      // Remove successful entries
      this.offlineQueue.remove(successIds);

      // Mark failed entries for retry
      const exceeded = this.offlineQueue.markRetried(failedIds);
      if (exceeded.length > 0) {
        logger.warn(`${exceeded.length} queue entries exceeded max retries`);
      }

      if (synced > 0) {
        logger.info(`Queue sync completed`, { synced, failed });
      }

      return { synced, failed };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.offlineQueue.size();
  }

  /**
   * Internal fetch with auth and timeout
   */
  private async fetch(
    path: string,
    options: RequestInit & { timeout?: number } = {}
  ): Promise<Response> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const timeout = options.timeout || this.timeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
      };

      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// Singleton instance
let _client: BackendClient | null = null;

/**
 * Get the global backend client
 */
export function getBackendClient(): BackendClient {
  if (!_client) {
    _client = new BackendClient();
  }
  return _client;
}

/**
 * Reset the global client (for testing)
 */
export function resetBackendClient(): void {
  _client = null;
}

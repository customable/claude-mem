/**
 * Backend Client
 *
 * HTTP client for communicating with the backend API.
 * Handles health checks, auth, and graceful degradation.
 */

import { loadSettings, createLogger, HOOK_TIMEOUTS, getTimeout } from '@claude-mem/shared';

const logger = createLogger('hooks-client');

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

  constructor(config: BackendClientConfig = {}) {
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
   * Check if backend is ready
   */
  async isReady(timeout = getTimeout(HOOK_TIMEOUTS.HEALTH_CHECK)): Promise<boolean> {
    try {
      const response = await this.fetch('/api/readiness', { timeout });
      return response.ok;
    } catch {
      return false;
    }
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
    return response.json() as Promise<T>;
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
    return response.json() as Promise<T>;
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

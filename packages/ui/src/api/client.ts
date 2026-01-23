/**
 * API Client
 *
 * HTTP client for communicating with the backend.
 */

const BASE_URL = '/api';

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * GET request
 */
export function get<T>(path: string): Promise<T> {
  return fetchApi<T>(path);
}

/**
 * POST request
 */
export function post<T>(path: string, body: unknown): Promise<T> {
  return fetchApi<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * DELETE request
 */
export function del<T>(path: string): Promise<T> {
  return fetchApi<T>(path, { method: 'DELETE' });
}

// ============================================
// API Types
// ============================================

export interface Session {
  id: string;
  project: string;
  status: string;
  createdAt: string;
  observationCount: number;
}

export interface Observation {
  id: number;
  memory_session_id: string;
  project: string;
  type: string;
  title: string;
  subtitle?: string;
  text: string | null;
  narrative?: string;
  facts?: string; // JSON array string
  concepts?: string; // JSON array string
  files_read?: string; // JSON array string
  files_modified?: string; // JSON array string
  prompt_number?: number;
  created_at: string;
  created_at_epoch?: number;
  discovery_tokens?: number;
  git_branch?: string;
}

export interface Worker {
  id: string;
  capabilities: string[];
  connectedAt: number;
  lastHeartbeat: number;
  currentTaskId: string | null;
}

export interface Stats {
  sessions: number;
  observations: number;
  tasks: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  coreReady: boolean;
  initialized: boolean;
  workers: {
    connected: number;
  };
}

// ============================================
// API Functions
// ============================================

export const api = {
  // Health
  getHealth: () => get<HealthStatus>('/health'),

  // Stats
  getStats: () => get<{ data: Stats }>('/data/stats'),

  // Sessions
  getSessions: (params?: { limit?: number; offset?: number }) => {
    const query = params ? `?limit=${params.limit || 50}&offset=${params.offset || 0}` : '';
    return get<{ data: Session[]; total: number }>(`/data/sessions${query}`);
  },
  getSession: (id: string) => get<Session>(`/data/sessions/${id}`),
  deleteSession: (id: string) => del<void>(`/data/sessions/${id}`),

  // Observations
  getObservations: (params?: { limit?: number; offset?: number; project?: string }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.project) query.set('project', params.project);
    const queryStr = query.toString();
    return get<{ data: Observation[]; total: number }>(`/data/observations${queryStr ? '?' + queryStr : ''}`);
  },
  getObservation: (id: number) => get<Observation>(`/data/observations/${id}`),

  // Workers
  getWorkers: () => get<{ data: Worker[]; total: number }>('/workers'),
  getWorkerStats: () => get<{ totalConnected: number }>('/workers/stats'),
};

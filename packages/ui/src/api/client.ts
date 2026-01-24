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
  id: number;
  content_session_id: string;
  memory_session_id: string;
  project: string;
  user_prompt: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  observation_count: number;
  prompt_count: number;
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

export interface Summary {
  id: number;
  memory_session_id: string;
  project: string;
  request: string | null;
  investigated: string | null;
  learned: string | null;
  completed: string | null;
  next_steps: string | null;
  created_at: string;
  created_at_epoch: number;
  prompt_number?: number;
  discovery_tokens?: number;
}

export interface UserPrompt {
  id: number;
  content_session_id: string;
  prompt_number: number;
  prompt_text: string;
  created_at: string;
  created_at_epoch: number;
}

export interface Worker {
  id: string;
  capabilities: string[];
  connectedAt: number;
  lastHeartbeat: number;
  currentTaskId: string | null;
  currentTaskType: string | null;
  pendingTermination?: boolean;
  metadata?: {
    spawnedId?: string;
    version?: string;
    hostname?: string;
    agent?: string;
  };
}

export interface SpawnedWorker {
  id: string;
  pid: number;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed';
  spawnedAt: number;
  connectedWorkerId?: string;
  pendingTermination?: boolean;
}

export interface SpawnStatus {
  available: boolean;
  reason?: string | null;
  spawnedCount: number;
  maxWorkers: number;
  canSpawnMore: boolean;
}

export interface Stats {
  sessions: number;
  observations: number;
  summaries: number;
  projects: number;
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
  getHealth: () => get<HealthStatus & { version?: string }>('/health'),

  // Stats
  getStats: () => get<Stats>('/data/stats'),

  // Projects
  getProjects: () => get<{ projects: string[] }>('/data/projects').catch(() => ({ projects: [] })),

  // Sessions
  getSessions: (params?: Record<string, string | number>) => {
    const query = new URLSearchParams();
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        query.set(key, String(val));
      }
    }
    const queryStr = query.toString();
    return get<{ data: Session[]; total: number; items?: Session[] }>(`/data/sessions${queryStr ? '?' + queryStr : ''}`).then(res => ({
      items: res.data || res.items || [],
      total: res.total,
    }));
  },
  getSession: (id: string) => get<Session>(`/data/sessions/${id}`),
  deleteSession: (id: string) => del<void>(`/data/sessions/${id}`),

  // Observations
  getObservations: (params?: Record<string, string | number>) => {
    const query = new URLSearchParams();
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        query.set(key, String(val));
      }
    }
    const queryStr = query.toString();
    return get<{ data: Observation[]; total: number; items?: Observation[] }>(`/data/observations${queryStr ? '?' + queryStr : ''}`).then(res => ({
      items: res.data || res.items || [],
      total: res.total,
    }));
  },
  getObservation: (id: number) => get<Observation>(`/data/observations/${id}`),
  deleteObservation: (id: number) => del<void>(`/data/observations/${id}`),
  bulkDeleteObservations: (params: { project?: string; sessionId?: string; before?: string; ids?: number[] }) => {
    const query = new URLSearchParams();
    if (params.project) query.set('project', params.project);
    if (params.sessionId) query.set('sessionId', params.sessionId);
    if (params.before) query.set('before', params.before);
    if (params.ids) query.set('ids', params.ids.join(','));
    return del<{ deleted: number }>(`/data/observations?${query.toString()}`);
  },

  // Summaries
  getSessionSummaries: (sessionId: string) =>
    get<{ data: Summary[] }>(`/data/sessions/${sessionId}/summaries`).then(res => ({
      items: res.data || [],
    })),

  // User Prompts
  getSessionPrompts: (sessionId: string) =>
    get<{ data: UserPrompt[] }>(`/data/sessions/${sessionId}/prompts`).then(res => ({
      items: res.data || [],
    })),

  // Search
  search: (params: { query: string; project?: string; type?: string; limit?: number }) => {
    const queryParams = new URLSearchParams();
    queryParams.set('query', params.query);
    if (params.project) queryParams.set('project', params.project);
    if (params.type) queryParams.set('type', params.type);
    if (params.limit) queryParams.set('limit', String(params.limit));
    return get<{ items: Observation[]; total: number; query: string }>(`/search?${queryParams}`);
  },
  searchSemantic: (params: { query: string; project?: string; limit?: number }) => {
    const queryParams = new URLSearchParams();
    queryParams.set('query', params.query);
    if (params.project) queryParams.set('project', params.project);
    if (params.limit) queryParams.set('limit', String(params.limit));
    return get<{ items: Observation[]; total: number; query: string; mode: string }>(`/search/semantic?${queryParams}`);
  },

  // Workers
  getWorkers: () => get<{ data: Worker[]; total: number }>('/workers'),
  getWorkerStats: () => get<{ totalConnected: number }>('/workers/stats'),
  getSpawnStatus: () => get<SpawnStatus>('/workers/spawn-status'),
  getSpawnedWorkers: () => get<{ data: SpawnedWorker[]; canSpawn: boolean; maxWorkers: number }>('/workers/spawned'),
  spawnWorker: () => post<{ id: string; pid: number; message: string }>('/workers/spawn', {}),
  terminateWorker: (id: string) => del<{ message: string; queued?: boolean; reason?: string }>(`/workers/spawned/${id}`),

  // Settings
  getSettings: () => get<Record<string, unknown>>('/settings'),
  saveSettings: (settings: Record<string, unknown>) => post<{ success: boolean }>('/settings', settings),

  // Analytics
  getAnalyticsTimeline: (params?: { period?: string; project?: string; days?: number }) => {
    const query = new URLSearchParams();
    if (params?.period) query.set('period', params.period);
    if (params?.project) query.set('project', params.project);
    if (params?.days) query.set('days', String(params.days));
    const queryStr = query.toString();
    return get<{
      data: Array<{ date: string; observations: number; sessions: number; tokens: number }>;
      period: string;
      days: number;
    }>(`/data/analytics/timeline${queryStr ? '?' + queryStr : ''}`);
  },
  getAnalyticsTypes: (params?: { project?: string }) => {
    const query = new URLSearchParams();
    if (params?.project) query.set('project', params.project);
    const queryStr = query.toString();
    return get<{ data: Array<{ type: string; count: number }> }>(
      `/data/analytics/types${queryStr ? '?' + queryStr : ''}`
    );
  },
  getAnalyticsProjects: () =>
    get<{ data: Array<{ project: string; observations: number; sessions: number; tokens: number }> }>(
      '/data/analytics/projects'
    ),

  // Project Details
  getProjectStats: (project: string) =>
    get<{
      sessions: number;
      observations: number;
      summaries: number;
      tokens: number;
      firstActivity: number | null;
      lastActivity: number | null;
    }>(`/data/projects/${encodeURIComponent(project)}/stats`),
  getProjectFiles: (project: string) =>
    get<{
      filesRead: Array<{ path: string; count: number }>;
      filesModified: Array<{ path: string; count: number }>;
    }>(`/data/projects/${encodeURIComponent(project)}/files`),

  // Logs
  getLogs: (params?: { level?: string; context?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.level) query.set('level', params.level);
    if (params?.context) query.set('context', params.context);
    if (params?.limit) query.set('limit', String(params.limit));
    const queryStr = query.toString();
    return get<{ entries: Array<{ timestamp: number; level: string; context: string; message: string; data?: unknown }> }>(`/logs${queryStr ? '?' + queryStr : ''}`);
  },
};

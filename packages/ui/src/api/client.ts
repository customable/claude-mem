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

// Insights types
export interface InsightsSummary {
  totalObservations: number;
  totalSessions: number;
  totalProjects: number;
  totalDecisions: number;
  totalTokens: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
}

export interface DailyStatsRecord {
  id: number;
  date: string;
  observation_count: number;
  session_count: number;
  project_count: number;
  decision_count: number;
  error_count: number;
  bug_fix_count: number;
  discovery_count: number;
  tokens_used: number;
  technologies: string | null;
  projects: string | null;
  created_at_epoch: number;
}

export interface TechnologyUsageRecord {
  id: number;
  name: string;
  category: string | null;
  first_seen_epoch: number;
  last_used_epoch: number;
  observation_count: number;
  project: string | null;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'activity' | 'learning' | 'milestone' | 'streak' | 'special';
  threshold?: number;
}

export interface AchievementProgress {
  definition: AchievementDefinition;
  progress: number;
  unlocked: boolean;
  unlockedAt?: number;
}

export type DocumentType =
  | 'library-docs'
  | 'web-content'
  | 'api-reference'
  | 'code-example'
  | 'tutorial'
  | 'custom';

export interface Document {
  id: number;
  project: string;
  source: string;
  source_tool: string;
  title: string | null;
  content: string;
  content_hash: string;
  type: DocumentType;
  metadata: string | null;
  memory_session_id: string | null;
  observation_id: number | null;
  access_count: number;
  last_accessed_epoch: number;
  created_at: string;
  created_at_epoch: number;
}

export interface CodeSnippet {
  id: number;
  observation_id: number;
  memory_session_id: string;
  project: string;
  language: string | null;
  code: string;
  file_path: string | null;
  line_start: number | null;
  line_end: number | null;
  context: string | null;
  created_at_epoch: number;
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

  // Documents
  getDocuments: (params?: Record<string, string | number>) => {
    const query = new URLSearchParams();
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        query.set(key, String(val));
      }
    }
    const queryStr = query.toString();
    return get<{ data: Document[]; total: number }>(`/data/documents${queryStr ? '?' + queryStr : ''}`).then(res => ({
      items: res.data || [],
      total: res.total,
    }));
  },
  getDocument: (id: number) => get<Document>(`/data/documents/${id}`),
  searchDocuments: (params: { q: string; project?: string; type?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    query.set('q', params.q);
    if (params.project) query.set('project', params.project);
    if (params.type) query.set('type', params.type);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    return get<{ data: Document[]; query: string }>(`/data/documents/search?${query.toString()}`).then(res => ({
      items: res.data || [],
      query: res.query,
    }));
  },
  deleteDocument: (id: number) => del<void>(`/data/documents/${id}`),

  // Code Snippets
  getCodeSnippets: (params?: { project?: string; language?: string; sessionId?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params) {
      if (params.project) query.set('project', params.project);
      if (params.language) query.set('language', params.language);
      if (params.sessionId) query.set('sessionId', params.sessionId);
      if (params.limit) query.set('limit', String(params.limit));
      if (params.offset) query.set('offset', String(params.offset));
    }
    const queryStr = query.toString();
    return get<{ data: CodeSnippet[] }>(`/data/code-snippets${queryStr ? '?' + queryStr : ''}`).then(res => ({
      items: res.data || [],
    }));
  },
  getCodeSnippet: (id: number) => get<CodeSnippet>(`/data/code-snippets/${id}`),
  getObservationCodeSnippets: (observationId: number) =>
    get<{ data: CodeSnippet[] }>(`/data/observations/${observationId}/code-snippets`).then(res => res.data || []),
  searchCodeSnippets: (params: { q: string; project?: string; language?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    query.set('q', params.q);
    if (params.project) query.set('project', params.project);
    if (params.language) query.set('language', params.language);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    return get<{ data: CodeSnippet[]; query: string }>(`/data/code-snippets/search?${query.toString()}`).then(res => ({
      items: res.data || [],
      query: res.query,
    }));
  },
  getCodeSnippetLanguages: (project?: string) => {
    const query = new URLSearchParams();
    if (project) query.set('project', project);
    const queryStr = query.toString();
    return get<{ data: string[] }>(`/data/code-snippets/languages${queryStr ? '?' + queryStr : ''}`).then(res => res.data || []);
  },
  deleteCodeSnippet: (id: number) => del<void>(`/data/code-snippets/${id}`),

  // Insights
  getInsightsSummary: (days?: number) => {
    const query = days ? `?days=${days}` : '';
    return get<InsightsSummary>(`/insights/summary${query}`);
  },
  getInsightsActivity: (days?: number) => {
    const query = days ? `?days=${days}` : '';
    return get<DailyStatsRecord[]>(`/insights/activity${query}`);
  },
  getInsightsHeatmap: () => get<Array<{ date: string; count: number }>>('/insights/activity/heatmap'),
  getInsightsTechnologies: (params?: { limit?: number; project?: string }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.project) query.set('project', params.project);
    const queryStr = query.toString();
    return get<TechnologyUsageRecord[]>(`/insights/technologies${queryStr ? '?' + queryStr : ''}`);
  },
  getInsightsTechnologyCategories: () => get<string[]>('/insights/technologies/categories'),
  trackTechnology: (name: string, category?: string, project?: string) =>
    post<TechnologyUsageRecord>('/insights/technologies', { name, category, project }),
  getInsightsAchievements: () => get<AchievementProgress[]>('/insights/achievements'),
  checkAchievements: () =>
    post<{ checked: boolean; updated: number; achievements: AchievementProgress[] }>('/insights/achievements/check', {}),
};

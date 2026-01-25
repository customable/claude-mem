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

/**
 * PUT request
 */
export function put<T>(path: string, body: unknown): Promise<T> {
  return fetchApi<T>(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
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
  // Provider configuration (Issue #254)
  enabledProviders?: string[];
  defaultProvider?: string;
  // Auto-Spawn status (Issue #256)
  autoSpawnEnabled?: boolean;
  autoSpawnCount?: number;
  autoSpawnProviders?: string[];
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

export interface ProjectSettings {
  id: number;
  project: string;
  display_name?: string;
  description?: string;
  archived?: boolean;
  last_activity_epoch?: number;
  created_at_epoch: number;
  updated_at_epoch?: number;
}

// Endless Mode (Issue #109)
export type CompressionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export interface ArchivedOutput {
  id: number;
  session_id: string;
  project: string;
  tool_name: string;
  tool_input: string;
  tool_output: string;
  token_count: number;
  compression_status: CompressionStatus;
  compressed_observation_id?: number;
  compressed_token_count?: number;
  error_message?: string;
  created_at_epoch: number;
}

export interface ArchivedOutputStats {
  totalCount: number;
  pendingCount: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
  totalOriginalTokens: number;
  totalCompressedTokens: number;
  compressionRatio: number;
  avgCompressionRatio: number;
}

// User Tasks (Issue #260 - TodoList & PlanMode)
export type UserTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'more_info_needed'
  | 'ready_for_review'
  | 'completed'
  | 'cancelled';

export type UserTaskSource =
  | 'claude-code'
  | 'cursor'
  | 'aider'
  | 'copilot'
  | 'manual'
  | 'api';

export interface UserTask {
  id: number;
  externalId?: string;
  title: string;
  description?: string;
  activeForm?: string;
  status: UserTaskStatus;
  priority?: 'low' | 'medium' | 'high';
  project: string;
  sessionId?: string;
  parentTaskId?: number;
  source: UserTaskSource;
  sourceMetadata?: Record<string, unknown>;
  owner?: string;
  workingDirectory?: string;
  gitBranch?: string;
  affectedFiles?: string[];
  blockedBy?: string[];
  blocks?: string[];
  dueAtEpoch?: number;
  createdAtEpoch: number;
  updatedAtEpoch: number;
  completedAtEpoch?: number;
  costTokens?: number;
  costUsd?: number;
}

export interface UserTaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  blocked: number;
}

export type UserTaskCounts = Record<UserTaskStatus, number>;

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

export type TaskStatus = 'pending' | 'assigned' | 'processing' | 'completed' | 'failed' | 'timeout';
export type TaskType = 'observation' | 'summarize' | 'embedding' | 'claude-md' | 'cleanup';

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  requiredCapability: string;
  fallbackCapabilities?: string[];
  priority: number;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  retryCount: number;
  maxRetries: number;
  assignedWorkerId?: string;
  createdAt: number;
  assignedAt?: number;
  completedAt?: number;
  retryAfter?: number;
  deduplicationKey?: string;
}

export interface TaskCounts {
  pending: number;
  assigned: number;
  processing: number;
  completed: number;
  failed: number;
  timeout: number;
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
// Worker Tokens & Hub Federation (Issue #263)
// ============================================

export type TokenScope = 'instance' | 'group' | 'project';

export interface WorkerToken {
  id: string;
  name: string;
  tokenPrefix: string;
  scope: TokenScope;
  hubId?: string;
  projectFilter?: string;
  capabilities?: string[];
  labels?: Record<string, string>;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
  revokedAt?: string;
  registrationCount?: number;
}

export interface WorkerTokenCreateRequest {
  name: string;
  scope: TokenScope;
  hubId?: string;
  projectFilter?: string;
  capabilities?: string[];
  labels?: Record<string, string>;
  expiresAt?: string;
}

export interface WorkerTokenCreateResponse {
  token: string;
  id: string;
  prefix: string;
}

export interface WorkerRegistration {
  id: string;
  tokenId: string;
  systemId: string;
  hostname?: string;
  labels?: Record<string, string>;
  capabilities?: string[];
  status: 'online' | 'offline';
  connectedAt: string;
  disconnectedAt?: string;
  lastHeartbeat?: string;
}

export type HubType = 'builtin' | 'external';
export type HubStatus = 'healthy' | 'degraded' | 'unhealthy' | 'offline';

export interface Hub {
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
  createdAt: string;
  lastHeartbeat?: string;
}

export interface HubCreateRequest {
  name: string;
  endpoint?: string;
  priority?: number;
  weight?: number;
  region?: string;
  labels?: Record<string, string>;
  capabilities?: string[];
}

export interface HubStats {
  totalHubs: number;
  healthyHubs: number;
  totalWorkers: number;
  activeWorkers: number;
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
  spawnWorker: (config?: { provider?: string }) =>
    post<{ id: string; pid: number; message: string }>('/workers/spawn', config ?? {}),
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

  // Project Settings
  getProjectSettings: (project: string) =>
    get<ProjectSettings>(`/data/project-settings/${encodeURIComponent(project)}`),
  updateProjectSettings: (project: string, settings: Partial<ProjectSettings>) =>
    put<ProjectSettings>(`/data/project-settings/${encodeURIComponent(project)}`, settings),
  deleteProjectSettings: (project: string) =>
    del<void>(`/data/project-settings/${encodeURIComponent(project)}`),

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

  // Tasks
  getTasks: (params?: { status?: TaskStatus; type?: TaskType; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.type) query.set('type', params.type);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const queryStr = query.toString();
    return get<{ data: Task[]; total?: number }>(`/data/tasks${queryStr ? '?' + queryStr : ''}`).then(res => ({
      items: res.data || [],
      total: res.total || res.data?.length || 0,
    }));
  },
  getTask: (id: string) => get<Task>(`/data/tasks/${id}`),
  getTaskCounts: () => get<TaskCounts>('/data/tasks/status/counts'),
  // Retry a failed task (Issue #285)
  retryTask: (id: string) => post<void>(`/data/tasks/${id}/retry`, {}),

  // Archived Outputs - Endless Mode (Issue #109)
  getArchivedOutputs: (params?: { sessionId?: string; project?: string; status?: CompressionStatus; toolName?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.sessionId) query.set('sessionId', params.sessionId);
    if (params?.project) query.set('project', params.project);
    if (params?.status) query.set('status', params.status);
    if (params?.toolName) query.set('toolName', params.toolName);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const queryStr = query.toString();
    return get<{ data: ArchivedOutput[] }>(`/data/archived-outputs${queryStr ? '?' + queryStr : ''}`).then(res => res.data || []);
  },
  searchArchivedOutputs: (query: string, params?: { sessionId?: string; project?: string; toolName?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    searchParams.set('q', query);
    if (params?.sessionId) searchParams.set('sessionId', params.sessionId);
    if (params?.project) searchParams.set('project', params.project);
    if (params?.toolName) searchParams.set('toolName', params.toolName);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    return get<{ data: ArchivedOutput[]; query: string }>(`/data/archived-outputs/search?${searchParams}`).then(res => res.data || []);
  },
  getArchivedOutputStats: () => get<ArchivedOutputStats>('/data/archived-outputs/stats'),
  getArchivedOutput: (id: number) => get<ArchivedOutput>(`/data/archived-outputs/${id}`),
  getArchivedOutputByObservation: (observationId: number) => get<ArchivedOutput>(`/data/archived-outputs/by-observation/${observationId}`),

  // User Tasks - Issue #260 (TodoList & PlanMode)
  getUserTasks: (params?: {
    project?: string;
    sessionId?: string;
    status?: UserTaskStatus | UserTaskStatus[];
    source?: UserTaskSource;
    parentTaskId?: number | 'root';
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.project) query.set('project', params.project);
    if (params?.sessionId) query.set('sessionId', params.sessionId);
    if (params?.status) {
      const statusStr = Array.isArray(params.status) ? params.status.join(',') : params.status;
      query.set('status', statusStr);
    }
    if (params?.source) query.set('source', params.source);
    if (params?.parentTaskId !== undefined) {
      query.set('parentTaskId', params.parentTaskId === 'root' ? 'null' : String(params.parentTaskId));
    }
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const queryStr = query.toString();
    return get<{ data: UserTask[] }>(`/data/user-tasks${queryStr ? '?' + queryStr : ''}`).then(res => res.data || []);
  },
  getUserTask: (id: number) => get<UserTask>(`/data/user-tasks/${id}`),
  getUserTaskStats: (project?: string) => {
    const query = project ? `?project=${encodeURIComponent(project)}` : '';
    return get<UserTaskStats>(`/data/user-tasks/stats${query}`);
  },
  getUserTaskCounts: (project?: string) => {
    const query = project ? `?project=${encodeURIComponent(project)}` : '';
    return get<UserTaskCounts>(`/data/user-tasks/status/counts${query}`);
  },
  getUserTaskChildren: (id: number) =>
    get<{ data: UserTask[] }>(`/data/user-tasks/${id}/children`).then(res => res.data || []),

  // User Task Export (Issue #260 Phase 4)
  exportUserTasks: (params?: { project?: string; status?: string; format?: 'json' | 'markdown' | 'download'; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.project) query.set('project', params.project);
    if (params?.status) query.set('status', params.status);
    if (params?.format) query.set('format', params.format);
    if (params?.limit) query.set('limit', String(params.limit));
    const queryStr = query.toString();
    return get<{ exportedAt: string; filters: { project: string; status: string }; count: number; tasks: UserTask[] }>(
      `/export/user-tasks${queryStr ? '?' + queryStr : ''}`
    );
  },
  exportUserTasksMarkdown: (params?: { project?: string; status?: string }) => {
    const query = new URLSearchParams();
    query.set('format', 'markdown');
    if (params?.project) query.set('project', params.project);
    if (params?.status) query.set('status', params.status);
    return fetch(`/api/export/user-tasks?${query}`).then(res => res.text());
  },

  // Worker Tokens - Issue #263 (Hub Federation)
  getWorkerTokens: () =>
    get<{ data: WorkerToken[] }>('/worker-tokens').then(res => res.data || []),
  getWorkerToken: (id: string) => get<WorkerToken>(`/worker-tokens/${id}`),
  createWorkerToken: (request: WorkerTokenCreateRequest) =>
    post<WorkerTokenCreateResponse>('/worker-tokens', request),
  revokeWorkerToken: (id: string) => del<void>(`/worker-tokens/${id}`),
  getTokenRegistrations: (tokenId: string) =>
    get<{ data: WorkerRegistration[] }>(`/worker-tokens/${tokenId}/registrations`).then(res => res.data || []),

  // Hubs - Issue #263 (Hub Federation)
  getHubs: () => get<{ data: Hub[] }>('/hubs').then(res => res.data || []),
  getHub: (id: string) => get<Hub>(`/hubs/${id}`),
  createHub: (request: HubCreateRequest) => post<Hub>('/hubs', request),
  updateHub: (id: string, updates: Partial<HubCreateRequest>) => put<Hub>(`/hubs/${id}`, updates),
  deleteHub: (id: string) => del<void>(`/hubs/${id}`),
  getHubStats: () => get<HubStats>('/hubs/stats'),
  getHubWorkers: (hubId: string) =>
    get<{ data: WorkerRegistration[] }>(`/hubs/${hubId}/workers`).then(res => res.data || []),
};

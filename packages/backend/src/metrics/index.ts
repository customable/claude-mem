/**
 * Prometheus Metrics (Issue #209)
 *
 * Provides metrics for monitoring:
 * - HTTP request latency and counts
 * - Task processing duration and status
 * - Worker utilization
 * - Queue depth
 * - Database operations (optional)
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a custom registry
export const registry = new Registry();

// Add default metrics (Node.js process metrics)
collectDefaultMetrics({ register: registry });

// ============================================
// HTTP Request Metrics
// ============================================

export const httpRequestDuration = new Histogram({
  name: 'claude_mem_http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'path', 'status'] as const,
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
  registers: [registry],
});

export const httpRequestTotal = new Counter({
  name: 'claude_mem_http_request_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'] as const,
  registers: [registry],
});

// ============================================
// Task Metrics
// ============================================

export const taskDuration = new Histogram({
  name: 'claude_mem_task_duration_ms',
  help: 'Task processing duration in milliseconds',
  labelNames: ['type', 'status'] as const,
  buckets: [100, 500, 1000, 2000, 5000, 10000, 30000, 60000],
  registers: [registry],
});

export const taskQueueDepth = new Gauge({
  name: 'claude_mem_task_queue_depth',
  help: 'Current number of tasks in queue',
  labelNames: ['status'] as const,
  registers: [registry],
});

export const taskTotal = new Counter({
  name: 'claude_mem_task_total',
  help: 'Total tasks processed',
  labelNames: ['type', 'status'] as const,
  registers: [registry],
});

// ============================================
// Worker Metrics
// ============================================

export const workerCount = new Gauge({
  name: 'claude_mem_worker_count',
  help: 'Number of connected workers',
  labelNames: ['type'] as const, // permanent, spawned
  registers: [registry],
});

export const workerBusy = new Gauge({
  name: 'claude_mem_worker_busy_count',
  help: 'Number of workers currently processing tasks',
  registers: [registry],
});

// ============================================
// Session Metrics
// ============================================

export const sessionCount = new Gauge({
  name: 'claude_mem_session_count',
  help: 'Total number of sessions',
  labelNames: ['status'] as const,
  registers: [registry],
});

export const activeSessionCount = new Gauge({
  name: 'claude_mem_active_session_count',
  help: 'Number of currently active sessions',
  registers: [registry],
});

// ============================================
// Observation Metrics
// ============================================

export const observationCount = new Gauge({
  name: 'claude_mem_observation_count',
  help: 'Total number of observations',
  registers: [registry],
});

export const observationsByType = new Gauge({
  name: 'claude_mem_observations_by_type',
  help: 'Number of observations by type',
  labelNames: ['type'] as const,
  registers: [registry],
});

// ============================================
// Database Metrics
// ============================================

export const dbQueryDuration = new Histogram({
  name: 'claude_mem_db_query_duration_ms',
  help: 'Database query duration in milliseconds',
  labelNames: ['operation', 'table'] as const,
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [registry],
});

// ============================================
// SSE Connection Metrics
// ============================================

export const sseConnectionCount = new Gauge({
  name: 'claude_mem_sse_connection_count',
  help: 'Number of active SSE connections',
  registers: [registry],
});

// ============================================
// Export all metrics
// ============================================

export const metrics = {
  registry,
  httpRequestDuration,
  httpRequestTotal,
  taskDuration,
  taskQueueDepth,
  taskTotal,
  workerCount,
  workerBusy,
  sessionCount,
  activeSessionCount,
  observationCount,
  observationsByType,
  dbQueryDuration,
  sseConnectionCount,
};

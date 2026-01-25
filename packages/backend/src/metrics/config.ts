/**
 * Metrics Configuration (Issue #258)
 *
 * Centralized configuration for all Prometheus metrics.
 * This separates the metric definitions from their instantiation.
 */

import type { MetricConfig, MetricsConfigRecord } from '@claude-mem/types';

/**
 * All metrics configuration
 *
 * Naming convention: claude_mem_{category}_{metric_name}
 */
export const METRICS_CONFIG = {
  // HTTP Request Metrics
  httpRequestDuration: {
    type: 'histogram',
    name: 'claude_mem_http_request_duration_ms',
    help: 'HTTP request duration in milliseconds',
    labelNames: ['method', 'path', 'status'],
    buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
  },
  httpRequestTotal: {
    type: 'counter',
    name: 'claude_mem_http_request_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'path', 'status'],
  },

  // Task Metrics
  taskDuration: {
    type: 'histogram',
    name: 'claude_mem_task_duration_ms',
    help: 'Task processing duration in milliseconds',
    labelNames: ['type', 'status'],
    buckets: [100, 500, 1000, 2000, 5000, 10000, 30000, 60000],
  },
  taskQueueDepth: {
    type: 'gauge',
    name: 'claude_mem_task_queue_depth',
    help: 'Current number of tasks in queue',
    labelNames: ['status'],
  },
  taskTotal: {
    type: 'counter',
    name: 'claude_mem_task_total',
    help: 'Total tasks processed',
    labelNames: ['type', 'status'],
  },

  // Worker Metrics
  workerCount: {
    type: 'gauge',
    name: 'claude_mem_worker_count',
    help: 'Number of connected workers',
    labelNames: ['type'], // permanent, spawned
  },
  workerBusy: {
    type: 'gauge',
    name: 'claude_mem_worker_busy_count',
    help: 'Number of workers currently processing tasks',
    labelNames: [],
  },

  // Session Metrics
  sessionCount: {
    type: 'gauge',
    name: 'claude_mem_session_count',
    help: 'Total number of sessions',
    labelNames: ['status'],
  },
  activeSessionCount: {
    type: 'gauge',
    name: 'claude_mem_active_session_count',
    help: 'Number of currently active sessions',
    labelNames: [],
  },

  // Observation Metrics
  observationCount: {
    type: 'gauge',
    name: 'claude_mem_observation_count',
    help: 'Total number of observations',
    labelNames: [],
  },
  observationsByType: {
    type: 'gauge',
    name: 'claude_mem_observations_by_type',
    help: 'Number of observations by type',
    labelNames: ['type'],
  },

  // Database Metrics
  dbQueryDuration: {
    type: 'histogram',
    name: 'claude_mem_db_query_duration_ms',
    help: 'Database query duration in milliseconds',
    labelNames: ['operation', 'table'],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  },

  // SSE Connection Metrics
  sseConnectionCount: {
    type: 'gauge',
    name: 'claude_mem_sse_connection_count',
    help: 'Number of active SSE connections',
    labelNames: [],
  },
} as const satisfies MetricsConfigRecord;

export type MetricsConfig = typeof METRICS_CONFIG;
export type MetricName = keyof MetricsConfig;

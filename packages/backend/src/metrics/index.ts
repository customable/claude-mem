/**
 * Prometheus Metrics (Issue #209, #258)
 *
 * Provides metrics for monitoring:
 * - HTTP request latency and counts
 * - Task processing duration and status
 * - Worker utilization
 * - Queue depth
 * - Database operations (optional)
 *
 * Refactored to use interface-based configuration (Issue #258).
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import type { MetricConfig } from '@claude-mem/types';
import { METRICS_CONFIG, type MetricName } from './config.js';

// Re-export config for external use
export { METRICS_CONFIG, type MetricName } from './config.js';

/**
 * Metric instances type map
 */
type MetricInstance<T extends MetricConfig> =
  T extends { type: 'histogram' } ? Histogram<string> :
  T extends { type: 'counter' } ? Counter<string> :
  T extends { type: 'gauge' } ? Gauge<string> :
  never;

type MetricInstances = {
  [K in MetricName]: MetricInstance<typeof METRICS_CONFIG[K]>;
};

/**
 * Create a metric instance from configuration
 */
function createMetric<T extends MetricConfig>(
  config: T,
  registry: Registry
): MetricInstance<T> {
  const baseConfig = {
    name: config.name,
    help: config.help,
    labelNames: config.labelNames as string[] | undefined,
    registers: [registry],
  };

  switch (config.type) {
    case 'histogram':
      return new Histogram({
        ...baseConfig,
        buckets: [...config.buckets],
      }) as MetricInstance<T>;

    case 'counter':
      return new Counter(baseConfig) as MetricInstance<T>;

    case 'gauge':
      return new Gauge(baseConfig) as MetricInstance<T>;

    default:
      throw new Error(`Unknown metric type: ${(config as MetricConfig).type}`);
  }
}

/**
 * Create all metrics from configuration
 */
function createMetrics(registry: Registry): MetricInstances {
  const metrics: Record<string, Histogram<string> | Counter<string> | Gauge<string>> = {};

  for (const [name, config] of Object.entries(METRICS_CONFIG)) {
    metrics[name] = createMetric(config, registry);
  }

  return metrics as MetricInstances;
}

// Create a custom registry
export const registry = new Registry();

// Add default metrics (Node.js process metrics)
collectDefaultMetrics({ register: registry });

// Create all metric instances
const metricInstances = createMetrics(registry);

// Export individual metrics for backward compatibility
export const httpRequestDuration = metricInstances.httpRequestDuration;
export const httpRequestTotal = metricInstances.httpRequestTotal;
export const taskDuration = metricInstances.taskDuration;
export const taskQueueDepth = metricInstances.taskQueueDepth;
export const taskTotal = metricInstances.taskTotal;
export const workerCount = metricInstances.workerCount;
export const workerBusy = metricInstances.workerBusy;
export const sessionCount = metricInstances.sessionCount;
export const activeSessionCount = metricInstances.activeSessionCount;
export const observationCount = metricInstances.observationCount;
export const observationsByType = metricInstances.observationsByType;
export const dbQueryDuration = metricInstances.dbQueryDuration;
export const sseConnectionCount = metricInstances.sseConnectionCount;

// Export all metrics object
export const metrics = {
  registry,
  ...metricInstances,
};

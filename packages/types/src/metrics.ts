/**
 * Metrics Type Definitions (Issue #258)
 *
 * Interface-based metric configuration for better maintainability.
 */

/**
 * Base configuration shared by all metric types
 */
export interface BaseMetricConfig {
  name: string;
  help: string;
  labelNames?: readonly string[];
}

/**
 * Histogram metric configuration
 */
export interface HistogramConfig extends BaseMetricConfig {
  type: 'histogram';
  buckets: readonly number[];
}

/**
 * Counter metric configuration
 */
export interface CounterConfig extends BaseMetricConfig {
  type: 'counter';
}

/**
 * Gauge metric configuration
 */
export interface GaugeConfig extends BaseMetricConfig {
  type: 'gauge';
}

/**
 * Union type for all metric configurations
 */
export type MetricConfig = HistogramConfig | CounterConfig | GaugeConfig;

/**
 * Complete metrics configuration record
 */
export type MetricsConfigRecord = Record<string, MetricConfig>;

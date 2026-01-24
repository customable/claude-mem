/**
 * Tracing Module (Issue #208)
 *
 * Provides distributed tracing capabilities for request correlation
 * across services (Hooks → Backend → Worker → DB).
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { logger } from './logger.js';

/**
 * Trace context for distributed tracing
 */
export interface TraceContext {
  /** Request ID for correlating logs */
  requestId: string;
  /** Trace ID spanning entire request lifecycle */
  traceId: string;
  /** Current span ID */
  spanId: string;
  /** Parent span ID (if nested) */
  parentSpanId?: string;
  /** Service name */
  service?: string;
}

/**
 * Async local storage for trace context propagation
 */
export const traceStorage = new AsyncLocalStorage<TraceContext>();

/**
 * Get current trace context
 */
export function getTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}

/**
 * Get request ID from current context
 */
export function getRequestId(): string | undefined {
  return traceStorage.getStore()?.requestId;
}

/**
 * Generate a new span ID (16 character hex string)
 */
export function generateSpanId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16);
}

/**
 * Generate a new trace ID
 */
export function generateTraceId(): string {
  return randomUUID();
}

/**
 * Create a new trace context
 */
export function createTraceContext(options?: Partial<TraceContext>): TraceContext {
  return {
    requestId: options?.requestId || generateTraceId(),
    traceId: options?.traceId || generateTraceId(),
    spanId: options?.spanId || generateSpanId(),
    parentSpanId: options?.parentSpanId,
    service: options?.service,
  };
}

/**
 * Run a function within a trace context
 */
export function runWithTraceContext<T>(context: TraceContext, fn: () => T): T {
  return traceStorage.run(context, fn);
}

/**
 * Run an async function within a trace context
 */
export async function runWithTraceContextAsync<T>(
  context: TraceContext,
  fn: () => Promise<T>
): Promise<T> {
  return traceStorage.run(context, fn);
}

/**
 * Execute a function within a new span
 */
export async function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  options?: { service?: string }
): Promise<T> {
  const parent = getTraceContext();
  const spanId = generateSpanId();

  const context: TraceContext = {
    requestId: parent?.requestId || generateTraceId(),
    traceId: parent?.traceId || generateTraceId(),
    spanId,
    parentSpanId: parent?.spanId,
    service: options?.service || parent?.service,
  };

  return traceStorage.run(context, async () => {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      logger.debug(`Span completed: ${name}`, {
        ...context,
        name,
        duration,
      });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`Span failed: ${name}`, {
        ...context,
        name,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });
}

/**
 * Execute a sync function within a new span
 */
export function withSpanSync<T>(
  name: string,
  fn: () => T,
  options?: { service?: string }
): T {
  const parent = getTraceContext();
  const spanId = generateSpanId();

  const context: TraceContext = {
    requestId: parent?.requestId || generateTraceId(),
    traceId: parent?.traceId || generateTraceId(),
    spanId,
    parentSpanId: parent?.spanId,
    service: options?.service || parent?.service,
  };

  return traceStorage.run(context, () => {
    const start = Date.now();
    try {
      const result = fn();
      const duration = Date.now() - start;
      logger.debug(`Span completed: ${name}`, {
        ...context,
        name,
        duration,
      });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`Span failed: ${name}`, {
        ...context,
        name,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });
}

/**
 * Get trace headers for propagating context to downstream services
 */
export function getTraceHeaders(): Record<string, string> {
  const context = getTraceContext();
  if (!context) {
    return {};
  }
  return {
    'X-Request-ID': context.requestId,
    'X-Trace-ID': context.traceId,
    'X-Span-ID': context.spanId,
    ...(context.parentSpanId ? { 'X-Parent-Span-ID': context.parentSpanId } : {}),
  };
}

/**
 * Parse trace context from headers
 */
export function parseTraceHeaders(headers: Record<string, string | undefined>): Partial<TraceContext> {
  return {
    requestId: headers['x-request-id'] || headers['X-Request-ID'],
    traceId: headers['x-trace-id'] || headers['X-Trace-ID'],
    spanId: headers['x-span-id'] || headers['X-Span-ID'],
    parentSpanId: headers['x-parent-span-id'] || headers['X-Parent-Span-ID'],
  };
}

/**
 * Request ID Middleware (Issue #208)
 *
 * Assigns a unique request ID to each incoming request for tracing
 * and correlation across services.
 */

import type { Request, Response, NextFunction } from 'express';
import {
  createTraceContext,
  runWithTraceContext,
  parseTraceHeaders,
  type TraceContext,
} from '@claude-mem/shared';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      traceContext: TraceContext;
    }
  }
}

/**
 * Middleware that assigns a request ID and sets up trace context
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Parse incoming trace headers (for cross-service correlation)
  const incomingContext = parseTraceHeaders(req.headers as Record<string, string | undefined>);

  // Create trace context (use incoming IDs if available, generate new ones otherwise)
  const traceContext = createTraceContext({
    requestId: incomingContext.requestId,
    traceId: incomingContext.traceId,
    parentSpanId: incomingContext.spanId, // Incoming span becomes parent
    service: 'backend',
  });

  // Attach to request object
  req.requestId = traceContext.requestId;
  req.traceContext = traceContext;

  // Set response header for client correlation
  res.setHeader('X-Request-ID', traceContext.requestId);

  // Run the rest of the middleware chain within the trace context
  runWithTraceContext(traceContext, () => {
    next();
  });
}

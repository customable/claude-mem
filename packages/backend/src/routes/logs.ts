/**
 * Logs Router
 *
 * Provides API endpoints for retrieving structured logs.
 */

import type { Request, Response } from 'express';
import { BaseRouter } from './base-router.js';
import { logBuffer, type LogEntry, type LogLevel } from '@claude-mem/shared';

export interface LogsRouterDeps {
  // No dependencies needed - uses global logBuffer
}

/**
 * Serialized log entry for API response
 */
interface SerializedLogEntry {
  level: LogLevel;
  timestamp: string;
  context: string;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

function serializeLogEntry(entry: LogEntry): SerializedLogEntry {
  return {
    level: entry.level,
    timestamp: entry.timestamp.toISOString(),
    context: entry.context,
    message: entry.message,
    data: entry.data,
    error: entry.error?.message,
  };
}

export class LogsRouter extends BaseRouter {
  constructor(_deps: LogsRouterDeps = {}) {
    super();
  }

  protected setupRoutes(): void {
    // GET /api/logs - Get all logs (structured)
    this.router.get(
      '/',
      this.asyncHandler(async (req: Request, res: Response) => {
        const level = req.query.level as LogLevel | undefined;
        const minLevel = req.query.minLevel as LogLevel | undefined;
        const context = req.query.context as string | undefined;
        const limit = this.parseOptionalIntParam(req.query.limit as string);
        const since = req.query.since ? new Date(req.query.since as string) : undefined;

        const entries = logBuffer.query({
          level,
          minLevel,
          context,
          since,
          limit: limit || 500,
        });

        this.success(res, {
          entries: entries.map(serializeLogEntry),
          total: logBuffer.size,
          filtered: entries.length,
        });
      })
    );

    // GET /api/logs/raw - Get logs as text (legacy support)
    this.router.get(
      '/raw',
      this.asyncHandler(async (req: Request, res: Response) => {
        const limit = this.parseOptionalIntParam(req.query.limit as string) || 500;
        const entries = logBuffer.query({ limit });

        const text = entries
          .map((e: LogEntry) => {
            const ts = e.timestamp.toISOString();
            const level = e.level.toUpperCase().padEnd(5);
            const ctx = e.context.padEnd(10);
            let line = `[${ts}] [${level}] [${ctx}] ${e.message}`;
            if (e.data && Object.keys(e.data).length > 0) {
              line += ` ${JSON.stringify(e.data)}`;
            }
            return line;
          })
          .join('\n');

        this.success(res, { logs: text });
      })
    );

    // POST /api/logs/clear - Clear all logs
    this.router.post(
      '/clear',
      this.asyncHandler(async (_req: Request, res: Response) => {
        logBuffer.clear();
        this.success(res, { message: 'Logs cleared' });
      })
    );

    // GET /api/logs/stats - Get log statistics
    this.router.get(
      '/stats',
      this.asyncHandler(async (_req: Request, res: Response) => {
        const all = logBuffer.getAll();
        const stats = {
          total: all.length,
          byLevel: {
            debug: all.filter((e: LogEntry) => e.level === 'debug').length,
            info: all.filter((e: LogEntry) => e.level === 'info').length,
            warn: all.filter((e: LogEntry) => e.level === 'warn').length,
            error: all.filter((e: LogEntry) => e.level === 'error').length,
          },
          byContext: {} as Record<string, number>,
        };

        for (const entry of all) {
          const ctx = entry.context.split(':')[0]; // Top-level context
          stats.byContext[ctx] = (stats.byContext[ctx] || 0) + 1;
        }

        this.success(res, stats);
      })
    );
  }
}

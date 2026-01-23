/**
 * Error Handler Middleware
 *
 * Centralized error handling for Express.
 */

import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { createLogger } from '@claude-mem/shared';

const logger = createLogger('error-handler');

/**
 * Application Error with HTTP status
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode = 500,
    code?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Bad Request Error (400)
 */
export class BadRequestError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'BAD_REQUEST', details);
    this.name = 'BadRequestError';
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * Unauthorized Error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

/**
 * Error response format
 */
export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Global error handler middleware
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Don't try to send if headers already sent
  if (res.headersSent) {
    logger.error('Error after headers sent:', { message: err.message, stack: err.stack });
    return;
  }

  // Handle AppError
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      error: err.name,
      message: err.message,
      code: err.code,
      details: err.details,
    };

    res.status(err.statusCode).json(response);
    return;
  }

  // Log unexpected errors
  logger.error('Unexpected error:', { message: err.message, stack: err.stack });

  // Generic error response
  const response: ErrorResponse = {
    error: 'InternalServerError',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  };

  res.status(500).json(response);
};

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const response: ErrorResponse = {
    error: 'NotFound',
    message: `Route not found: ${req.method} ${req.path}`,
    code: 'ROUTE_NOT_FOUND',
  };

  res.status(404).json(response);
}

/**
 * Async handler wrapper
 * Catches async errors and passes them to the error handler
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

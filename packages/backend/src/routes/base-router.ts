/**
 * Base Router
 *
 * Provides common utilities for route handlers.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { BadRequestError, NotFoundError } from '../middleware/error-handler.js';

export abstract class BaseRouter {
  public readonly router: Router;

  protected constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  /**
   * Setup routes - to be implemented by subclasses
   */
  protected abstract setupRoutes(): void;

  /**
   * Wrap async handler for error handling
   */
  protected asyncHandler<T>(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
  ) {
    return (req: Request, res: Response, next: NextFunction): void => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Parse integer parameter
   */
  protected parseIntParam(value: string | undefined, name: string): number {
    if (!value) {
      throw new BadRequestError(`Missing required parameter: ${name}`);
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new BadRequestError(`Invalid integer for parameter: ${name}`);
    }
    return parsed;
  }

  /**
   * Parse optional integer parameter
   */
  protected parseOptionalIntParam(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Validate required fields in request body
   */
  protected validateRequired(
    body: Record<string, unknown>,
    fields: string[]
  ): void {
    const missing = fields.filter(f => body[f] === undefined || body[f] === null);
    if (missing.length > 0) {
      throw new BadRequestError(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  /**
   * Throw not found error
   */
  protected notFound(message: string): never {
    throw new NotFoundError(message);
  }

  /**
   * Throw bad request error
   */
  protected badRequest(message: string, details?: Record<string, unknown>): never {
    throw new BadRequestError(message, details);
  }

  /**
   * Send success response
   */
  protected success<T>(res: Response, data: T, statusCode = 200): void {
    res.status(statusCode).json(data);
  }

  /**
   * Send created response
   */
  protected created<T>(res: Response, data: T): void {
    this.success(res, data, 201);
  }

  /**
   * Send no content response
   */
  protected noContent(res: Response): void {
    res.status(204).send();
  }
}

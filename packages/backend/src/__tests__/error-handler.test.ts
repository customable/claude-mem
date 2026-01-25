/**
 * Tests for Error Handler Middleware
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  AppError,
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
} from '../middleware/error-handler.js';

// Mock request factory
function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/test',
    ...overrides,
  } as Request;
}

// Mock response factory
function mockResponse(): Response & { statusCode: number; data: unknown } {
  const res = {
    statusCode: 200,
    data: null as unknown,
    headersSent: false,
    status: vi.fn().mockImplementation(function (this: Response, code: number) {
      (this as Response & { statusCode: number }).statusCode = code;
      return this;
    }),
    json: vi.fn().mockImplementation(function (this: Response, data: unknown) {
      (this as Response & { data: unknown }).data = data;
      return this;
    }),
  };
  return res as unknown as Response & { statusCode: number; data: unknown };
}

describe('Error Handler Middleware', () => {
  describe('AppError', () => {
    it('should create error with default status code', () => {
      const error = new AppError('Something went wrong');
      expect(error.message).toBe('Something went wrong');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('AppError');
    });

    it('should create error with custom status code', () => {
      const error = new AppError('Not found', 404);
      expect(error.statusCode).toBe(404);
    });

    it('should include code and details', () => {
      const error = new AppError('Validation failed', 400, 'VALIDATION_ERROR', {
        field: 'email',
        reason: 'invalid format',
      });
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual({ field: 'email', reason: 'invalid format' });
    });
  });

  describe('BadRequestError', () => {
    it('should create 400 error', () => {
      const error = new BadRequestError('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.name).toBe('BadRequestError');
    });

    it('should include details', () => {
      const error = new BadRequestError('Validation failed', {
        fields: ['name', 'email'],
      });
      expect(error.details).toEqual({ fields: ['name', 'email'] });
    });
  });

  describe('NotFoundError', () => {
    it('should create 404 error', () => {
      const error = new NotFoundError('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.name).toBe('NotFoundError');
    });
  });

  describe('UnauthorizedError', () => {
    it('should create 401 error', () => {
      const error = new UnauthorizedError();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Unauthorized');
    });

    it('should allow custom message', () => {
      const error = new UnauthorizedError('Token expired');
      expect(error.message).toBe('Token expired');
    });
  });

  describe('errorHandler', () => {
    let req: Request;
    let res: Response & { statusCode: number; data: unknown };
    let next: NextFunction;

    beforeEach(() => {
      req = mockRequest();
      res = mockResponse();
      next = vi.fn();
    });

    it('should handle AppError', () => {
      const error = new AppError('Custom error', 422, 'CUSTOM_CODE', {
        extra: 'info',
      });

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        error: 'AppError',
        message: 'Custom error',
        code: 'CUSTOM_CODE',
        details: { extra: 'info' },
      });
    });

    it('should handle BadRequestError', () => {
      const error = new BadRequestError('Bad request');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'BadRequestError',
          message: 'Bad request',
          code: 'BAD_REQUEST',
        })
      );
    });

    it('should handle NotFoundError', () => {
      const error = new NotFoundError('Item not found');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'NotFoundError',
          message: 'Item not found',
          code: 'NOT_FOUND',
        })
      );
    });

    it('should handle UnauthorizedError', () => {
      const error = new UnauthorizedError('Invalid token');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'UnauthorizedError',
          message: 'Invalid token',
          code: 'UNAUTHORIZED',
        })
      );
    });

    it('should handle generic Error with 500', () => {
      const error = new Error('Something unexpected');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'InternalServerError',
        message: 'Something unexpected',
      });
    });

    it('should hide error details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const error = new Error('Database connection failed');
        errorHandler(error, req, res, next);

        expect(res.json).toHaveBeenCalledWith({
          error: 'InternalServerError',
          message: 'An unexpected error occurred',
        });
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should not send response if headers already sent', () => {
      const resWithHeadersSent = mockResponse();
      resWithHeadersSent.headersSent = true;

      const error = new Error('Test error');
      errorHandler(error, req, resWithHeadersSent, next);

      expect(resWithHeadersSent.status).not.toHaveBeenCalled();
      expect(resWithHeadersSent.json).not.toHaveBeenCalled();
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 with route info', () => {
      const req = mockRequest({ method: 'POST', path: '/api/users' });
      const res = mockResponse();

      notFoundHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'NotFound',
        message: 'Route not found: POST /api/users',
        code: 'ROUTE_NOT_FOUND',
      });
    });
  });

  describe('asyncHandler', () => {
    it('should pass result through for successful async functions', async () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = vi.fn();

      const handler = asyncHandler(async (_req, _res, _next) => {
        return 'success';
      });

      await handler(req, res, next);

      expect(next).not.toHaveBeenCalled();
    });

    it('should catch and forward errors to next', async () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = vi.fn();

      const error = new Error('Async error');
      const handler = asyncHandler(async () => {
        throw error;
      });

      await handler(req, res, next);

      // Wait for promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should forward AppError to next', async () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = vi.fn();

      const error = new BadRequestError('Validation failed');
      const handler = asyncHandler(async () => {
        throw error;
      });

      await handler(req, res, next);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

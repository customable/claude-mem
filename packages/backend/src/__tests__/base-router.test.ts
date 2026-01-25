/**
 * Tests for BaseRouter utilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { BaseRouter } from '../routes/base-router.js';
import { BadRequestError, NotFoundError } from '../middleware/error-handler.js';

// Concrete implementation for testing
class TestRouter extends BaseRouter {
  protected setupRoutes(): void {
    this.router.get('/test', (req, res) => {
      this.success(res, { message: 'ok' });
    });
  }

  // Expose protected methods for testing
  public testParseIntParam(value: string | undefined, name: string): number {
    return this.parseIntParam(value, name);
  }

  public testParseOptionalIntParam(value: string | undefined): number | undefined {
    return this.parseOptionalIntParam(value);
  }

  public testValidateRequired(body: Record<string, unknown>, fields: string[]): void {
    return this.validateRequired(body, fields);
  }

  public testNotFound(message: string): never {
    return this.notFound(message);
  }

  public testBadRequest(message: string, details?: Record<string, unknown>): never {
    return this.badRequest(message, details);
  }

  public testSuccess<T>(res: Response, data: T, statusCode?: number): void {
    return this.success(res, data, statusCode);
  }

  public testCreated<T>(res: Response, data: T): void {
    return this.created(res, data);
  }

  public testNoContent(res: Response): void {
    return this.noContent(res);
  }

  public testAsyncHandler<T>(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
  ) {
    return this.asyncHandler(fn);
  }
}

// Mock response factory
function mockResponse(): Response & {
  statusCode: number;
  data: unknown;
  ended: boolean;
} {
  const res = {
    statusCode: 200,
    data: null as unknown,
    ended: false,
    status: vi.fn().mockImplementation(function (this: Response, code: number) {
      (this as Response & { statusCode: number }).statusCode = code;
      return this;
    }),
    json: vi.fn().mockImplementation(function (this: Response, data: unknown) {
      (this as Response & { data: unknown }).data = data;
      return this;
    }),
    send: vi.fn().mockImplementation(function (this: Response) {
      (this as Response & { ended: boolean }).ended = true;
      return this;
    }),
  };
  return res as unknown as Response & { statusCode: number; data: unknown; ended: boolean };
}

describe('BaseRouter', () => {
  let router: TestRouter;

  beforeEach(() => {
    router = new TestRouter();
  });

  describe('constructor', () => {
    it('should create router instance', () => {
      expect(router.router).toBeDefined();
      expect(router.router).toBeInstanceOf(Function);
    });
  });

  describe('parseIntParam', () => {
    it('should parse valid integer', () => {
      expect(router.testParseIntParam('42', 'id')).toBe(42);
      expect(router.testParseIntParam('0', 'id')).toBe(0);
      expect(router.testParseIntParam('-10', 'id')).toBe(-10);
    });

    it('should throw BadRequestError for missing value', () => {
      expect(() => router.testParseIntParam(undefined, 'id')).toThrow(BadRequestError);
      expect(() => router.testParseIntParam(undefined, 'id')).toThrow(
        'Missing required parameter: id'
      );
    });

    it('should throw BadRequestError for invalid integer', () => {
      expect(() => router.testParseIntParam('abc', 'id')).toThrow(BadRequestError);
      expect(() => router.testParseIntParam('abc', 'id')).toThrow(
        'Invalid integer for parameter: id'
      );
    });

    it('should parse float values as integers (parseInt behavior)', () => {
      // parseInt('3.14') returns 3 - this is expected JavaScript behavior
      expect(router.testParseIntParam('3.14', 'id')).toBe(3);
    });

    it('should throw BadRequestError for empty string', () => {
      expect(() => router.testParseIntParam('', 'id')).toThrow(BadRequestError);
    });
  });

  describe('parseOptionalIntParam', () => {
    it('should return undefined for missing value', () => {
      expect(router.testParseOptionalIntParam(undefined)).toBeUndefined();
    });

    it('should parse valid integer', () => {
      expect(router.testParseOptionalIntParam('42')).toBe(42);
      expect(router.testParseOptionalIntParam('0')).toBe(0);
    });

    it('should return undefined for non-numeric strings', () => {
      expect(router.testParseOptionalIntParam('abc')).toBeUndefined();
    });

    it('should parse float values as integers (parseInt behavior)', () => {
      // parseInt('3.14') returns 3 - this is expected JavaScript behavior
      expect(router.testParseOptionalIntParam('3.14')).toBe(3);
    });
  });

  describe('validateRequired', () => {
    it('should not throw for valid body', () => {
      expect(() =>
        router.testValidateRequired({ name: 'test', email: 'test@example.com' }, ['name', 'email'])
      ).not.toThrow();
    });

    it('should throw BadRequestError for missing fields', () => {
      expect(() =>
        router.testValidateRequired({ name: 'test' }, ['name', 'email'])
      ).toThrow(BadRequestError);
      expect(() =>
        router.testValidateRequired({ name: 'test' }, ['name', 'email'])
      ).toThrow('Missing required fields: email');
    });

    it('should throw for multiple missing fields', () => {
      expect(() => router.testValidateRequired({}, ['name', 'email', 'age'])).toThrow(
        'Missing required fields: name, email, age'
      );
    });

    it('should throw for null values', () => {
      expect(() =>
        router.testValidateRequired({ name: null }, ['name'])
      ).toThrow(BadRequestError);
    });

    it('should accept falsy values that are not null/undefined', () => {
      expect(() =>
        router.testValidateRequired({ count: 0, active: false, text: '' }, ['count', 'active', 'text'])
      ).not.toThrow();
    });
  });

  describe('notFound', () => {
    it('should throw NotFoundError', () => {
      expect(() => router.testNotFound('Resource not found')).toThrow(NotFoundError);
      expect(() => router.testNotFound('Resource not found')).toThrow('Resource not found');
    });
  });

  describe('badRequest', () => {
    it('should throw BadRequestError', () => {
      expect(() => router.testBadRequest('Invalid input')).toThrow(BadRequestError);
      expect(() => router.testBadRequest('Invalid input')).toThrow('Invalid input');
    });

    it('should include details', () => {
      try {
        router.testBadRequest('Validation failed', { field: 'email' });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestError);
        expect((error as BadRequestError).details).toEqual({ field: 'email' });
      }
    });
  });

  describe('success', () => {
    it('should send 200 response with data', () => {
      const res = mockResponse();
      router.testSuccess(res, { id: 1, name: 'test' });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: 1, name: 'test' });
    });

    it('should allow custom status code', () => {
      const res = mockResponse();
      router.testSuccess(res, { message: 'accepted' }, 202);

      expect(res.status).toHaveBeenCalledWith(202);
    });
  });

  describe('created', () => {
    it('should send 201 response with data', () => {
      const res = mockResponse();
      router.testCreated(res, { id: 1 });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: 1 });
    });
  });

  describe('noContent', () => {
    it('should send 204 response', () => {
      const res = mockResponse();
      router.testNoContent(res);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('asyncHandler', () => {
    it('should handle successful async function', async () => {
      const res = mockResponse();
      const req = {} as Request;
      const next = vi.fn();

      const handler = router.testAsyncHandler(async (_req, _res) => {
        return 'success';
      });

      await handler(req, res, next);

      expect(next).not.toHaveBeenCalled();
    });

    it('should catch and forward errors to next', async () => {
      const res = mockResponse();
      const req = {} as Request;
      const next = vi.fn();

      const error = new Error('Async error');
      const handler = router.testAsyncHandler(async () => {
        throw error;
      });

      handler(req, res, next);

      // Wait for promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

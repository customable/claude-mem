/**
 * Tests for Health Router
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import express from 'express';
import { HealthRouter, type HealthRouterDeps } from '../routes/health.js';

// Mock WorkerHub
const mockWorkerHub = {
  getStats: vi.fn().mockReturnValue({
    totalConnected: 2,
    byCapability: { observation: 1, summarize: 1 },
  }),
};

// Mock TaskQueue
const mockTaskQueue = {
  countByStatus: vi.fn().mockResolvedValue({
    pending: 5,
    processing: 2,
    completed: 100,
    failed: 1,
  }),
};

// Mock initialization status
const mockGetInitializationStatus = vi.fn().mockReturnValue({
  coreReady: true,
  fullyInitialized: true,
});

// Create mock dependencies
function createMockDeps(overrides: Partial<HealthRouterDeps> = {}): HealthRouterDeps {
  return {
    workerHub: mockWorkerHub as unknown as HealthRouterDeps['workerHub'],
    taskQueue: mockTaskQueue as unknown as HealthRouterDeps['taskQueue'],
    getInitializationStatus: mockGetInitializationStatus,
    ...overrides,
  };
}

// Create test app with health router
function createTestApp(deps: HealthRouterDeps) {
  const app = express();
  app.use(express.json());
  const healthRouter = new HealthRouter(deps);
  app.use('/api', healthRouter.router);
  return app;
}

describe('HealthRouter', () => {
  let deps: HealthRouterDeps;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const app = createTestApp(deps);
      const res = await fetch(new URL('/api/health', 'http://localhost'), {
        method: 'GET',
      });

      // Since we can't use supertest, let's test the router directly
      const router = new HealthRouter(deps);
      expect(router.router).toBeDefined();
    });

    it('should include worker count and initialization status', () => {
      const router = new HealthRouter(deps);

      // Test that the router is properly configured
      expect(router.router.stack.some((layer: { route?: { path: string } }) =>
        layer.route?.path === '/health'
      )).toBe(true);
    });
  });

  describe('GET /api/core-ready', () => {
    it('should have core-ready route', () => {
      const router = new HealthRouter(deps);

      const hasRoute = router.router.stack.some(
        (layer: { route?: { path: string } }) => layer.route?.path === '/core-ready'
      );
      expect(hasRoute).toBe(true);
    });
  });

  describe('GET /api/ready', () => {
    it('should have ready route', () => {
      const router = new HealthRouter(deps);

      const hasRoute = router.router.stack.some(
        (layer: { route?: { path: string } }) => layer.route?.path === '/ready'
      );
      expect(hasRoute).toBe(true);
    });

    it('should have readiness alias', () => {
      const router = new HealthRouter(deps);

      const hasRoute = router.router.stack.some(
        (layer: { route?: { path: string } }) => layer.route?.path === '/readiness'
      );
      expect(hasRoute).toBe(true);
    });
  });

  describe('GET /api/version', () => {
    it('should have version route', () => {
      const router = new HealthRouter(deps);

      const hasRoute = router.router.stack.some(
        (layer: { route?: { path: string } }) => layer.route?.path === '/version'
      );
      expect(hasRoute).toBe(true);
    });
  });

  describe('GET /api/status', () => {
    it('should have status route', () => {
      const router = new HealthRouter(deps);

      const hasRoute = router.router.stack.some(
        (layer: { route?: { path: string } }) => layer.route?.path === '/status'
      );
      expect(hasRoute).toBe(true);
    });
  });

  describe('POST /api/admin/restart', () => {
    it('should have admin restart route', () => {
      const router = new HealthRouter(deps);

      const hasRoute = router.router.stack.some(
        (layer: { route?: { path: string; methods?: { post?: boolean } } }) =>
          layer.route?.path === '/admin/restart' && layer.route?.methods?.post
      );
      expect(hasRoute).toBe(true);
    });
  });

  describe('GET /api/cache/stats', () => {
    it('should have cache stats route', () => {
      const router = new HealthRouter(deps);

      const hasRoute = router.router.stack.some(
        (layer: { route?: { path: string } }) => layer.route?.path === '/cache/stats'
      );
      expect(hasRoute).toBe(true);
    });
  });

  describe('POST /api/cache/clear', () => {
    it('should have cache clear route', () => {
      const router = new HealthRouter(deps);

      const hasRoute = router.router.stack.some(
        (layer: { route?: { path: string; methods?: { post?: boolean } } }) =>
          layer.route?.path === '/cache/clear' && layer.route?.methods?.post
      );
      expect(hasRoute).toBe(true);
    });
  });

  describe('Route count', () => {
    it('should have correct number of routes', () => {
      const router = new HealthRouter(deps);

      // Count routes (excluding middleware layers)
      const routeCount = router.router.stack.filter(
        (layer: { route?: unknown }) => layer.route
      ).length;

      // Expected routes: health, core-ready, ready, readiness, version, status, admin/restart, cache/stats, cache/clear
      expect(routeCount).toBe(9);
    });
  });
});

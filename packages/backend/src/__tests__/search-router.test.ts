/**
 * Tests for SearchRouter
 *
 * Tests route registration and search functionality.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { SearchRouter } from '../routes/search.js';

// Mock shared module
vi.mock('@claude-mem/shared', () => ({
  loadSettings: vi.fn().mockReturnValue({ VECTOR_DB: 'none' }),
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Create mock dependencies
function createMockDeps() {
  return {
    observations: {
      search: vi.fn().mockResolvedValue([]),
      searchWithRanking: vi.fn().mockResolvedValue({ results: [], total: 0 }),
      getSearchFacets: vi.fn().mockResolvedValue({}),
      list: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
    },
    taskService: {
      executeSemanticSearch: vi.fn().mockResolvedValue({
        results: [],
        totalFound: 0,
        durationMs: 10,
      }),
    },
  };
}

describe('SearchRouter', () => {
  let app: express.Application;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
    const router = new SearchRouter(deps as any);

    app = express();
    app.use(express.json());
    app.use('/api/search', router.router);
  });

  describe('route registration', () => {
    it('should register all search routes', async () => {
      // Text search
      await request(app).get('/api/search/text?q=test');
      expect(deps.observations.searchWithRanking).toHaveBeenCalled();

      // Semantic search (will fall back to text without Qdrant)
      await request(app).get('/api/search/semantic?q=test');
      expect(deps.observations.search).toHaveBeenCalled();

      // Combined search
      await request(app).get('/api/search?q=test');
      expect(deps.observations.search).toHaveBeenCalled();
    });

    it('should register timeline route', async () => {
      deps.observations.findById.mockResolvedValue({
        id: 1,
        title: 'Test',
        created_at_epoch: 1000,
        project: 'test',
      });
      deps.observations.list.mockResolvedValue([]);

      await request(app).get('/api/search/timeline?anchor=1');

      expect(deps.observations.findById).toHaveBeenCalledWith(1);
    });

    it('should register observations route', async () => {
      deps.observations.findById.mockResolvedValue({ id: 1 });

      await request(app).get('/api/search/observations?ids=1,2,3');

      expect(deps.observations.findById).toHaveBeenCalled();
    });
  });

  describe('GET /api/search/text', () => {
    it('should search with highlights by default', async () => {
      deps.observations.searchWithRanking.mockResolvedValue({
        results: [
          { id: 1, title: 'Test', highlight: 'matched <mark>test</mark>' },
        ],
        total: 1,
      });

      const res = await request(app).get('/api/search/text?q=test');

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.body.query.original).toBe('test');
    });

    it('should return 400 without query', async () => {
      const res = await request(app).get('/api/search/text');

      expect(res.status).toBe(400);
    });

    it('should support q alias for query param', async () => {
      deps.observations.searchWithRanking.mockResolvedValue({
        results: [],
        total: 0,
      });

      const res = await request(app).get('/api/search/text?q=test');

      expect(res.status).toBe(200);
    });

    it('should filter by project', async () => {
      deps.observations.searchWithRanking.mockResolvedValue({
        results: [],
        total: 0,
      });

      await request(app).get('/api/search/text?q=test&project=my-project');

      expect(deps.observations.searchWithRanking).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({ project: 'my-project' }),
        expect.anything()
      );
    });

    it('should filter by type', async () => {
      deps.observations.searchWithRanking.mockResolvedValue({
        results: [],
        total: 0,
      });

      await request(app).get('/api/search/text?q=test&type=discovery');

      expect(deps.observations.searchWithRanking).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({ type: 'discovery' }),
        expect.anything()
      );
    });

    it('should support date range filters', async () => {
      deps.observations.searchWithRanking.mockResolvedValue({
        results: [],
        total: 0,
      });

      await request(app).get('/api/search/text?q=test&dateStart=2025-01-01&dateEnd=2025-01-31');

      expect(deps.observations.searchWithRanking).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          dateRange: expect.objectContaining({
            start: expect.any(Number),
            end: expect.any(Number),
          }),
        }),
        expect.anything()
      );
    });

    it('should handle pagination', async () => {
      deps.observations.searchWithRanking.mockResolvedValue({
        results: [],
        total: 100,
      });

      await request(app).get('/api/search/text?q=test&limit=10&offset=20');

      expect(deps.observations.searchWithRanking).toHaveBeenCalledWith(
        'test',
        expect.anything(),
        expect.objectContaining({ limit: 10, offset: 20 })
      );
    });

    it('should include facets when requested', async () => {
      deps.observations.searchWithRanking.mockResolvedValue({
        results: [],
        total: 0,
      });
      deps.observations.getSearchFacets.mockResolvedValue({
        types: { discovery: 5, decision: 3 },
      });

      const res = await request(app).get('/api/search/text?q=test&facets=true');

      expect(res.status).toBe(200);
      expect(res.body.facets).toBeDefined();
      expect(deps.observations.getSearchFacets).toHaveBeenCalled();
    });

    it('should use simple search when highlight=false', async () => {
      deps.observations.search.mockResolvedValue([
        { id: 1, title: 'Test' },
      ]);

      const res = await request(app).get('/api/search/text?q=test&highlight=false');

      expect(res.status).toBe(200);
      expect(deps.observations.search).toHaveBeenCalled();
      expect(deps.observations.searchWithRanking).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/search/semantic', () => {
    it('should fall back to text search when Qdrant disabled', async () => {
      deps.observations.search.mockResolvedValue([
        { id: 1, title: 'Result' },
      ]);

      const res = await request(app).get('/api/search/semantic?q=test');

      expect(res.status).toBe(200);
      expect(res.body.mode).toBe('text');
      expect(res.body.vectorDbEnabled).toBe(false);
      expect(res.body.note).toContain('Enable VECTOR_DB=qdrant');
    });

    it('should return 400 without query', async () => {
      const res = await request(app).get('/api/search/semantic');

      expect(res.status).toBe(400);
    });

    it('should filter by project', async () => {
      deps.observations.search.mockResolvedValue([]);

      await request(app).get('/api/search/semantic?q=test&project=my-project');

      expect(deps.observations.search).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({ project: 'my-project' }),
        expect.anything()
      );
    });
  });

  describe('GET /api/search (combined)', () => {
    it('should use text search', async () => {
      deps.observations.search.mockResolvedValue([
        { id: 1, title: 'Result' },
      ]);

      const res = await request(app).get('/api/search?q=test');

      expect(res.status).toBe(200);
      expect(res.body.mode).toBe('text');
      expect(res.body.items).toHaveLength(1);
    });

    it('should return 400 without query', async () => {
      const res = await request(app).get('/api/search');

      expect(res.status).toBe(400);
    });

    it('should include filters in response', async () => {
      deps.observations.search.mockResolvedValue([]);

      const res = await request(app).get('/api/search?q=test&project=proj&type=discovery');

      expect(res.status).toBe(200);
      expect(res.body.filters.project).toBe('proj');
      expect(res.body.filters.type).toBe('discovery');
    });
  });

  describe('GET /api/search/timeline', () => {
    beforeEach(() => {
      deps.observations.findById.mockResolvedValue({
        id: 5,
        title: 'Anchor',
        created_at_epoch: 1000,
        project: 'test',
      });
    });

    it('should return timeline around anchor', async () => {
      deps.observations.list
        .mockResolvedValueOnce([
          { id: 3, title: 'Before 1', created_at_epoch: 900 },
          { id: 4, title: 'Before 2', created_at_epoch: 950 },
        ])
        .mockResolvedValueOnce([
          { id: 6, title: 'After 1', created_at_epoch: 1100 },
          { id: 7, title: 'After 2', created_at_epoch: 1200 },
        ]);

      const res = await request(app).get('/api/search/timeline?anchor=5');

      expect(res.status).toBe(200);
      expect(res.body.anchor.id).toBe(5);
      expect(res.body.timeline).toHaveLength(5);
    });

    it('should return 400 without anchor or query', async () => {
      const res = await request(app).get('/api/search/timeline');

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent anchor', async () => {
      deps.observations.findById.mockResolvedValue(null);

      const res = await request(app).get('/api/search/timeline?anchor=999');

      expect(res.status).toBe(404);
    });

    it('should find anchor by search query', async () => {
      deps.observations.findById.mockResolvedValue(null);
      deps.observations.search.mockResolvedValue([
        { id: 5, title: 'Found', created_at_epoch: 1000, project: 'test' },
      ]);
      deps.observations.list.mockResolvedValue([]);

      const res = await request(app).get('/api/search/timeline?query=search term');

      expect(res.status).toBe(200);
      expect(res.body.anchor.title).toBe('Found');
    });

    it('should return 404 when search query finds nothing', async () => {
      deps.observations.search.mockResolvedValue([]);

      const res = await request(app).get('/api/search/timeline?query=nonexistent');

      expect(res.status).toBe(404);
    });

    it('should support custom depth', async () => {
      deps.observations.list.mockResolvedValue([]);

      await request(app).get('/api/search/timeline?anchor=5&depth_before=10&depth_after=3');

      // Before query
      expect(deps.observations.list).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.objectContaining({ limit: 10 })
      );

      // After query
      expect(deps.observations.list).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.objectContaining({ limit: 3 })
      );
    });
  });

  describe('GET /api/search/observations', () => {
    it('should fetch observations by IDs', async () => {
      deps.observations.findById
        .mockResolvedValueOnce({ id: 1, title: 'Obs 1' })
        .mockResolvedValueOnce({ id: 2, title: 'Obs 2' })
        .mockResolvedValueOnce(null);

      const res = await request(app).get('/api/search/observations?ids=1,2,3');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.requested).toBe(3);
      expect(res.body.found).toBe(2);
    });

    it('should return 400 without IDs', async () => {
      const res = await request(app).get('/api/search/observations');

      expect(res.status).toBe(400);
    });

    it('should return 400 with no valid IDs', async () => {
      const res = await request(app).get('/api/search/observations?ids=a,b,c');

      expect(res.status).toBe(400);
    });

    it('should filter by project', async () => {
      deps.observations.findById
        .mockResolvedValueOnce({ id: 1, title: 'Obs 1', project: 'proj-a' })
        .mockResolvedValueOnce({ id: 2, title: 'Obs 2', project: 'proj-b' });

      const res = await request(app).get('/api/search/observations?ids=1,2&project=proj-a');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].project).toBe('proj-a');
    });
  });

  describe('error handling', () => {
    it('should handle search errors gracefully', async () => {
      deps.observations.searchWithRanking.mockRejectedValue(new Error('Database error'));

      const res = await request(app).get('/api/search/text?q=test');

      expect(res.status).toBe(500);
    });

    it('should handle FTS5 query errors as bad request', async () => {
      const ftsError = new Error('Invalid search query: unbalanced quotes');
      deps.observations.searchWithRanking.mockRejectedValue(ftsError);

      const res = await request(app).get('/api/search/text?q="unbalanced');

      expect(res.status).toBe(400);
    });
  });
});

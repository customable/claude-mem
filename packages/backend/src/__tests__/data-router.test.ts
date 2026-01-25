/**
 * Tests for DataRouter
 *
 * Tests route registration and basic endpoint behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { DataRouter } from '../routes/data.js';

// Mock cache service
vi.mock('../services/cache-service.js', () => ({
  cacheManager: {
    invalidateAll: vi.fn(),
    onObservationCreated: vi.fn(),
  },
  projectCache: {
    getOrSet: vi.fn().mockImplementation((_key, fn) => fn()),
    has: vi.fn().mockReturnValue(false),
  },
  analyticsCache: {
    getOrSet: vi.fn().mockImplementation((_key, fn) => fn()),
    has: vi.fn().mockReturnValue(false),
  },
  statsCache: {
    getOrSet: vi.fn().mockImplementation((_key, fn) => fn()),
    has: vi.fn().mockReturnValue(false),
  },
  createCacheKey: vi.fn().mockReturnValue('test-key'),
}));

// Create mock dependencies
function createMockDeps() {
  return {
    sessionService: {
      listSessions: vi.fn().mockResolvedValue([]),
      getSession: vi.fn().mockResolvedValue(null),
      deleteSession: vi.fn().mockResolvedValue(false),
      getSessionCount: vi.fn().mockResolvedValue(0),
      getSessionObservations: vi.fn().mockResolvedValue([]),
    },
    taskService: {
      listTasks: vi.fn().mockResolvedValue([]),
      getTask: vi.fn().mockResolvedValue(null),
      getQueueStatus: vi.fn().mockResolvedValue({
        pending: 0,
        assigned: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      }),
      queueEmbedding: vi.fn().mockResolvedValue({}),
    },
    observations: {
      list: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findById: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(false),
      create: vi.fn().mockResolvedValue({ id: 1, title: 'Test', type: 'discovery' }),
      batchDelete: vi.fn().mockResolvedValue(0),
      deleteBySessionId: vi.fn().mockResolvedValue(0),
      getBySessionId: vi.fn().mockResolvedValue([]),
      getCountsBySessionIds: vi.fn().mockResolvedValue(new Map()),
      getFileStatsBySessionIds: vi.fn().mockResolvedValue(new Map()),
      pinObservation: vi.fn().mockResolvedValue(null),
      unpinObservation: vi.fn().mockResolvedValue(null),
      setImportanceBoost: vi.fn().mockResolvedValue(null),
      getPinnedObservations: vi.fn().mockResolvedValue([]),
      getByImportance: vi.fn().mockResolvedValue([]),
      getTimelineStats: vi.fn().mockResolvedValue([]),
    },
    summaries: {
      list: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      getBySessionId: vi.fn().mockResolvedValue([]),
    },
    sessions: {
      list: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      getDistinctProjects: vi.fn().mockResolvedValue([]),
      getTimelineStats: vi.fn().mockResolvedValue([]),
      findByContentSessionId: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 1, content_session_id: 'test' }),
    },
    documents: {
      list: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findById: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(false),
      search: vi.fn().mockResolvedValue([]),
      recordAccess: vi.fn().mockResolvedValue(undefined),
    },
    userPrompts: {
      getBySessionId: vi.fn().mockResolvedValue([]),
      getFirstPromptsForSessions: vi.fn().mockResolvedValue(new Map()),
      getFirstForSession: vi.fn().mockResolvedValue(null),
    },
    codeSnippets: {
      list: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(false),
      search: vi.fn().mockResolvedValue([]),
      getDistinctLanguages: vi.fn().mockResolvedValue([]),
      findByObservationId: vi.fn().mockResolvedValue([]),
    },
    observationLinks: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
      getAllLinks: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(false),
      linkExists: vi.fn().mockResolvedValue(false),
    },
    observationTemplates: {
      list: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 1, name: 'Test' }),
      update: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(false),
    },
    projectSettings: {
      listAll: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      getRecentlyActive: vi.fn().mockResolvedValue([]),
      getOrCreate: vi.fn().mockResolvedValue({ project: 'test' }),
      update: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(false),
    },
  };
}

describe('DataRouter', () => {
  let app: express.Application;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
    const router = new DataRouter(deps as any);

    app = express();
    app.use(express.json());
    app.use('/api/data', router.router);
  });

  describe('route registration', () => {
    it('should register all session routes', async () => {
      await request(app).get('/api/data/sessions');
      await request(app).get('/api/data/sessions/test-id');
      await request(app).delete('/api/data/sessions/test-id');

      expect(deps.sessionService.listSessions).toHaveBeenCalled();
      expect(deps.sessionService.getSession).toHaveBeenCalled();
      expect(deps.sessionService.deleteSession).toHaveBeenCalled();
    });

    it('should register all observation routes', async () => {
      await request(app).get('/api/data/observations');
      await request(app).get('/api/data/observations/1');
      await request(app).get('/api/data/observations/pinned');
      await request(app).get('/api/data/observations/important');

      expect(deps.observations.list).toHaveBeenCalled();
      expect(deps.observations.findById).toHaveBeenCalled();
      expect(deps.observations.getPinnedObservations).toHaveBeenCalled();
      expect(deps.observations.getByImportance).toHaveBeenCalled();
    });

    it('should register task routes', async () => {
      await request(app).get('/api/data/tasks');
      await request(app).get('/api/data/tasks/status/counts');

      expect(deps.taskService.listTasks).toHaveBeenCalled();
      expect(deps.taskService.getQueueStatus).toHaveBeenCalled();
    });

    it('should register document routes', async () => {
      await request(app).get('/api/data/documents');
      await request(app).get('/api/data/documents/search?q=test');
      await request(app).get('/api/data/documents/1');

      expect(deps.documents.list).toHaveBeenCalled();
      expect(deps.documents.search).toHaveBeenCalled();
      expect(deps.documents.findById).toHaveBeenCalled();
    });

    it('should register code snippet routes', async () => {
      await request(app).get('/api/data/code-snippets');
      await request(app).get('/api/data/code-snippets/languages');
      await request(app).get('/api/data/code-snippets/search?q=test');

      expect(deps.codeSnippets.list).toHaveBeenCalled();
      expect(deps.codeSnippets.getDistinctLanguages).toHaveBeenCalled();
      expect(deps.codeSnippets.search).toHaveBeenCalled();
    });
  });

  describe('GET /api/data/sessions', () => {
    it('should return paginated sessions', async () => {
      const mockSessions = [
        { id: 1, content_session_id: 'sess-1', memory_session_id: 'mem-1' },
        { id: 2, content_session_id: 'sess-2', memory_session_id: 'mem-2' },
      ];

      deps.sessionService.listSessions.mockResolvedValue(mockSessions);
      deps.sessionService.getSessionCount.mockResolvedValue(2);
      deps.userPrompts.getFirstPromptsForSessions.mockResolvedValue(new Map());
      deps.observations.getCountsBySessionIds.mockResolvedValue(new Map());
      deps.observations.getFileStatsBySessionIds.mockResolvedValue(new Map());

      const res = await request(app).get('/api/data/sessions');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should filter by project', async () => {
      deps.sessionService.listSessions.mockResolvedValue([]);
      deps.sessionService.getSessionCount.mockResolvedValue(0);

      await request(app).get('/api/data/sessions?project=my-project');

      expect(deps.sessionService.listSessions).toHaveBeenCalledWith(
        expect.objectContaining({ project: 'my-project' })
      );
    });

    it('should handle pagination params', async () => {
      deps.sessionService.listSessions.mockResolvedValue([]);
      deps.sessionService.getSessionCount.mockResolvedValue(0);

      await request(app).get('/api/data/sessions?limit=10&offset=20');

      expect(deps.sessionService.listSessions).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 20 })
      );
    });
  });

  describe('GET /api/data/observations', () => {
    it('should return paginated observations', async () => {
      const mockObs = [
        { id: 1, title: 'Obs 1', type: 'discovery' },
        { id: 2, title: 'Obs 2', type: 'decision' },
      ];

      deps.observations.list.mockResolvedValue(mockObs);
      deps.observations.count.mockResolvedValue(2);

      const res = await request(app).get('/api/data/observations');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should filter by type', async () => {
      deps.observations.list.mockResolvedValue([]);
      deps.observations.count.mockResolvedValue(0);

      await request(app).get('/api/data/observations?type=discovery');

      expect(deps.observations.list).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'discovery' }),
        expect.anything()
      );
    });
  });

  describe('GET /api/data/observations/:id', () => {
    it('should return observation by ID', async () => {
      const mockObs = { id: 1, title: 'Test', type: 'discovery' };
      deps.observations.findById.mockResolvedValue(mockObs);

      const res = await request(app).get('/api/data/observations/1');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
      expect(res.body.title).toBe('Test');
    });

    it('should return 404 for non-existent observation', async () => {
      deps.observations.findById.mockResolvedValue(null);

      const res = await request(app).get('/api/data/observations/999');

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid ID', async () => {
      const res = await request(app).get('/api/data/observations/invalid');

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/data/observations', () => {
    it('should create observation', async () => {
      deps.observations.create.mockResolvedValue({
        id: 1,
        title: 'Test memory',
        type: 'discovery',
      });
      deps.sessions.create.mockResolvedValue({
        id: 1,
        content_session_id: 'manual-test',
        memory_session_id: 'manual-test',
      });

      const res = await request(app)
        .post('/api/data/observations')
        .send({ text: 'Test memory content', project: 'test' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
      expect(res.body.message).toBe('Memory saved successfully');
    });

    it('should return 400 without text', async () => {
      const res = await request(app)
        .post('/api/data/observations')
        .send({ project: 'test' });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/data/observations/:id', () => {
    it('should delete observation', async () => {
      deps.observations.delete.mockResolvedValue(true);

      const res = await request(app).delete('/api/data/observations/1');

      expect(res.status).toBe(204);
    });

    it('should return 404 for non-existent observation', async () => {
      deps.observations.delete.mockResolvedValue(false);

      const res = await request(app).delete('/api/data/observations/999');

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/data/observations (bulk)', () => {
    it('should bulk delete by IDs', async () => {
      deps.observations.batchDelete.mockResolvedValue(3);

      const res = await request(app).delete('/api/data/observations?ids=1,2,3');

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(3);
    });

    it('should bulk delete by session', async () => {
      deps.observations.deleteBySessionId.mockResolvedValue(5);

      const res = await request(app).delete('/api/data/observations?sessionId=sess-1');

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(5);
    });

    it('should return 400 without filters', async () => {
      const res = await request(app).delete('/api/data/observations');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/data/tasks/status/counts', () => {
    it('should return task queue status', async () => {
      deps.taskService.getQueueStatus.mockResolvedValue({
        pending: 5,
        assigned: 2,
        processing: 3,
        completed: 100,
        failed: 1,
      });

      const res = await request(app).get('/api/data/tasks/status/counts');

      expect(res.status).toBe(200);
      expect(res.body.pending).toBe(5);
      expect(res.body.processing).toBe(3);
    });
  });

  describe('GET /api/data/stats', () => {
    it('should return aggregate stats', async () => {
      deps.sessionService.getSessionCount.mockResolvedValue(10);
      deps.observations.count.mockResolvedValue(50);
      deps.summaries.count.mockResolvedValue(5);
      deps.sessions.getDistinctProjects.mockResolvedValue(['proj1', 'proj2']);
      deps.taskService.getQueueStatus.mockResolvedValue({
        pending: 1,
        assigned: 0,
        processing: 0,
        completed: 10,
        failed: 0,
      });

      const res = await request(app).get('/api/data/stats');

      expect(res.status).toBe(200);
      expect(res.body.sessions).toBe(10);
      expect(res.body.observations).toBe(50);
      expect(res.body.summaries).toBe(5);
      expect(res.body.projects).toBe(2);
    });
  });

  describe('GET /api/data/projects', () => {
    it('should return distinct projects', async () => {
      deps.sessions.getDistinctProjects.mockResolvedValue(['project-a', 'project-b']);

      const res = await request(app).get('/api/data/projects');

      expect(res.status).toBe(200);
      expect(res.body.projects).toEqual(['project-a', 'project-b']);
    });

    it('should filter out empty project names', async () => {
      deps.sessions.getDistinctProjects.mockResolvedValue(['project-a', '', null, 'project-b']);

      const res = await request(app).get('/api/data/projects');

      expect(res.status).toBe(200);
      expect(res.body.projects).toEqual(['project-a', 'project-b']);
    });
  });

  describe('GET /api/data/documents/search', () => {
    it('should search documents', async () => {
      deps.documents.search.mockResolvedValue([
        { id: 1, title: 'React Docs', content: 'useState hook...' },
      ]);

      const res = await request(app).get('/api/data/documents/search?q=useState');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.query).toBe('useState');
    });

    it('should return 400 without query', async () => {
      const res = await request(app).get('/api/data/documents/search');

      expect(res.status).toBe(400);
    });
  });

  describe('template routes', () => {
    it('GET /api/data/templates should list templates', async () => {
      deps.observationTemplates.list.mockResolvedValue([
        { id: 1, name: 'Bug Template', type: 'bugfix' },
      ]);

      const res = await request(app).get('/api/data/templates');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('POST /api/data/templates should create template', async () => {
      deps.observationTemplates.create.mockResolvedValue({
        id: 1,
        name: 'New Template',
        type: 'discovery',
      });

      const res = await request(app)
        .post('/api/data/templates')
        .send({
          name: 'New Template',
          type: 'discovery',
          fields: JSON.stringify([{ name: 'description', required: true }]),
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New Template');
    });

    it('POST /api/data/templates should return 400 without required fields', async () => {
      const res = await request(app)
        .post('/api/data/templates')
        .send({ name: 'Incomplete' });

      expect(res.status).toBe(400);
    });
  });

  describe('observation link routes', () => {
    it('POST /api/data/observations/:id/links should create link', async () => {
      deps.observationLinks.create.mockResolvedValue({
        id: 1,
        source_observation_id: 1,
        target_observation_id: 2,
        link_type: 'related',
      });

      const res = await request(app)
        .post('/api/data/observations/1/links')
        .send({ targetId: 2, linkType: 'related' });

      expect(res.status).toBe(200);
    });

    it('POST /api/data/observations/:id/links should prevent self-links', async () => {
      const res = await request(app)
        .post('/api/data/observations/1/links')
        .send({ targetId: 1, linkType: 'related' });

      expect(res.status).toBe(400);
    });

    it('POST /api/data/observations/:id/links should prevent duplicate links', async () => {
      deps.observationLinks.linkExists.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/data/observations/1/links')
        .send({ targetId: 2, linkType: 'related' });

      expect(res.status).toBe(400);
    });
  });

  describe('project settings routes', () => {
    it('GET /api/data/project-settings/:project should return settings', async () => {
      deps.projectSettings.getOrCreate.mockResolvedValue({
        project: 'my-project',
        displayName: 'My Project',
      });

      const res = await request(app).get('/api/data/project-settings/my-project');

      expect(res.status).toBe(200);
      expect(res.body.project).toBe('my-project');
    });

    it('PUT /api/data/project-settings/:project should update settings', async () => {
      deps.projectSettings.update.mockResolvedValue({
        project: 'my-project',
        displayName: 'Updated Name',
      });

      const res = await request(app)
        .put('/api/data/project-settings/my-project')
        .send({ displayName: 'Updated Name' });

      expect(res.status).toBe(200);
    });
  });
});

/**
 * Tests for TaskService
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskService } from '../services/task-service.js';

// Mock dependencies
const mockTaskQueue = {
  create: vi.fn(),
  createIfNotExists: vi.fn(),
  findById: vi.fn(),
  countByStatus: vi.fn(),
  list: vi.fn(),
  cleanup: vi.fn(),
};

const mockSSEBroadcaster = {
  broadcastTaskQueued: vi.fn(),
};

const mockObservations = {
  list: vi.fn(),
  getBySessionId: vi.fn(),
};

const mockSessions = {
  findByContentSessionId: vi.fn(),
};

const mockSummaries = {
  list: vi.fn(),
};

const mockArchivedOutputs = {
  create: vi.fn(),
};

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockTaskQueue.countByStatus.mockResolvedValue({
      pending: 0,
      assigned: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    });

    mockTaskQueue.create.mockImplementation(async (params) => ({
      id: 'task-123',
      type: params.type,
      status: 'pending',
      requiredCapability: params.requiredCapability,
      fallbackCapabilities: params.fallbackCapabilities,
      priority: params.priority,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: params.maxRetries,
      payload: params.payload,
    }));

    mockTaskQueue.createIfNotExists.mockImplementation(async (params) => ({
      id: 'task-456',
      type: params.type,
      status: 'pending',
      requiredCapability: params.requiredCapability,
      priority: params.priority,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: params.maxRetries,
      payload: params.payload,
    }));

    service = new TaskService(
      mockTaskQueue as any,
      mockSSEBroadcaster as any,
      mockObservations as any,
      mockSessions as any,
      mockSummaries as any,
      mockArchivedOutputs as any,
      { maxPendingTasks: 100 }
    );
  });

  describe('constructor', () => {
    it('should create service with default options', () => {
      const basicService = new TaskService(
        mockTaskQueue as any,
        mockSSEBroadcaster as any
      );
      expect(basicService).toBeDefined();
    });

    it('should accept custom options', () => {
      const customService = new TaskService(
        mockTaskQueue as any,
        mockSSEBroadcaster as any,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          defaultMaxRetries: 5,
          defaultPriority: 100,
          maxPendingTasks: 500,
        }
      );
      expect(customService).toBeDefined();
    });
  });

  describe('queueObservation', () => {
    it('should create observation task', async () => {
      const task = await service.queueObservation({
        sessionId: 'session-1',
        project: 'test-project',
        toolName: 'Read',
        toolInput: '{"path": "/test.ts"}',
        toolOutput: 'file contents',
      });

      expect(task).toBeDefined();
      expect(task.type).toBe('observation');
      expect(mockTaskQueue.create).toHaveBeenCalled();
      expect(mockSSEBroadcaster.broadcastTaskQueued).toHaveBeenCalledWith('task-123', 'observation');
    });

    it('should include optional parameters', async () => {
      await service.queueObservation({
        sessionId: 'session-1',
        project: 'test-project',
        toolName: 'Read',
        toolInput: '{}',
        toolOutput: 'output',
        promptNumber: 5,
        gitBranch: 'main',
        cwd: '/home/user/project',
        targetDirectory: '/home/user/project/src',
      });

      expect(mockTaskQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            promptNumber: 5,
            gitBranch: 'main',
            cwd: '/home/user/project',
            targetDirectory: '/home/user/project/src',
          }),
        })
      );
    });

    it('should throw when queue is full (backpressure)', async () => {
      mockTaskQueue.countByStatus.mockResolvedValue({
        pending: 50,
        assigned: 30,
        processing: 25,
        completed: 1000,
        failed: 10,
      });

      await expect(
        service.queueObservation({
          sessionId: 'session-1',
          project: 'test-project',
          toolName: 'Read',
          toolInput: '{}',
          toolOutput: 'output',
        })
      ).rejects.toThrow('Task queue full');
    });

    it('should use preferred provider when specified', async () => {
      await service.queueObservation({
        sessionId: 'session-1',
        project: 'test-project',
        toolName: 'Read',
        toolInput: '{}',
        toolOutput: 'output',
        preferredProvider: 'gemini',
      });

      expect(mockTaskQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requiredCapability: 'observation:gemini',
        })
      );
    });
  });

  describe('queueSummarize', () => {
    beforeEach(() => {
      mockSessions.findByContentSessionId.mockResolvedValue({
        user_prompt: 'User question here',
      });
      mockObservations.getBySessionId.mockResolvedValue([
        { id: 1, type: 'discovery', title: 'Found something', text: 'Details' },
        { id: 2, type: 'decision', title: 'Decided something', text: 'Reason' },
      ]);
    });

    it('should create summarize task', async () => {
      const task = await service.queueSummarize({
        sessionId: 'session-1',
        project: 'test-project',
      });

      expect(task).toBeDefined();
      expect(task.type).toBe('summarize');
      expect(mockTaskQueue.create).toHaveBeenCalled();
      expect(mockSSEBroadcaster.broadcastTaskQueued).toHaveBeenCalledWith('task-123', 'summarize');
    });

    it('should include user prompt and observations', async () => {
      await service.queueSummarize({
        sessionId: 'session-1',
        project: 'test-project',
      });

      expect(mockTaskQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            userPrompt: 'User question here',
            observations: expect.arrayContaining([
              expect.objectContaining({ id: 1, title: 'Found something' }),
              expect.objectContaining({ id: 2, title: 'Decided something' }),
            ]),
          }),
        })
      );
    });

    it('should have lower priority than observations', async () => {
      await service.queueSummarize({
        sessionId: 'session-1',
        project: 'test-project',
      });

      const createCall = mockTaskQueue.create.mock.calls[0][0];
      expect(createCall.priority).toBe(40); // defaultPriority (50) - 10
    });
  });

  describe('queueEmbedding', () => {
    it('should create embedding task', async () => {
      const task = await service.queueEmbedding({
        observationIds: [1, 2, 3],
      });

      expect(task).toBeDefined();
      expect(task.type).toBe('embedding');
      expect(mockTaskQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: { observationIds: [1, 2, 3] },
        })
      );
    });

    it('should use local embedding by default', async () => {
      await service.queueEmbedding({ observationIds: [1] });

      expect(mockTaskQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requiredCapability: 'embedding:local',
        })
      );
    });
  });

  describe('queueClaudeMd', () => {
    beforeEach(() => {
      mockObservations.list.mockResolvedValue([
        {
          id: 1,
          title: 'Observation 1',
          text: 'Text 1',
          type: 'discovery',
          created_at: '2025-01-01T00:00:00Z',
        },
      ]);
      mockSummaries.list.mockResolvedValue([
        {
          request: 'User request',
          learned: 'Learned something',
          created_at_epoch: Date.now(),
        },
      ]);
    });

    it('should create claude-md task', async () => {
      const task = await service.queueClaudeMd({
        contentSessionId: 'content-123',
        memorySessionId: 'memory-456',
        project: 'test-project',
        workingDirectory: '/home/user/project',
      });

      expect(task).toBeDefined();
      expect(task.type).toBe('claude-md');
      expect(mockTaskQueue.createIfNotExists).toHaveBeenCalled();
    });

    it('should deduplicate tasks using createIfNotExists', async () => {
      mockTaskQueue.createIfNotExists.mockResolvedValue(null);

      const task = await service.queueClaudeMd({
        contentSessionId: 'content-123',
        memorySessionId: 'memory-456',
        project: 'test-project',
      });

      // Returns null for deduplicated task
      expect(task).toBeNull();
      expect(mockSSEBroadcaster.broadcastTaskQueued).not.toHaveBeenCalled();
    });

    it('should filter observations by targetDirectory', async () => {
      await service.queueClaudeMd({
        contentSessionId: 'content-123',
        memorySessionId: 'memory-456',
        project: 'test-project',
        workingDirectory: '/home/user/project',
        targetDirectory: '/home/user/project/src',
      });

      expect(mockObservations.list).toHaveBeenCalledWith(
        expect.objectContaining({
          cwdPrefix: '/home/user/project/src',
        }),
        expect.anything()
      );
    });
  });

  describe('getTask', () => {
    it('should return task by ID', async () => {
      const mockTask = { id: 'task-123', type: 'observation', status: 'completed' };
      mockTaskQueue.findById.mockResolvedValue(mockTask);

      const task = await service.getTask('task-123');

      expect(task).toEqual(mockTask);
      expect(mockTaskQueue.findById).toHaveBeenCalledWith('task-123');
    });

    it('should return null for non-existent task', async () => {
      mockTaskQueue.findById.mockResolvedValue(null);

      const task = await service.getTask('non-existent');

      expect(task).toBeNull();
    });
  });

  describe('getQueueStatus', () => {
    it('should return queue status counts', async () => {
      const counts = {
        pending: 5,
        assigned: 2,
        processing: 1,
        completed: 100,
        failed: 3,
      };
      mockTaskQueue.countByStatus.mockResolvedValue(counts);

      const status = await service.getQueueStatus();

      expect(status).toEqual(counts);
    });
  });

  describe('listTasks', () => {
    it('should list tasks with default options', async () => {
      const mockTasks = [{ id: 'task-1' }, { id: 'task-2' }];
      mockTaskQueue.list.mockResolvedValue(mockTasks);

      const tasks = await service.listTasks({});

      expect(tasks).toEqual(mockTasks);
      expect(mockTaskQueue.list).toHaveBeenCalledWith(
        { status: undefined, type: undefined },
        { limit: 50, offset: undefined }
      );
    });

    it('should filter by status and type', async () => {
      await service.listTasks({
        status: 'pending',
        type: 'observation',
        limit: 10,
        offset: 20,
      });

      expect(mockTaskQueue.list).toHaveBeenCalledWith(
        { status: 'pending', type: 'observation' },
        { limit: 10, offset: 20 }
      );
    });
  });

  describe('cleanup', () => {
    it('should cleanup old tasks', async () => {
      mockTaskQueue.cleanup.mockResolvedValue(15);

      const deleted = await service.cleanup(86400000);

      expect(deleted).toBe(15);
      expect(mockTaskQueue.cleanup).toHaveBeenCalledWith(86400000);
    });

    it('should use default cleanup age', async () => {
      mockTaskQueue.cleanup.mockResolvedValue(0);

      await service.cleanup();

      expect(mockTaskQueue.cleanup).toHaveBeenCalledWith(86400000); // 24 hours
    });
  });

  describe('executeSemanticSearch', () => {
    it('should queue and wait for search result', async () => {
      mockTaskQueue.create.mockResolvedValue({
        id: 'search-task-1',
        type: 'semantic-search',
        status: 'pending',
      });

      // Simulate task completing on second poll
      mockTaskQueue.findById
        .mockResolvedValueOnce({
          id: 'search-task-1',
          status: 'processing',
        })
        .mockResolvedValueOnce({
          id: 'search-task-1',
          status: 'completed',
          result: {
            results: [{ id: 1, score: 0.9 }],
            totalCount: 1,
            query: 'test query',
          },
        });

      const result = await service.executeSemanticSearch({
        query: 'test query',
        limit: 10,
        timeoutMs: 5000,
      });

      expect(result).toEqual({
        results: [{ id: 1, score: 0.9 }],
        totalCount: 1,
        query: 'test query',
      });
    });

    it('should throw on task failure', async () => {
      mockTaskQueue.create.mockResolvedValue({
        id: 'search-task-1',
        status: 'pending',
      });

      mockTaskQueue.findById.mockResolvedValue({
        id: 'search-task-1',
        status: 'failed',
        error: 'Search engine unavailable',
      });

      await expect(
        service.executeSemanticSearch({
          query: 'test',
          timeoutMs: 1000,
        })
      ).rejects.toThrow('Semantic search failed: Search engine unavailable');
    });

    it('should throw on timeout', async () => {
      mockTaskQueue.create.mockResolvedValue({
        id: 'search-task-1',
        status: 'pending',
      });

      mockTaskQueue.findById.mockResolvedValue({
        id: 'search-task-1',
        status: 'processing', // Never completes
      });

      await expect(
        service.executeSemanticSearch({
          query: 'test',
          timeoutMs: 200, // Very short timeout
        })
      ).rejects.toThrow('Semantic search timed out after 200ms');
    }, 5000);
  });

  describe('capability resolution', () => {
    it('should use default mistral provider for observation', async () => {
      await service.queueObservation({
        sessionId: 'session-1',
        project: 'test',
        toolName: 'Read',
        toolInput: '{}',
        toolOutput: 'output',
      });

      expect(mockTaskQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requiredCapability: 'observation:mistral',
          fallbackCapabilities: expect.arrayContaining([
            'observation:gemini',
            'observation:openrouter',
          ]),
        })
      );
    });

    it('should not include primary capability in fallbacks', async () => {
      await service.queueObservation({
        sessionId: 'session-1',
        project: 'test',
        toolName: 'Read',
        toolInput: '{}',
        toolOutput: 'output',
        preferredProvider: 'gemini',
      });

      const createCall = mockTaskQueue.create.mock.calls[0][0];
      expect(createCall.requiredCapability).toBe('observation:gemini');
      expect(createCall.fallbackCapabilities).not.toContain('observation:gemini');
    });
  });
});

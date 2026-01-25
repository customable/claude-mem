/**
 * TaskRepository Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MikroORM } from '@mikro-orm/core';
import type { SqlEntityManager } from '@mikro-orm/knex';
import type { WorkerCapability } from '@claude-mem/types';
import { createMikroOrmConfig } from '../mikro-orm.config.js';
import { MikroOrmTaskRepository } from '../mikro-orm/repositories/TaskRepository.js';

/**
 * Helper to create task input with defaults
 * Uses 'any' to bypass strict type checking in tests
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function taskInput(overrides: {
  type: string;
  payload: unknown;
  requiredCapability: WorkerCapability;
  priority?: number;
  maxRetries?: number;
  fallbackCapabilities?: WorkerCapability[];
}): any {
  return {
    type: overrides.type,
    payload: overrides.payload,
    requiredCapability: overrides.requiredCapability,
    priority: overrides.priority ?? 0,
    maxRetries: overrides.maxRetries ?? 3,
    fallbackCapabilities: overrides.fallbackCapabilities,
  };
}

describe('TaskRepository', () => {
  let orm: MikroORM;
  let em: SqlEntityManager;
  let repo: MikroOrmTaskRepository;

  beforeEach(async () => {
    const config = createMikroOrmConfig({ type: 'sqlite', dbPath: ':memory:' });
    orm = await MikroORM.init(config as Parameters<typeof MikroORM.init>[0]);
    await orm.migrator.up();
    em = orm.em.fork() as SqlEntityManager;
    repo = new MikroOrmTaskRepository(em);
  });

  afterEach(async () => {
    await orm.close();
  });

  describe('create', () => {
    it('should create a task with required fields', async () => {
      const task = await repo.create(taskInput({
        type: 'observation',
        payload: { sessionId: 'session-1' },
        requiredCapability: 'observation:mistral',
      }));

      expect(task.id).toBeDefined();
      expect(task.type).toBe('observation');
      expect(task.status).toBe('pending');
      expect(task.requiredCapability).toBe('observation:mistral');
      expect(task.payload).toEqual({ sessionId: 'session-1' });
    });

    it('should create a task with optional fields', async () => {
      const task = await repo.create(taskInput({
        type: 'summarize',
        payload: { content: 'test' },
        requiredCapability: 'observation:mistral',
        fallbackCapabilities: ['summarize:mistral', 'summarize:gemini'],
        priority: 5,
        maxRetries: 3,
      }));

      expect(task.priority).toBe(5);
      expect(task.maxRetries).toBe(3);
      expect(task.fallbackCapabilities).toEqual(['summarize:mistral', 'summarize:gemini']);
    });

    it('should generate deduplication key automatically', async () => {
      const task = await repo.create(taskInput({
        type: 'observation',
        payload: { sessionId: 'session-1' },
        requiredCapability: 'observation:mistral',
      }));

      expect(task.deduplicationKey).toBeDefined();
      expect(task.deduplicationKey).toMatch(/^observation:/);
    });
  });

  describe('createIfNotExists', () => {
    it('should create task if no duplicate exists', async () => {
      const task = await repo.createIfNotExists(taskInput({
        type: 'observation',
        payload: { sessionId: 'unique-session' },
        requiredCapability: 'observation:mistral',
      }));

      expect(task).not.toBeNull();
      expect(task?.type).toBe('observation');
    });

    it('should return null if duplicate pending task exists', async () => {
      // Create first task
      await repo.create(taskInput({
        type: 'observation',
        payload: { sessionId: 'duplicate-session' },
        requiredCapability: 'observation:mistral',
      }));

      // Try to create duplicate
      const duplicate = await repo.createIfNotExists(taskInput({
        type: 'observation',
        payload: { sessionId: 'duplicate-session' },
        requiredCapability: 'observation:mistral',
      }));

      expect(duplicate).toBeNull();
    });

    it('should allow creation if existing task is completed', async () => {
      // Create and complete first task
      const task1 = await repo.create(taskInput({
        type: 'observation',
        payload: { sessionId: 'completed-session' },
        requiredCapability: 'observation:mistral',
      }));
      await repo.updateStatus(task1.id, 'completed');

      // Should be able to create new task with same payload
      const task2 = await repo.createIfNotExists(taskInput({
        type: 'observation',
        payload: { sessionId: 'completed-session' },
        requiredCapability: 'observation:mistral',
      }));

      expect(task2).not.toBeNull();
    });
  });

  describe('findById', () => {
    it('should find task by ID', async () => {
      const created = await repo.create(taskInput({
        type: 'observation',
        payload: { test: true },
        requiredCapability: 'observation:mistral',
      }));

      const found = await repo.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const found = await repo.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should update task status', async () => {
      const task = await repo.create(taskInput({
        type: 'observation',
        payload: {},
        requiredCapability: 'observation:mistral',
      }));

      const updated = await repo.updateStatus(task.id, 'processing');

      expect(updated?.status).toBe('processing');
    });

    it('should set completedAt when completing task', async () => {
      const task = await repo.create(taskInput({
        type: 'observation',
        payload: {},
        requiredCapability: 'observation:mistral',
      }));

      const updated = await repo.updateStatus(task.id, 'completed');

      expect(updated?.completedAt).toBeDefined();
    });

    it('should update result when provided', async () => {
      const task = await repo.create(taskInput({
        type: 'observation',
        payload: {},
        requiredCapability: 'observation:mistral',
      }));

      const updated = await repo.updateStatus(task.id, 'completed', {
        result: { observationId: 123 },
      });

      expect(updated?.result).toEqual({ observationId: 123 });
    });

    it('should update error when provided', async () => {
      const task = await repo.create(taskInput({
        type: 'observation',
        payload: {},
        requiredCapability: 'observation:mistral',
      }));

      const updated = await repo.updateStatus(task.id, 'failed', {
        error: 'Something went wrong',
      });

      expect(updated?.error).toBe('Something went wrong');
    });
  });

  describe('assign', () => {
    it('should assign task to worker', async () => {
      const task = await repo.create(taskInput({
        type: 'observation',
        payload: {},
        requiredCapability: 'observation:mistral',
      }));

      const assigned = await repo.assign(task.id, 'worker-1');

      expect(assigned?.status).toBe('assigned');
      expect(assigned?.assignedWorkerId).toBe('worker-1');
      expect(assigned?.assignedAt).toBeDefined();
    });

    it('should not assign already assigned task', async () => {
      const task = await repo.create(taskInput({
        type: 'observation',
        payload: {},
        requiredCapability: 'observation:mistral',
      }));

      // Assign once
      await repo.assign(task.id, 'worker-1');

      // Try to assign again (should fail because status is now 'assigned')
      const secondAssign = await repo.assign(task.id, 'worker-2');
      expect(secondAssign).toBeNull();
    });
  });

  describe('getNextPending', () => {
    it('should get next pending task matching capability', async () => {
      await repo.create(taskInput({
        type: 'observation',
        payload: { order: 1 },
        requiredCapability: 'observation:mistral',
      }));

      const next = await repo.getNextPending(['observation:mistral']);

      expect(next).not.toBeNull();
      expect(next?.requiredCapability).toBe('observation:mistral');
    });

    it('should prioritize by priority field', async () => {
      await repo.create(taskInput({
        type: 'low-priority',
        payload: {},
        requiredCapability: 'observation:mistral',
        priority: 1,
      }));
      await repo.create(taskInput({
        type: 'high-priority',
        payload: {},
        requiredCapability: 'observation:mistral',
        priority: 10,
      }));

      const next = await repo.getNextPending(['observation:mistral']);

      expect(next?.type).toBe('high-priority'); // Higher priority
    });

    it('should return null if no matching tasks', async () => {
      await repo.create(taskInput({
        type: 'observation',
        payload: {},
        requiredCapability: 'embedding:local',
      }));

      const next = await repo.getNextPending(['observation:mistral']);

      expect(next).toBeNull();
    });

    it('should match fallback capabilities', async () => {
      await repo.create(taskInput({
        type: 'observation',
        payload: {},
        requiredCapability: 'embedding:local',
        fallbackCapabilities: ['observation:mistral'],
      }));

      const next = await repo.getNextPending(['observation:mistral']);

      expect(next).not.toBeNull();
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await repo.create(taskInput({ type: 'observation', payload: {}, requiredCapability: 'observation:mistral' }));
      await repo.create(taskInput({ type: 'summarize', payload: {}, requiredCapability: 'observation:mistral' }));
      const task3 = await repo.create(taskInput({ type: 'observation', payload: {}, requiredCapability: 'observation:mistral' }));
      await repo.updateStatus(task3.id, 'completed');
    });

    it('should list all tasks', async () => {
      const tasks = await repo.list();
      expect(tasks.length).toBe(3);
    });

    it('should filter by status', async () => {
      const tasks = await repo.list({ status: 'pending' });
      expect(tasks.length).toBe(2);
    });

    it('should filter by type', async () => {
      const tasks = await repo.list({ type: 'observation' });
      expect(tasks.length).toBe(2);
    });

    it('should filter by multiple statuses', async () => {
      const tasks = await repo.list({ status: ['pending', 'completed'] });
      expect(tasks.length).toBe(3);
    });
  });

  describe('countByStatus', () => {
    it('should count tasks by status', async () => {
      await repo.create(taskInput({ type: 'observation', payload: {}, requiredCapability: 'observation:mistral' }));
      await repo.create(taskInput({ type: 'observation', payload: {}, requiredCapability: 'observation:mistral' }));
      const task3 = await repo.create(taskInput({ type: 'observation', payload: {}, requiredCapability: 'observation:mistral' }));
      await repo.updateStatus(task3.id, 'completed');

      const counts = await repo.countByStatus();

      expect(counts.pending).toBe(2);
      expect(counts.completed).toBe(1);
      expect(counts.failed).toBe(0);
    });
  });

  describe('getByWorkerId', () => {
    it('should get tasks by worker ID', async () => {
      const task1 = await repo.create(taskInput({ type: 'observation', payload: {}, requiredCapability: 'observation:mistral' }));
      const task2 = await repo.create(taskInput({ type: 'observation', payload: {}, requiredCapability: 'observation:mistral' }));
      await repo.create(taskInput({ type: 'observation', payload: {}, requiredCapability: 'observation:mistral' }));

      await repo.assign(task1.id, 'worker-1');
      await repo.assign(task2.id, 'worker-1');

      const tasks = await repo.getByWorkerId('worker-1');

      expect(tasks.length).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should delete old completed/failed tasks', async () => {
      const task = await repo.create(taskInput({
        type: 'observation',
        payload: {},
        requiredCapability: 'observation:mistral',
      }));
      await repo.updateStatus(task.id, 'completed');

      // Cleanup tasks older than 0ms (all of them)
      const deleted = await repo.cleanup(0);

      expect(deleted).toBe(1);
    });

    it('should not delete pending tasks', async () => {
      await repo.create(taskInput({
        type: 'observation',
        payload: {},
        requiredCapability: 'observation:mistral',
      }));

      const deleted = await repo.cleanup(0);

      expect(deleted).toBe(0);
    });
  });

  describe('batchUpdateStatus', () => {
    it('should update multiple tasks at once', async () => {
      const task1 = await repo.create(taskInput({ type: 'observation', payload: {}, requiredCapability: 'observation:mistral' }));
      const task2 = await repo.create(taskInput({ type: 'observation', payload: {}, requiredCapability: 'observation:mistral' }));
      const task3 = await repo.create(taskInput({ type: 'observation', payload: {}, requiredCapability: 'observation:mistral' }));

      const updated = await repo.batchUpdateStatus([task1.id, task2.id], 'failed');

      expect(updated).toBe(2);

      // Verify updates
      const found1 = await repo.findById(task1.id);
      const found2 = await repo.findById(task2.id);
      const found3 = await repo.findById(task3.id);

      expect(found1?.status).toBe('failed');
      expect(found2?.status).toBe('failed');
      expect(found3?.status).toBe('pending'); // Unchanged
    });

    it('should handle empty array', async () => {
      const updated = await repo.batchUpdateStatus([], 'failed');
      expect(updated).toBe(0);
    });
  });
});

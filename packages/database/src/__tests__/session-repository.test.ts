/**
 * SessionRepository Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MikroORM } from '@mikro-orm/core';
import type { SqlEntityManager } from '@mikro-orm/knex';
import { createMikroOrmConfig, entities, migrationsList } from '../mikro-orm.config.js';
import { MikroOrmSessionRepository } from '../mikro-orm/repositories/SessionRepository.js';

describe('SessionRepository', () => {
  let orm: MikroORM;
  let em: SqlEntityManager;
  let repo: MikroOrmSessionRepository;

  beforeEach(async () => {
    const config = createMikroOrmConfig({ type: 'sqlite', dbPath: ':memory:' });
    orm = await MikroORM.init(config as Parameters<typeof MikroORM.init>[0]);

    // Run migrations
    await orm.migrator.up();

    em = orm.em.fork() as SqlEntityManager;
    repo = new MikroOrmSessionRepository(em);
  });

  afterEach(async () => {
    await orm.close();
  });

  describe('create', () => {
    it('should create a session with required fields', async () => {
      const session = await repo.create({
        contentSessionId: 'session-123',
        project: 'test-project',
      });

      expect(session.id).toBeDefined();
      expect(session.content_session_id).toBe('session-123');
      expect(session.project).toBe('test-project');
      expect(session.status).toBe('active');
      expect(session.started_at_epoch).toBeGreaterThan(0);
    });

    it('should create a session with optional fields', async () => {
      const session = await repo.create({
        contentSessionId: 'session-456',
        project: 'test-project',
        memorySessionId: 'memory-123',
        userPrompt: 'Fix the bug',
        workingDirectory: '/home/user/project',
        repoPath: '/home/user/project',
        isWorktree: false,
        branch: 'main',
      });

      expect(session.memory_session_id).toBe('memory-123');
      expect(session.user_prompt).toBe('Fix the bug');
      expect(session.working_directory).toBe('/home/user/project');
      expect(session.repo_path).toBe('/home/user/project');
      expect(session.is_worktree).toBe(false);
      expect(session.branch).toBe('main');
    });
  });

  describe('findById', () => {
    it('should find session by ID', async () => {
      const created = await repo.create({
        contentSessionId: 'session-find',
        project: 'test-project',
      });

      const found = await repo.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const found = await repo.findById(99999);
      expect(found).toBeNull();
    });
  });

  describe('findByContentSessionId', () => {
    it('should find session by content session ID', async () => {
      await repo.create({
        contentSessionId: 'unique-content-id',
        project: 'test-project',
      });

      const found = await repo.findByContentSessionId('unique-content-id');

      expect(found).not.toBeNull();
      expect(found?.content_session_id).toBe('unique-content-id');
    });
  });

  describe('findByMemorySessionId', () => {
    it('should find session by memory session ID', async () => {
      await repo.create({
        contentSessionId: 'content-123',
        project: 'test-project',
        memorySessionId: 'unique-memory-id',
      });

      const found = await repo.findByMemorySessionId('unique-memory-id');

      expect(found).not.toBeNull();
      expect(found?.memory_session_id).toBe('unique-memory-id');
    });
  });

  describe('update', () => {
    it('should update session status', async () => {
      const created = await repo.create({
        contentSessionId: 'session-update',
        project: 'test-project',
      });

      const updated = await repo.update(created.id, { status: 'completed' });

      expect(updated?.status).toBe('completed');
    });

    it('should update completedAt when provided', async () => {
      const created = await repo.create({
        contentSessionId: 'session-complete',
        project: 'test-project',
      });

      const completedAt = new Date();
      const updated = await repo.update(created.id, {
        status: 'completed',
        completedAt,
      });

      expect(updated?.completed_at).not.toBeNull();
      expect(updated?.completed_at_epoch).toBeGreaterThan(0);
    });

    it('should return null for non-existent ID', async () => {
      const updated = await repo.update(99999, { status: 'completed' });
      expect(updated).toBeNull();
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await repo.create({ contentSessionId: 's1', project: 'project-a' });
      await repo.create({ contentSessionId: 's2', project: 'project-a' });
      await repo.create({ contentSessionId: 's3', project: 'project-b' });
    });

    it('should list all sessions', async () => {
      const sessions = await repo.list();
      expect(sessions.length).toBe(3);
    });

    it('should filter by project', async () => {
      const sessions = await repo.list({ project: 'project-a' });
      expect(sessions.length).toBe(2);
    });

    it('should filter by status', async () => {
      const sessions = await repo.list({ status: 'active' });
      expect(sessions.length).toBe(3);
    });

    it('should respect limit option', async () => {
      const sessions = await repo.list({}, { limit: 2 });
      expect(sessions.length).toBe(2);
    });

    it('should respect offset option', async () => {
      const sessions = await repo.list({}, { limit: 2, offset: 2 });
      expect(sessions.length).toBe(1);
    });
  });

  describe('count', () => {
    it('should count sessions', async () => {
      await repo.create({ contentSessionId: 's1', project: 'project-a' });
      await repo.create({ contentSessionId: 's2', project: 'project-a' });
      await repo.create({ contentSessionId: 's3', project: 'project-b' });

      const count = await repo.count();
      expect(count).toBe(3);
    });

    it('should count with filters', async () => {
      await repo.create({ contentSessionId: 's1', project: 'project-a' });
      await repo.create({ contentSessionId: 's2', project: 'project-b' });

      const count = await repo.count({ project: 'project-a' });
      expect(count).toBe(1);
    });
  });

  describe('getActiveSession', () => {
    it('should get most recent active session for project', async () => {
      await repo.create({ contentSessionId: 's1', project: 'project-a' });
      await repo.create({ contentSessionId: 's2', project: 'project-a' });

      const active = await repo.getActiveSession('project-a');

      expect(active).not.toBeNull();
      expect(active?.content_session_id).toBe('s2'); // Most recent
    });

    it('should return null if no active session', async () => {
      const created = await repo.create({ contentSessionId: 's1', project: 'project-a' });
      await repo.update(created.id, { status: 'completed' });

      const active = await repo.getActiveSession('project-a');
      expect(active).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete session', async () => {
      const created = await repo.create({
        contentSessionId: 'session-delete',
        project: 'test-project',
      });

      const deleted = await repo.delete(created.id);
      expect(deleted).toBe(true);

      const found = await repo.findById(created.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent ID', async () => {
      const deleted = await repo.delete(99999);
      expect(deleted).toBe(false);
    });
  });

  describe('getDistinctProjects', () => {
    it('should return distinct project names', async () => {
      await repo.create({ contentSessionId: 's1', project: 'project-a' });
      await repo.create({ contentSessionId: 's2', project: 'project-a' });
      await repo.create({ contentSessionId: 's3', project: 'project-b' });
      await repo.create({ contentSessionId: 's4', project: 'project-c' });

      const projects = await repo.getDistinctProjects();

      expect(projects).toHaveLength(3);
      expect(projects).toContain('project-a');
      expect(projects).toContain('project-b');
      expect(projects).toContain('project-c');
    });
  });

  describe('completeStale', () => {
    it('should complete stale sessions', async () => {
      // Create a session that will be stale
      const session = await repo.create({
        contentSessionId: 'stale-session',
        project: 'test-project',
      });

      // Complete stale sessions older than 0ms (all of them)
      const completed = await repo.completeStale(0);

      expect(completed).toBe(1);

      const found = await repo.findById(session.id);
      expect(found?.status).toBe('completed');
    });
  });
});

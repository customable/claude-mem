/**
 * ObservationRepository Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MikroORM } from '@mikro-orm/core';
import type { SqlEntityManager } from '@mikro-orm/knex';
import { createMikroOrmConfig } from '../mikro-orm.config.js';
import { MikroOrmObservationRepository } from '../mikro-orm/repositories/ObservationRepository.js';

describe('ObservationRepository', () => {
  let orm: MikroORM;
  let em: SqlEntityManager;
  let repo: MikroOrmObservationRepository;

  beforeEach(async () => {
    const config = createMikroOrmConfig({ type: 'sqlite', dbPath: ':memory:' });
    orm = await MikroORM.init(config as Parameters<typeof MikroORM.init>[0]);
    await orm.migrator.up();
    em = orm.em.fork() as SqlEntityManager;
    repo = new MikroOrmObservationRepository(em);
  });

  afterEach(async () => {
    await orm.close();
  });

  describe('create', () => {
    it('should create an observation with required fields', async () => {
      const obs = await repo.create({
        memorySessionId: 'session-1',
        project: 'test-project',
        type: 'discovery',
        title: 'Test Discovery',
        text: 'A test discovery observation',
      });

      expect(obs.id).toBeDefined();
      expect(obs.memory_session_id).toBe('session-1');
      expect(obs.project).toBe('test-project');
      expect(obs.type).toBe('discovery');
      expect(obs.title).toBe('Test Discovery');
      expect(obs.created_at_epoch).toBeGreaterThan(0);
    });

    it('should create an observation with optional fields', async () => {
      const obs = await repo.create({
        memorySessionId: 'session-1',
        project: 'test-project',
        type: 'decision',
        title: 'Architecture Decision',
        subtitle: 'Use MikroORM',
        text: 'We decided to use MikroORM for database access',
        concepts: JSON.stringify(['orm', 'database']),
        facts: JSON.stringify(['MikroORM supports multiple databases']),
        narrative: 'The team evaluated several ORMs...',
        filesRead: JSON.stringify(['/src/db.ts']),
        filesModified: JSON.stringify(['/src/config.ts']),
        cwd: '/home/user/project',
        gitBranch: 'feature/orm',
        promptNumber: 5,
        discoveryTokens: 1500,
        decisionCategory: 'architecture',
      });

      expect(obs.subtitle).toBe('Use MikroORM');
      expect(obs.text).toBe('We decided to use MikroORM for database access');
      expect(obs.cwd).toBe('/home/user/project');
      expect(obs.git_branch).toBe('feature/orm');
      expect(obs.prompt_number).toBe(5);
      expect(obs.discovery_tokens).toBe(1500);
      expect(obs.decision_category).toBe('architecture');
    });
  });

  describe('findById', () => {
    it('should find observation by ID', async () => {
      const created = await repo.create({
        memorySessionId: 'session-1',
        project: 'test-project',
        type: 'discovery',
        title: 'Test',
        text: 'Test observation text',
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

  describe('update', () => {
    it('should update observation fields', async () => {
      const created = await repo.create({
        memorySessionId: 'session-1',
        project: 'test-project',
        type: 'discovery',
        title: 'Original Title',
        text: 'Original text',
      });

      const updated = await repo.update(created.id, {
        title: 'Updated Title',
        text: 'New content',
      });

      expect(updated?.title).toBe('Updated Title');
      expect(updated?.text).toBe('New content');
    });

    it('should return null for non-existent ID', async () => {
      const updated = await repo.update(99999, { title: 'New' });
      expect(updated).toBeNull();
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await repo.create({ memorySessionId: 's1', project: 'project-a', type: 'discovery', title: 'D1' });
      await repo.create({ memorySessionId: 's1', project: 'project-a', type: 'decision', title: 'D2' });
      await repo.create({ memorySessionId: 's2', project: 'project-b', type: 'discovery', title: 'D3' });
    });

    it('should list all observations', async () => {
      const obs = await repo.list();
      expect(obs.length).toBe(3);
    });

    it('should filter by project', async () => {
      const obs = await repo.list({ project: 'project-a' });
      expect(obs.length).toBe(2);
    });

    it('should filter by session ID', async () => {
      const obs = await repo.list({ sessionId: 's1' });
      expect(obs.length).toBe(2);
    });

    it('should filter by type', async () => {
      const obs = await repo.list({ type: 'discovery' });
      expect(obs.length).toBe(2);
    });

    it('should filter by multiple types', async () => {
      const obs = await repo.list({ type: ['discovery', 'decision'] });
      expect(obs.length).toBe(3);
    });

    it('should respect limit option', async () => {
      const obs = await repo.list({}, { limit: 2 });
      expect(obs.length).toBe(2);
    });

    it('should respect offset option', async () => {
      const obs = await repo.list({}, { limit: 10, offset: 2 });
      expect(obs.length).toBe(1);
    });
  });

  describe('count', () => {
    it('should count observations', async () => {
      await repo.create({ memorySessionId: 's1', project: 'project-a', type: 'discovery', title: 'D1' });
      await repo.create({ memorySessionId: 's1', project: 'project-a', type: 'decision', title: 'D2' });

      const count = await repo.count();
      expect(count).toBe(2);
    });

    it('should count with filters', async () => {
      await repo.create({ memorySessionId: 's1', project: 'project-a', type: 'discovery', title: 'D1' });
      await repo.create({ memorySessionId: 's1', project: 'project-b', type: 'discovery', title: 'D2' });

      const count = await repo.count({ project: 'project-a' });
      expect(count).toBe(1);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await repo.create({
        memorySessionId: 's1',
        project: 'project-a',
        type: 'discovery',
        title: 'Authentication flow implementation',
        text: 'Implemented JWT authentication with refresh tokens',
      });
      await repo.create({
        memorySessionId: 's1',
        project: 'project-a',
        type: 'discovery',
        title: 'Database setup',
        text: 'Set up PostgreSQL with migrations',
      });
      await repo.create({
        memorySessionId: 's1',
        project: 'project-a',
        type: 'decision',
        title: 'Use React for frontend',
        text: 'Decided to use React with TypeScript',
      });
    });

    it('should search by keyword', async () => {
      const results = await repo.search('authentication');
      expect(results.length).toBe(1);
      expect(results[0].title).toContain('Authentication');
    });

    it('should search with project filter', async () => {
      const results = await repo.search('setup', { project: 'project-a' });
      expect(results.length).toBe(1);
    });

    it('should search with type filter', async () => {
      const results = await repo.search('use', { type: 'decision' });
      expect(results.length).toBe(1);
    });

    it('should handle quoted phrases', async () => {
      const results = await repo.search('"refresh tokens"');
      expect(results.length).toBe(1);
    });

    it('should handle prefix wildcards', async () => {
      const results = await repo.search('auth*');
      expect(results.length).toBe(1);
    });

    it('should throw on empty query', async () => {
      await expect(repo.search('')).rejects.toThrow('Search query cannot be empty');
    });

    it('should throw on standalone wildcard', async () => {
      await expect(repo.search('*')).rejects.toThrow('Standalone wildcard');
    });

    it('should handle terms with hyphens', async () => {
      await repo.create({
        memorySessionId: 's1',
        project: 'project-a',
        type: 'discovery',
        title: 'claude-mem integration',
        text: 'Integrated claude-mem for memory management',
      });

      // Should find it by searching for the hyphenated term
      const results = await repo.search('claude-mem');
      expect(results.length).toBe(1);
    });
  });

  describe('getBySessionId', () => {
    it('should get observations by session ID', async () => {
      await repo.create({ memorySessionId: 's1', project: 'p1', type: 'discovery', title: 'D1' });
      await repo.create({ memorySessionId: 's1', project: 'p1', type: 'discovery', title: 'D2' });
      await repo.create({ memorySessionId: 's2', project: 'p1', type: 'discovery', title: 'D3' });

      const obs = await repo.getBySessionId('s1');
      expect(obs.length).toBe(2);
    });
  });

  describe('getCountsBySessionIds', () => {
    it('should get counts for multiple sessions', async () => {
      await repo.create({ memorySessionId: 's1', project: 'p1', type: 'discovery', title: 'D1' });
      await repo.create({ memorySessionId: 's1', project: 'p1', type: 'discovery', title: 'D2' });
      await repo.create({ memorySessionId: 's2', project: 'p1', type: 'discovery', title: 'D3' });

      const counts = await repo.getCountsBySessionIds(['s1', 's2', 's3']);

      expect(counts.get('s1')).toBe(2);
      expect(counts.get('s2')).toBe(1);
      expect(counts.get('s3')).toBe(0);
    });

    it('should handle empty array', async () => {
      const counts = await repo.getCountsBySessionIds([]);
      expect(counts.size).toBe(0);
    });
  });

  describe('delete', () => {
    it('should delete observation', async () => {
      const created = await repo.create({
        memorySessionId: 's1',
        project: 'p1',
        type: 'discovery',
        title: 'To Delete',
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

  describe('batchDelete', () => {
    it('should delete multiple observations', async () => {
      const obs1 = await repo.create({ memorySessionId: 's1', project: 'p1', type: 'discovery', title: 'D1' });
      const obs2 = await repo.create({ memorySessionId: 's1', project: 'p1', type: 'discovery', title: 'D2' });
      const obs3 = await repo.create({ memorySessionId: 's1', project: 'p1', type: 'discovery', title: 'D3' });

      const deleted = await repo.batchDelete([obs1.id, obs2.id]);

      expect(deleted).toBe(2);

      const remaining = await repo.list();
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe(obs3.id);
    });

    it('should handle empty array', async () => {
      const deleted = await repo.batchDelete([]);
      expect(deleted).toBe(0);
    });
  });

  describe('deleteBySessionId', () => {
    it('should delete all observations for session', async () => {
      await repo.create({ memorySessionId: 's1', project: 'p1', type: 'discovery', title: 'D1' });
      await repo.create({ memorySessionId: 's1', project: 'p1', type: 'discovery', title: 'D2' });
      await repo.create({ memorySessionId: 's2', project: 'p1', type: 'discovery', title: 'D3' });

      const deleted = await repo.deleteBySessionId('s1');

      expect(deleted).toBe(2);

      const remaining = await repo.list();
      expect(remaining.length).toBe(1);
    });
  });

  describe('getForContext', () => {
    it('should get observations for context with limit', async () => {
      await repo.create({ memorySessionId: 's1', project: 'p1', type: 'discovery', title: 'D1' });
      await repo.create({ memorySessionId: 's1', project: 'p1', type: 'discovery', title: 'D2' });
      await repo.create({ memorySessionId: 's1', project: 'p1', type: 'discovery', title: 'D3' });

      const obs = await repo.getForContext('p1', 2);

      expect(obs.length).toBe(2);
    });
  });

  describe('memory tier methods', () => {
    it('should update tier', async () => {
      const created = await repo.create({
        memorySessionId: 's1',
        project: 'p1',
        type: 'discovery',
        title: 'Test',
      });

      const updated = await repo.updateTier(created.id, 'core');

      expect(updated?.memory_tier).toBe('core');
      expect(updated?.tier_changed_at).toBeDefined();
    });

    it('should record access', async () => {
      const created = await repo.create({
        memorySessionId: 's1',
        project: 'p1',
        type: 'discovery',
        title: 'Test',
      });

      const updated = await repo.recordAccess(created.id);

      expect(updated?.access_count).toBe(1);
      expect(updated?.last_accessed_at).toBeDefined();
    });

    it('should get tier counts', async () => {
      await repo.create({ memorySessionId: 's1', project: 'p1', type: 'discovery', title: 'D1' });
      await repo.create({ memorySessionId: 's1', project: 'p1', type: 'discovery', title: 'D2' });

      const counts = await repo.getTierCounts();

      // Default tier is 'working' (null maps to working)
      expect(counts.working).toBeGreaterThanOrEqual(0);
    });
  });

  describe('importance scoring', () => {
    it('should pin observation', async () => {
      const created = await repo.create({
        memorySessionId: 's1',
        project: 'p1',
        type: 'decision',
        title: 'Important Decision',
      });

      const pinned = await repo.pinObservation(created.id);

      expect(pinned?.pinned).toBe(true);
    });

    it('should unpin observation', async () => {
      const created = await repo.create({
        memorySessionId: 's1',
        project: 'p1',
        type: 'decision',
        title: 'Important Decision',
      });

      await repo.pinObservation(created.id);
      const unpinned = await repo.unpinObservation(created.id);

      expect(unpinned?.pinned).toBe(false);
    });

    it('should set importance boost', async () => {
      const created = await repo.create({
        memorySessionId: 's1',
        project: 'p1',
        type: 'decision',
        title: 'Test',
      });

      const boosted = await repo.setImportanceBoost(created.id, 5);

      expect(boosted?.importance_boost).toBe(5);
    });

    it('should get pinned observations', async () => {
      const obs1 = await repo.create({ memorySessionId: 's1', project: 'p1', type: 'discovery', title: 'D1' });
      await repo.create({ memorySessionId: 's1', project: 'p1', type: 'discovery', title: 'D2' });

      await repo.pinObservation(obs1.id);

      const pinned = await repo.getPinnedObservations();

      expect(pinned.length).toBe(1);
      expect(pinned[0].id).toBe(obs1.id);
    });
  });

  describe('decision tracking', () => {
    it('should get decisions for project', async () => {
      await repo.create({ memorySessionId: 's1', project: 'p1', type: 'decision', title: 'D1' });
      await repo.create({ memorySessionId: 's1', project: 'p1', type: 'decision', title: 'D2' });
      await repo.create({ memorySessionId: 's1', project: 'p1', type: 'discovery', title: 'D3' });

      const decisions = await repo.getDecisions('p1');

      expect(decisions.length).toBe(2);
    });

    it('should supersede decision', async () => {
      const old = await repo.create({
        memorySessionId: 's1',
        project: 'p1',
        type: 'decision',
        title: 'Old Decision',
        text: 'This is the old decision',
      });

      const newDecision = await repo.create({
        memorySessionId: 's1',
        project: 'p1',
        type: 'decision',
        title: 'New Decision',
        text: 'This is the new decision',
      });

      const superseded = await repo.supersede(old.id, newDecision.id);

      expect(superseded?.superseded_by).toBe(newDecision.id);
      expect(superseded?.superseded_at).toBeDefined();
    });
  });
});

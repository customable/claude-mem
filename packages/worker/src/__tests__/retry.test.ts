/**
 * Tests for exponential backoff retry utilities
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateRetryDelay,
  getRetryConfig,
  calculateRetryAfter,
  defaultRetryConfig,
  taskRetryConfigs,
  type RetryConfig,
} from '../utils/retry.js';

describe('Retry Utilities', () => {
  describe('calculateRetryDelay', () => {
    it('should return initial delay for first retry', () => {
      const config: RetryConfig = {
        initialDelayMs: 1000,
        maxDelayMs: 60000,
        multiplier: 2,
        jitterFactor: 0, // No jitter for predictable testing
      };

      const delay = calculateRetryDelay(0, config);
      expect(delay).toBe(1000);
    });

    it('should exponentially increase delay', () => {
      const config: RetryConfig = {
        initialDelayMs: 1000,
        maxDelayMs: 60000,
        multiplier: 2,
        jitterFactor: 0,
      };

      expect(calculateRetryDelay(0, config)).toBe(1000);
      expect(calculateRetryDelay(1, config)).toBe(2000);
      expect(calculateRetryDelay(2, config)).toBe(4000);
      expect(calculateRetryDelay(3, config)).toBe(8000);
      expect(calculateRetryDelay(4, config)).toBe(16000);
    });

    it('should cap at max delay', () => {
      const config: RetryConfig = {
        initialDelayMs: 1000,
        maxDelayMs: 5000,
        multiplier: 2,
        jitterFactor: 0,
      };

      expect(calculateRetryDelay(10, config)).toBe(5000);
    });

    it('should apply jitter within bounds', () => {
      const config: RetryConfig = {
        initialDelayMs: 1000,
        maxDelayMs: 60000,
        multiplier: 2,
        jitterFactor: 0.2, // ±20%
      };

      // Run multiple times to test randomness bounds
      for (let i = 0; i < 100; i++) {
        const delay = calculateRetryDelay(0, config);
        // 1000 ± 20% = 800-1200
        expect(delay).toBeGreaterThanOrEqual(800);
        expect(delay).toBeLessThanOrEqual(1200);
      }
    });

    it('should never return negative delay', () => {
      const config: RetryConfig = {
        initialDelayMs: 100,
        maxDelayMs: 1000,
        multiplier: 2,
        jitterFactor: 1.0, // 100% jitter - extreme case
      };

      for (let i = 0; i < 100; i++) {
        const delay = calculateRetryDelay(0, config);
        expect(delay).toBeGreaterThanOrEqual(0);
      }
    });

    it('should use default config when not provided', () => {
      const delay = calculateRetryDelay(0);
      // With default jitter of 0.2, delay should be around 1000 ± 200
      expect(delay).toBeGreaterThanOrEqual(800);
      expect(delay).toBeLessThanOrEqual(1200);
    });

    it('should work with custom multiplier', () => {
      const config: RetryConfig = {
        initialDelayMs: 1000,
        maxDelayMs: 100000,
        multiplier: 3, // Triple each time
        jitterFactor: 0,
      };

      expect(calculateRetryDelay(0, config)).toBe(1000);
      expect(calculateRetryDelay(1, config)).toBe(3000);
      expect(calculateRetryDelay(2, config)).toBe(9000);
      expect(calculateRetryDelay(3, config)).toBe(27000);
    });
  });

  describe('getRetryConfig', () => {
    it('should return config for known task types', () => {
      expect(getRetryConfig('observation')).toEqual(taskRetryConfigs.observation);
      expect(getRetryConfig('embedding')).toEqual(taskRetryConfigs.embedding);
      expect(getRetryConfig('qdrant-sync')).toEqual(taskRetryConfigs['qdrant-sync']);
      expect(getRetryConfig('summarize')).toEqual(taskRetryConfigs.summarize);
    });

    it('should return default config for unknown task type', () => {
      expect(getRetryConfig('unknown-task')).toEqual(defaultRetryConfig);
      expect(getRetryConfig('')).toEqual(defaultRetryConfig);
    });
  });

  describe('calculateRetryAfter', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-25T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return future timestamp', () => {
      const now = Date.now();
      const retryAfter = calculateRetryAfter(0, 'observation');

      expect(retryAfter).toBeGreaterThan(now);
    });

    it('should increase with retry count', () => {
      const retry0 = calculateRetryAfter(0, 'observation');
      const retry1 = calculateRetryAfter(1, 'observation');
      const retry2 = calculateRetryAfter(2, 'observation');

      // Due to jitter, we can't compare exact values, but delays should generally increase
      // Using approximate comparison with generous margin
      const now = Date.now();
      const delay0 = retry0 - now;
      const delay1 = retry1 - now;
      const delay2 = retry2 - now;

      // observation config: initialDelayMs: 500, multiplier: 2
      // retry 0: ~500ms, retry 1: ~1000ms, retry 2: ~2000ms
      expect(delay0).toBeGreaterThanOrEqual(400);
      expect(delay0).toBeLessThanOrEqual(600);
      expect(delay1).toBeGreaterThanOrEqual(800);
      expect(delay1).toBeLessThanOrEqual(1200);
      expect(delay2).toBeGreaterThanOrEqual(1600);
      expect(delay2).toBeLessThanOrEqual(2400);
    });
  });

  describe('defaultRetryConfig', () => {
    it('should have reasonable defaults', () => {
      expect(defaultRetryConfig.initialDelayMs).toBe(1000);
      expect(defaultRetryConfig.maxDelayMs).toBe(60000);
      expect(defaultRetryConfig.multiplier).toBe(2);
      expect(defaultRetryConfig.jitterFactor).toBe(0.2);
    });
  });

  describe('taskRetryConfigs', () => {
    it('should have configs for all expected task types', () => {
      const expectedTypes = [
        'observation',
        'embedding',
        'qdrant-sync',
        'summarize',
        'claude-md',
        'context-generate',
        'semantic-search',
      ];

      for (const type of expectedTypes) {
        expect(taskRetryConfigs[type]).toBeDefined();
        expect(taskRetryConfigs[type].initialDelayMs).toBeGreaterThan(0);
        expect(taskRetryConfigs[type].maxDelayMs).toBeGreaterThan(taskRetryConfigs[type].initialDelayMs);
        expect(taskRetryConfigs[type].multiplier).toBeGreaterThan(1);
        expect(taskRetryConfigs[type].jitterFactor).toBeGreaterThanOrEqual(0);
        expect(taskRetryConfigs[type].jitterFactor).toBeLessThanOrEqual(1);
      }
    });

    it('should have longer delays for qdrant-sync (network dependent)', () => {
      expect(taskRetryConfigs['qdrant-sync'].initialDelayMs).toBeGreaterThan(
        taskRetryConfigs.observation.initialDelayMs
      );
      expect(taskRetryConfigs['qdrant-sync'].maxDelayMs).toBeGreaterThan(
        taskRetryConfigs.observation.maxDelayMs
      );
    });
  });
});

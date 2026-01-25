import { describe, it, expect, vi, afterEach } from 'vitest';
import { VERSION, HOOK_TIMEOUTS, WORKER, getTimeout } from '../constants.js';

describe('constants', () => {
  describe('VERSION', () => {
    it('should be a valid semver string', () => {
      expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('HOOK_TIMEOUTS', () => {
    it('should have all required timeout values', () => {
      expect(HOOK_TIMEOUTS.DEFAULT).toBe(300_000);
      expect(HOOK_TIMEOUTS.HEALTH_CHECK).toBe(30_000);
      expect(HOOK_TIMEOUTS.QUICK_CHECK).toBe(3_000);
      expect(HOOK_TIMEOUTS.WORKER_STARTUP_WAIT).toBe(1_000);
      expect(HOOK_TIMEOUTS.WORKER_STARTUP_RETRIES).toBe(300);
      expect(HOOK_TIMEOUTS.PRE_RESTART_SETTLE_DELAY).toBe(2_000);
      expect(HOOK_TIMEOUTS.POWERSHELL_COMMAND).toBe(10_000);
      expect(HOOK_TIMEOUTS.WINDOWS_MULTIPLIER).toBe(1.5);
    });

    it('should have timeouts in increasing order of duration', () => {
      expect(HOOK_TIMEOUTS.QUICK_CHECK).toBeLessThan(HOOK_TIMEOUTS.HEALTH_CHECK);
      expect(HOOK_TIMEOUTS.HEALTH_CHECK).toBeLessThan(HOOK_TIMEOUTS.DEFAULT);
    });
  });

  describe('WORKER', () => {
    it('should have all required worker constants', () => {
      expect(WORKER.HEARTBEAT_INTERVAL).toBe(30_000);
      expect(WORKER.HEARTBEAT_MISSED_THRESHOLD).toBe(3);
      expect(WORKER.RECONNECT_INTERVAL).toBe(5_000);
      expect(WORKER.MAX_RECONNECT_ATTEMPTS).toBe(10);
    });
  });

  describe('getTimeout', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true,
      });
    });

    it('should return base timeout for non-Windows platforms', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
      });
      expect(getTimeout(1000)).toBe(1000);
    });

    it('should apply multiplier for Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });
      expect(getTimeout(1000)).toBe(1500);
    });

    it('should round the result on Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });
      expect(getTimeout(100)).toBe(150);
      expect(getTimeout(33)).toBe(50); // 33 * 1.5 = 49.5 -> 50
    });
  });
});

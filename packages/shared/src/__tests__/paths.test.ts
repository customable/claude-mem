import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { homedir, tmpdir } from 'os';
import { existsSync, rmSync } from 'fs';

// Import directly for tests that don't need fresh values
import { DATA_DIR, CLAUDE_CONFIG_DIR, LOGS_DIR, ensureDir } from '../paths.js';

describe('paths', () => {
  describe('DATA_DIR', () => {
    it('should be a string path ending with .claude-mem', () => {
      expect(typeof DATA_DIR).toBe('string');
      expect(DATA_DIR).toMatch(/\.claude-mem$/);
    });

    it('should be an absolute path', () => {
      expect(DATA_DIR.startsWith('/')).toBe(true);
    });
  });

  describe('CLAUDE_CONFIG_DIR', () => {
    it('should be a string path', () => {
      expect(typeof CLAUDE_CONFIG_DIR).toBe('string');
      expect(CLAUDE_CONFIG_DIR.length).toBeGreaterThan(0);
    });

    it('should be an absolute path', () => {
      expect(CLAUDE_CONFIG_DIR.startsWith('/')).toBe(true);
    });

    it('should contain claude in the path', () => {
      expect(CLAUDE_CONFIG_DIR.toLowerCase()).toContain('claude');
    });
  });

  describe('LOGS_DIR', () => {
    it('should be a string path', () => {
      expect(typeof LOGS_DIR).toBe('string');
    });

    it('should contain logs in the path', () => {
      expect(LOGS_DIR).toContain('logs');
    });

    it('should be an absolute path', () => {
      expect(LOGS_DIR.startsWith('/')).toBe(true);
    });
  });

  describe('ensureDir', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = join(tmpdir(), `ensureDir-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    });

    afterEach(() => {
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should create directory if it does not exist', async () => {
      const { ensureDir } = await import('../paths.js');
      expect(existsSync(testDir)).toBe(false);
      ensureDir(testDir);
      expect(existsSync(testDir)).toBe(true);
    });

    it('should create nested directories', async () => {
      const { ensureDir } = await import('../paths.js');
      const nestedDir = join(testDir, 'a', 'b', 'c');
      expect(existsSync(nestedDir)).toBe(false);
      ensureDir(nestedDir);
      expect(existsSync(nestedDir)).toBe(true);
    });

    it('should not throw if directory already exists', async () => {
      const { ensureDir } = await import('../paths.js');
      ensureDir(testDir);
      expect(existsSync(testDir)).toBe(true);
      // Call again - should not throw
      expect(() => ensureDir(testDir)).not.toThrow();
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Import after setting up mocks
import { DEFAULTS, SettingsManager, loadSettings, type Settings } from '../settings.js';

describe('settings', () => {
  describe('DEFAULTS', () => {
    it('should have all required backend settings', () => {
      expect(DEFAULTS.BACKEND_PORT).toBe(37777);
      expect(DEFAULTS.BACKEND_WS_PORT).toBe(37778);
      expect(DEFAULTS.BACKEND_HOST).toBe('127.0.0.1');
      expect(DEFAULTS.BACKEND_BIND).toBe('127.0.0.1');
    });

    it('should have all required worker settings', () => {
      expect(DEFAULTS.WORKER_AUTH_TOKEN).toBe('');
      expect(DEFAULTS.EMBEDDED_WORKER).toBe(true);
      expect(DEFAULTS.MAX_WORKERS).toBe(4);
      expect(DEFAULTS.AUTO_SPAWN_WORKERS).toBe(false);
    });

    it('should have all required AI provider settings', () => {
      expect(DEFAULTS.AI_PROVIDER).toBe('mistral');
      expect(DEFAULTS.MISTRAL_MODEL).toBe('mistral-small-latest');
      expect(DEFAULTS.GEMINI_MODEL).toBe('gemini-2.5-flash-lite');
    });

    it('should have all required database settings', () => {
      expect(DEFAULTS.DATABASE_TYPE).toBe('sqlite');
      expect(DEFAULTS.DATABASE_BACKEND).toBe('sqlite');
      expect(DEFAULTS.DATABASE_PORT).toBe(5432);
    });

    it('should have sensible timeout defaults', () => {
      expect(DEFAULTS.IN_PROCESS_WORKER_TIMEOUT).toBe(30);
      expect(DEFAULTS.IN_PROCESS_WORKER_IDLE_EXIT).toBe(120);
      expect(DEFAULTS.CLAUDEMD_TASK_TIMEOUT).toBe(600000);
    });

    it('should have valid log level', () => {
      expect(['debug', 'info', 'warn', 'error']).toContain(DEFAULTS.LOG_LEVEL);
    });

    it('should have valid processing mode', () => {
      expect(['normal', 'lazy', 'hybrid']).toContain(DEFAULTS.PROCESSING_MODE);
    });

    it('should have valid worker mode', () => {
      expect(['spawn', 'in-process', 'hybrid']).toContain(DEFAULTS.WORKER_MODE);
    });
  });

  describe('SettingsManager', () => {
    let testDir: string;
    let settingsPath: string;

    beforeEach(() => {
      // Create unique temp directory for each test
      testDir = join(tmpdir(), `settings-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      mkdirSync(testDir, { recursive: true });
      settingsPath = join(testDir, 'settings.json');
    });

    afterEach(() => {
      // Cleanup
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
      // Clear environment variables that might affect tests
      delete process.env.CLAUDE_MEM_BACKEND_PORT;
      delete process.env.CLAUDE_MEM_LOG_LEVEL;
      delete process.env.CLAUDE_MEM_EMBEDDED_WORKER;
    });

    it('should use defaults when no settings file exists', () => {
      const manager = new SettingsManager(settingsPath);
      expect(manager.get('BACKEND_PORT')).toBe(DEFAULTS.BACKEND_PORT);
      expect(manager.get('LOG_LEVEL')).toBe(DEFAULTS.LOG_LEVEL);
    });

    it('should load settings from file', () => {
      writeFileSync(settingsPath, JSON.stringify({
        BACKEND_PORT: 12345,
        LOG_LEVEL: 'debug',
      }));

      const manager = new SettingsManager(settingsPath);
      expect(manager.get('BACKEND_PORT')).toBe(12345);
      expect(manager.get('LOG_LEVEL')).toBe('debug');
    });

    it('should override file settings with environment variables', () => {
      writeFileSync(settingsPath, JSON.stringify({
        BACKEND_PORT: 12345,
      }));
      process.env.CLAUDE_MEM_BACKEND_PORT = '54321';

      const manager = new SettingsManager(settingsPath);
      expect(manager.get('BACKEND_PORT')).toBe(54321);

      delete process.env.CLAUDE_MEM_BACKEND_PORT;
    });

    it('should parse boolean values correctly', () => {
      writeFileSync(settingsPath, JSON.stringify({
        EMBEDDED_WORKER: 'true',
        AUTO_SPAWN_WORKERS: false,
      }));

      const manager = new SettingsManager(settingsPath);
      expect(manager.get('EMBEDDED_WORKER')).toBe(true);
      expect(manager.get('AUTO_SPAWN_WORKERS')).toBe(false);
    });

    it('should parse boolean from environment variables', () => {
      process.env.CLAUDE_MEM_EMBEDDED_WORKER = 'false';

      const manager = new SettingsManager(settingsPath);
      expect(manager.get('EMBEDDED_WORKER')).toBe(false);

      delete process.env.CLAUDE_MEM_EMBEDDED_WORKER;
    });

    it('should parse number values correctly', () => {
      writeFileSync(settingsPath, JSON.stringify({
        BACKEND_PORT: '8080',
        MAX_WORKERS: 8,
      }));

      const manager = new SettingsManager(settingsPath);
      expect(manager.get('BACKEND_PORT')).toBe(8080);
      expect(manager.get('MAX_WORKERS')).toBe(8);
    });

    it('should handle invalid JSON gracefully', () => {
      writeFileSync(settingsPath, 'not valid json');

      // Should not throw, should use defaults
      const manager = new SettingsManager(settingsPath);
      expect(manager.get('BACKEND_PORT')).toBe(DEFAULTS.BACKEND_PORT);
    });

    it('should handle legacy nested schema', () => {
      writeFileSync(settingsPath, JSON.stringify({
        env: {
          BACKEND_PORT: 9999,
        },
      }));

      const manager = new SettingsManager(settingsPath);
      expect(manager.get('BACKEND_PORT')).toBe(9999);
    });

    it('should migrate legacy keys', () => {
      writeFileSync(settingsPath, JSON.stringify({
        CLAUDE_MEM_WORKER_PORT: 7777,
        CLAUDE_MEM_LOG_LEVEL: 'warn',
      }));

      const manager = new SettingsManager(settingsPath);
      expect(manager.get('BACKEND_PORT')).toBe(7777);
      expect(manager.get('LOG_LEVEL')).toBe('warn');
    });

    it('should update settings in memory', () => {
      const manager = new SettingsManager(settingsPath);
      manager.set('BACKEND_PORT', 5555);
      expect(manager.get('BACKEND_PORT')).toBe(5555);
    });

    it('should save settings to file', () => {
      const manager = new SettingsManager(settingsPath);
      manager.set('BACKEND_PORT', 6666);
      manager.save();

      const saved = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      expect(saved.BACKEND_PORT).toBe(6666);
    });

    it('should create directory if it does not exist', () => {
      const nestedPath = join(testDir, 'nested', 'dir', 'settings.json');
      const manager = new SettingsManager(nestedPath);
      manager.save();

      expect(existsSync(nestedPath)).toBe(true);
    });

    it('should return all settings with getAll()', () => {
      const manager = new SettingsManager(settingsPath);
      const all = manager.getAll();

      expect(all.BACKEND_PORT).toBe(DEFAULTS.BACKEND_PORT);
      expect(all.LOG_LEVEL).toBe(DEFAULTS.LOG_LEVEL);
      expect(Object.keys(all).length).toBeGreaterThan(10);
    });

    it('should return a copy of settings, not reference', () => {
      const manager = new SettingsManager(settingsPath);
      const all1 = manager.getAll();
      const all2 = manager.getAll();

      expect(all1).not.toBe(all2);
      expect(all1).toEqual(all2);
    });
  });

  describe('loadSettings', () => {
    it('should return settings object', () => {
      const settings = loadSettings();
      expect(settings).toBeDefined();
      expect(settings.BACKEND_PORT).toBeDefined();
    });

    it('should use singleton pattern', () => {
      const settings1 = loadSettings();
      const settings2 = loadSettings();
      // Values should be equal (same underlying manager)
      expect(settings1.BACKEND_PORT).toBe(settings2.BACKEND_PORT);
    });
  });

  describe('Type safety', () => {
    it('should have correct types for Settings interface keys', () => {
      const settings = DEFAULTS;

      // Number fields
      expect(typeof settings.BACKEND_PORT).toBe('number');
      expect(typeof settings.MAX_WORKERS).toBe('number');
      expect(typeof settings.BATCH_SIZE).toBe('number');

      // Boolean fields
      expect(typeof settings.EMBEDDED_WORKER).toBe('boolean');
      expect(typeof settings.REMOTE_MODE).toBe('boolean');
      expect(typeof settings.CLAUDEMD_ENABLED).toBe('boolean');

      // String fields
      expect(typeof settings.BACKEND_HOST).toBe('string');
      expect(typeof settings.LOG_LEVEL).toBe('string');
      expect(typeof settings.AI_PROVIDER).toBe('string');
    });
  });

  describe('Endless Mode settings', () => {
    it('should have all Endless Mode settings with defaults', () => {
      expect(DEFAULTS.ENDLESS_MODE_ENABLED).toBe(false);
      expect(DEFAULTS.ENDLESS_MODE_COMPRESSION_MODEL).toBe('claude-haiku-4-5');
      expect(DEFAULTS.ENDLESS_MODE_COMPRESSION_TIMEOUT).toBe(90000);
      expect(DEFAULTS.ENDLESS_MODE_FALLBACK_ON_TIMEOUT).toBe(true);
      expect(DEFAULTS.ENDLESS_MODE_SKIP_SIMPLE_OUTPUTS).toBe(true);
      expect(DEFAULTS.ENDLESS_MODE_SIMPLE_OUTPUT_THRESHOLD).toBe(1000);
    });
  });

  describe('Worker Profile settings', () => {
    it('should have worker profile defaults', () => {
      expect(DEFAULTS.WORKER_PROFILES).toBe('[]');
      expect(DEFAULTS.CAPABILITY_LIMITS).toBe('{}');
    });
  });
});

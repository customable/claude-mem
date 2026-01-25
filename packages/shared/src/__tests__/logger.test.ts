import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync, mkdirSync, rmSync, readdirSync, writeFileSync, readFileSync } from 'fs';

import {
  Logger,
  LogBufferTransport,
  ConsoleTransport,
  FileTransport,
  createLogger,
  logBuffer,
  type LogEntry,
  type LogLevel,
  type ILogTransport,
} from '../logger.js';

describe('logger', () => {
  describe('LogBufferTransport', () => {
    let buffer: LogBufferTransport;

    beforeEach(() => {
      buffer = new LogBufferTransport(10);
    });

    it('should store log entries', () => {
      const entry: LogEntry = {
        level: 'info',
        timestamp: new Date(),
        context: 'test',
        message: 'Test message',
      };

      buffer.log(entry);
      expect(buffer.size).toBe(1);
      expect(buffer.getAll()).toContainEqual(entry);
    });

    it('should respect max size and evict oldest entries', () => {
      for (let i = 0; i < 15; i++) {
        buffer.log({
          level: 'info',
          timestamp: new Date(),
          context: 'test',
          message: `Message ${i}`,
        });
      }

      expect(buffer.size).toBe(10);
      // First 5 should be evicted
      const all = buffer.getAll();
      expect(all[0].message).toBe('Message 5');
      expect(all[9].message).toBe('Message 14');
    });

    it('should filter by level', () => {
      buffer.log({ level: 'info', timestamp: new Date(), context: 'test', message: 'info msg' });
      buffer.log({ level: 'error', timestamp: new Date(), context: 'test', message: 'error msg' });
      buffer.log({ level: 'warn', timestamp: new Date(), context: 'test', message: 'warn msg' });

      const errors = buffer.query({ level: 'error' });
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('error msg');
    });

    it('should filter by minLevel', () => {
      buffer.log({ level: 'debug', timestamp: new Date(), context: 'test', message: 'debug' });
      buffer.log({ level: 'info', timestamp: new Date(), context: 'test', message: 'info' });
      buffer.log({ level: 'warn', timestamp: new Date(), context: 'test', message: 'warn' });
      buffer.log({ level: 'error', timestamp: new Date(), context: 'test', message: 'error' });

      const warnAndAbove = buffer.query({ minLevel: 'warn' });
      expect(warnAndAbove).toHaveLength(2);
      expect(warnAndAbove.map(e => e.level)).toContain('warn');
      expect(warnAndAbove.map(e => e.level)).toContain('error');
    });

    it('should filter by context', () => {
      buffer.log({ level: 'info', timestamp: new Date(), context: 'backend', message: 'msg1' });
      buffer.log({ level: 'info', timestamp: new Date(), context: 'worker', message: 'msg2' });
      buffer.log({ level: 'info', timestamp: new Date(), context: 'backend:task', message: 'msg3' });

      const backendLogs = buffer.query({ context: 'backend' });
      expect(backendLogs).toHaveLength(2);
    });

    it('should filter by since', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 10000);
      const future = new Date(now.getTime() + 10000);

      buffer.log({ level: 'info', timestamp: past, context: 'test', message: 'past' });
      buffer.log({ level: 'info', timestamp: now, context: 'test', message: 'now' });

      const recent = buffer.query({ since: now });
      expect(recent).toHaveLength(1);
      expect(recent[0].message).toBe('now');
    });

    it('should limit results', () => {
      for (let i = 0; i < 10; i++) {
        buffer.log({ level: 'info', timestamp: new Date(), context: 'test', message: `msg${i}` });
      }

      const limited = buffer.query({ limit: 3 });
      expect(limited).toHaveLength(3);
      // Should return last 3
      expect(limited.map(e => e.message)).toEqual(['msg7', 'msg8', 'msg9']);
    });

    it('should clear all entries', () => {
      buffer.log({ level: 'info', timestamp: new Date(), context: 'test', message: 'msg' });
      expect(buffer.size).toBe(1);

      buffer.clear();
      expect(buffer.size).toBe(0);
    });
  });

  describe('ConsoleTransport', () => {
    let transport: ConsoleTransport;
    let consoleSpy: {
      log: ReturnType<typeof vi.spyOn>;
      warn: ReturnType<typeof vi.spyOn>;
      error: ReturnType<typeof vi.spyOn>;
      debug: ReturnType<typeof vi.spyOn>;
    };

    beforeEach(() => {
      transport = new ConsoleTransport();
      consoleSpy = {
        log: vi.spyOn(console, 'log').mockImplementation(() => {}),
        warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
        error: vi.spyOn(console, 'error').mockImplementation(() => {}),
        debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      };
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should log info to console.log', () => {
      transport.log({
        level: 'info',
        timestamp: new Date(),
        context: 'test',
        message: 'info message',
      });
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should log warn to console.warn', () => {
      transport.log({
        level: 'warn',
        timestamp: new Date(),
        context: 'test',
        message: 'warn message',
      });
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should log error to console.error', () => {
      transport.log({
        level: 'error',
        timestamp: new Date(),
        context: 'test',
        message: 'error message',
      });
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should log debug to console.debug', () => {
      transport.log({
        level: 'debug',
        timestamp: new Date(),
        context: 'test',
        message: 'debug message',
      });
      expect(consoleSpy.debug).toHaveBeenCalled();
    });

    it('should include data in log output', () => {
      transport.log({
        level: 'info',
        timestamp: new Date(),
        context: 'test',
        message: 'with data',
        data: { key: 'value' },
      });
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('"key":"value"'));
    });

    it('should include error stack in log output', () => {
      const error = new Error('Test error');
      transport.log({
        level: 'error',
        timestamp: new Date(),
        context: 'test',
        message: 'with error',
        error,
      });
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Test error'));
    });
  });

  describe('FileTransport', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = join(tmpdir(), `logger-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      mkdirSync(testDir, { recursive: true });
      // Override LOGS_DIR for tests
      process.env.CLAUDE_MEM_LOGS_DIR = testDir;
    });

    afterEach(() => {
      delete process.env.CLAUDE_MEM_LOGS_DIR;
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should create log file with component name and date', async () => {
      // Need to re-import to pick up new LOGS_DIR
      const { FileTransport: FT } = await import('../logger.js?t=' + Date.now());
      const transport = new FT('test-component');

      const logPath = transport.getLogPath();
      expect(logPath).toContain('test-component');
      expect(logPath).toContain(new Date().toISOString().split('T')[0]);
    });

    it('should write log entries to file', async () => {
      const { FileTransport: FT } = await import('../logger.js?t=' + Date.now() + 1);
      const transport = new FT('test');

      transport.log({
        level: 'info',
        timestamp: new Date(),
        context: 'test',
        message: 'Test log message',
      });

      const logPath = transport.getLogPath();
      expect(existsSync(logPath)).toBe(true);

      const content = readFileSync(logPath, 'utf-8');
      expect(content).toContain('Test log message');
      expect(content).toContain('[INFO]');
    });
  });

  describe('Logger', () => {
    let mockTransport: ILogTransport & { entries: LogEntry[] };

    beforeEach(() => {
      mockTransport = {
        entries: [],
        log(entry: LogEntry) {
          this.entries.push(entry);
        },
      };
    });

    it('should log with correct context', () => {
      const logger = new Logger('my-context', { transports: [mockTransport] });
      logger.info('test message');

      expect(mockTransport.entries).toHaveLength(1);
      expect(mockTransport.entries[0].context).toBe('my-context');
    });

    it('should log with correct level', () => {
      const logger = new Logger('test', { transports: [mockTransport] });

      logger.debug('debug msg');
      logger.info('info msg');
      logger.warn('warn msg');
      logger.error('error msg');

      expect(mockTransport.entries.map(e => e.level)).toEqual(['debug', 'info', 'warn', 'error']);
    });

    it('should include data in log entries', () => {
      const logger = new Logger('test', { transports: [mockTransport] });
      logger.info('with data', { key: 'value', num: 42 });

      expect(mockTransport.entries[0].data).toEqual({ key: 'value', num: 42 });
    });

    it('should include error in log entries', () => {
      const logger = new Logger('test', { transports: [mockTransport] });
      const error = new Error('Test error');
      logger.error('with error', undefined, error);

      expect(mockTransport.entries[0].error).toBe(error);
    });

    it('should respect minLevel filter', () => {
      const logger = new Logger('test', {
        minLevel: 'warn',
        transports: [mockTransport],
      });

      logger.debug('debug - should not log');
      logger.info('info - should not log');
      logger.warn('warn - should log');
      logger.error('error - should log');

      expect(mockTransport.entries).toHaveLength(2);
      expect(mockTransport.entries.map(e => e.level)).toEqual(['warn', 'error']);
    });

    it('should create child logger with sub-context', () => {
      const parent = new Logger('parent', { transports: [mockTransport] });
      const child = parent.child('child');

      child.info('child message');

      expect(mockTransport.entries[0].context).toBe('parent:child');
    });
  });

  describe('createLogger', () => {
    it('should create a logger with the given context', () => {
      const mockTransport: ILogTransport = {
        log: vi.fn(),
      };

      const logger = createLogger('my-module', { transports: [mockTransport] });
      logger.info('test');

      expect(mockTransport.log).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'my-module' })
      );
    });
  });

  describe('logBuffer global instance', () => {
    beforeEach(() => {
      logBuffer.clear();
    });

    it('should be accessible and shared', () => {
      expect(logBuffer).toBeDefined();
      expect(logBuffer.size).toBe(0);

      logBuffer.log({
        level: 'info',
        timestamp: new Date(),
        context: 'test',
        message: 'global buffer test',
      });

      expect(logBuffer.size).toBe(1);
    });
  });
});

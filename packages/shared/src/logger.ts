/**
 * Logger for claude-mem
 *
 * Provides structured logging with different levels and contexts.
 * All loggers share a global buffer for API access.
 * Supports file logging in dev mode (Issue #251).
 */

import { appendFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LOGS_DIR, ensureDir } from './paths.js';

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log entry structure
 */
export interface LogEntry {
  level: LogLevel;
  timestamp: Date;
  context: string;
  message: string;
  data?: Record<string, unknown>;
  error?: Error;
}

/**
 * Log transport interface
 * Implement this for custom log destinations (file, remote, etc.)
 */
export interface ILogTransport {
  log(entry: LogEntry): void;
}

/**
 * Console transport - logs to console with colors
 */
export class ConsoleTransport implements ILogTransport {
  private colors: Record<LogLevel, string> = {
    debug: '\x1b[90m',  // Gray
    info: '\x1b[36m',   // Cyan
    warn: '\x1b[33m',   // Yellow
    error: '\x1b[31m',  // Red
  };
  private reset = '\x1b[0m';

  log(entry: LogEntry): void {
    const color = this.colors[entry.level];
    const timestamp = entry.timestamp.toISOString();
    const prefix = `${color}[${entry.level.toUpperCase()}]${this.reset}`;
    const context = `[${entry.context}]`;

    let message = `${timestamp} ${prefix} ${context} ${entry.message}`;

    if (entry.data && Object.keys(entry.data).length > 0) {
      message += ` ${JSON.stringify(entry.data)}`;
    }

    if (entry.error) {
      message += `\n${entry.error.stack || entry.error.message}`;
    }

    switch (entry.level) {
      case 'error':
        console.error(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'debug':
        console.debug(message);
        break;
      default:
        console.log(message);
    }
  }
}

/**
 * File transport - writes logs to file (Issue #251)
 */
export class FileTransport implements ILogTransport {
  private readonly logPath: string;
  private static readonly MAX_LOG_FILES = 7; // Keep last 7 days
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file

  constructor(component: string = 'backend') {
    // Ensure logs directory exists
    ensureDir(LOGS_DIR);

    // Create log file with date
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    this.logPath = join(LOGS_DIR, `${component}-${date}.log`);

    // Cleanup old log files
    this.cleanup();
  }

  log(entry: LogEntry): void {
    try {
      const timestamp = entry.timestamp.toISOString();
      let line = `${timestamp} [${entry.level.toUpperCase()}] [${entry.context}] ${entry.message}`;

      if (entry.data && Object.keys(entry.data).length > 0) {
        line += ` ${JSON.stringify(entry.data)}`;
      }

      if (entry.error) {
        line += `\n  Error: ${entry.error.stack || entry.error.message}`;
      }

      appendFileSync(this.logPath, line + '\n');
    } catch {
      // Silently ignore file write errors to avoid log loops
    }
  }

  /**
   * Remove old log files (older than MAX_LOG_FILES days)
   */
  private cleanup(): void {
    try {
      if (!existsSync(LOGS_DIR)) return;

      const files = readdirSync(LOGS_DIR)
        .filter(f => f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: join(LOGS_DIR, f),
          mtime: statSync(join(LOGS_DIR, f)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Keep only the most recent MAX_LOG_FILES
      for (const file of files.slice(FileTransport.MAX_LOG_FILES)) {
        try {
          unlinkSync(file.path);
        } catch {
          // Ignore deletion errors
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Get the current log file path
   */
  getLogPath(): string {
    return this.logPath;
  }
}

/**
 * Ring buffer transport - keeps last N logs in memory
 */
export class LogBufferTransport implements ILogTransport {
  private buffer: LogEntry[] = [];
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  log(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  /**
   * Get all buffered logs
   */
  getAll(): LogEntry[] {
    return [...this.buffer];
  }

  /**
   * Get logs filtered by level and/or context
   */
  query(options: {
    level?: LogLevel;
    minLevel?: LogLevel;
    context?: string;
    since?: Date;
    limit?: number;
  } = {}): LogEntry[] {
    let entries = this.buffer;

    if (options.level) {
      entries = entries.filter((e: LogEntry) => e.level === options.level);
    }

    if (options.minLevel) {
      const minPriority = levelPriority[options.minLevel];
      entries = entries.filter((e: LogEntry) => levelPriority[e.level] <= minPriority);
    }

    if (options.context) {
      const ctx = options.context.toLowerCase();
      entries = entries.filter((e: LogEntry) => e.context.toLowerCase().includes(ctx));
    }

    if (options.since) {
      entries = entries.filter((e: LogEntry) => e.timestamp >= options.since!);
    }

    if (options.limit) {
      entries = entries.slice(-options.limit);
    }

    return entries;
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Get current buffer size
   */
  get size(): number {
    return this.buffer.length;
  }
}

/**
 * Log level priority (lower = more severe)
 */
const levelPriority: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/**
 * Global log buffer instance - accessible for API endpoints
 * Shared across all logger instances.
 */
export const logBuffer = new LogBufferTransport(2000);

/**
 * Global console transport instance
 */
const consoleTransport = new ConsoleTransport();

/**
 * Global file transport instance (Issue #251)
 * Only created in dev mode to avoid unnecessary file I/O in production.
 */
let fileTransport: FileTransport | null = null;

/**
 * Check if file logging is enabled
 */
function isFileLoggingEnabled(): boolean {
  // Enable in dev mode or via explicit env var
  return process.env.NODE_ENV !== 'production' ||
         process.env.CLAUDE_MEM_FILE_LOGGING === 'true';
}

/**
 * Initialize file transport if enabled
 */
export function initFileLogging(component: string = 'backend'): FileTransport | null {
  if (!isFileLoggingEnabled()) return null;
  if (fileTransport) return fileTransport;

  fileTransport = new FileTransport(component);
  // Add to default transports for new loggers
  if (!defaultConfig.transports.includes(fileTransport)) {
    defaultConfig.transports.push(fileTransport);
  }
  return fileTransport;
}

/**
 * Get current log file path (if file logging is active)
 */
export function getLogFilePath(): string | null {
  return fileTransport?.getLogPath() ?? null;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  minLevel: LogLevel;
  transports: ILogTransport[];
}

/**
 * Default logger configuration - includes buffer for API access
 * File logging is added via initFileLogging() in dev mode.
 */
const defaultConfig: LoggerConfig = {
  minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [consoleTransport, logBuffer],
};

/**
 * Logger class
 */
export class Logger {
  private readonly context: string;
  private readonly config: LoggerConfig;

  constructor(context: string, config: Partial<LoggerConfig> = {}) {
    this.context = context;
    // Merge with default config, but always include the global buffer
    const transports = config.transports || defaultConfig.transports;
    // Ensure logBuffer is always included
    const hasBuffer = transports.some(t => t === logBuffer);
    this.config = {
      minLevel: config.minLevel ?? defaultConfig.minLevel,
      transports: hasBuffer ? transports : [...transports, logBuffer],
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return levelPriority[level] <= levelPriority[this.config.minLevel];
  }

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      timestamp: new Date(),
      context: this.context,
      message,
      data,
      error,
    };

    for (const transport of this.config.transports) {
      try {
        transport.log(entry);
      } catch (e) {
        // Avoid infinite loops if transport fails
        console.error('Logger transport error:', e);
      }
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>, error?: Error): void {
    this.log('warn', message, data, error);
  }

  error(message: string, data?: Record<string, unknown>, error?: Error): void {
    this.log('error', message, data, error);
  }

  /**
   * Create a child logger with a sub-context
   */
  child(subContext: string): Logger {
    return new Logger(`${this.context}:${subContext}`, this.config);
  }
}

/**
 * Create a logger for a context
 */
export function createLogger(context: string, config?: Partial<LoggerConfig>): Logger {
  return new Logger(context, config);
}

/**
 * Default logger instance
 */
export const logger = createLogger('claude-mem');

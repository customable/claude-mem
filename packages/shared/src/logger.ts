/**
 * Logger for claude-mem
 *
 * Provides structured logging with different levels and contexts.
 * Extensible to support different transports (console, file, etc.)
 */

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
 * Logger configuration
 */
export interface LoggerConfig {
  minLevel: LogLevel;
  transports: ILogTransport[];
}

/**
 * Default logger configuration
 */
const defaultConfig: LoggerConfig = {
  minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [new ConsoleTransport()],
};

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
 * Logger class
 */
export class Logger {
  private context: string;
  private config: LoggerConfig;

  constructor(context: string, config: Partial<LoggerConfig> = {}) {
    this.context = context;
    this.config = { ...defaultConfig, ...config };
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

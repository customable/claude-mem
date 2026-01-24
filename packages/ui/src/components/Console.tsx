/**
 * Console / Logs Drawer
 *
 * Bottom drawer for viewing and filtering logs.
 * Uses structured log entries from the API.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as React from "react";

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  context: string;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

const LOG_LEVELS: { key: LogLevel; label: string; color: string }[] = [
  { key: 'debug', label: 'Debug', color: 'badge-ghost' },
  { key: 'info', label: 'Info', color: 'badge-info' },
  { key: 'warn', label: 'Warn', color: 'badge-warning' },
  { key: 'error', label: 'Error', color: 'badge-error' },
];

// Extract unique contexts from logs dynamically
function getUniqueContexts(logs: LogEntry[]): string[] {
  const contexts = new Set<string>();
  for (const log of logs) {
    // Get top-level context (before first colon)
    const topLevel = log.context.split(':')[0];
    contexts.add(topLevel);
  }
  return Array.from(contexts).sort();
}

interface ConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Console({ isOpen, onClose }: ConsoleProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [height, setHeight] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  // Filters
  const [activeLevels, setActiveLevels] = useState<Set<LogLevel>>(
    new Set(['debug', 'info', 'warn', 'error'])
  );
  const [activeContexts, setActiveContexts] = useState<Set<string>>(new Set());
  const [contextFilterInitialized, setContextFilterInitialized] = useState(false);

  // Get unique contexts from logs
  const uniqueContexts = useMemo(() => getUniqueContexts(logs), [logs]);

  // Initialize context filter with all contexts when logs first load
  useEffect(() => {
    if (!contextFilterInitialized && uniqueContexts.length > 0) {
      setActiveContexts(new Set(uniqueContexts));
      setContextFilterInitialized(true);
    }
  }, [uniqueContexts, contextFilterInitialized]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (!activeLevels.has(log.level)) return false;
      if (activeContexts.size > 0) {
        const topLevel = log.context.split(':')[0];
        if (!activeContexts.has(topLevel)) return false;
      }
      return true;
    });
  }, [logs, activeLevels, activeContexts]);

  const checkIfAtBottom = useCallback(() => {
    if (!contentRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    return scrollHeight - scrollTop - clientHeight < 50;
  }, []);

  const scrollToBottom = useCallback(() => {
    if (contentRef.current && wasAtBottomRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    wasAtBottomRef.current = checkIfAtBottom();
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/logs?limit=500');
      if (!response.ok) throw new Error('Failed to fetch logs');
      const data = await response.json();
      setLogs(data.entries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [checkIfAtBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [logs, scrollToBottom]);

  const handleClearLogs = useCallback(async () => {
    if (!confirm('Clear all logs?')) return;
    try {
      await fetch('/api/logs/clear', { method: 'POST' });
      setLogs([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear');
    }
  }, []);

  // Resize handling
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startYRef.current = e.clientY;
      startHeightRef.current = height;
    },
    [height]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startYRef.current - e.clientY;
      const newHeight = Math.min(
        Math.max(150, startHeightRef.current + deltaY),
        window.innerHeight - 100
      );
      setHeight(newHeight);
    };

    const handleMouseUp = () => setIsResizing(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Fetch on open
  useEffect(() => {
    if (isOpen) {
      wasAtBottomRef.current = true;
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  // Auto-refresh
  useEffect(() => {
    if (!isOpen || !autoRefresh) return;
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, fetchLogs]);

  const toggleLevel = (level: LogLevel) => {
    setActiveLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  const toggleContext = (context: string) => {
    setActiveContexts((prev) => {
      const next = new Set(prev);
      if (next.has(context)) next.delete(context);
      else next.add(context);
      return next;
    });
  };

  if (!isOpen) return null;

  const getLevelColor = (level: LogLevel) => {
    if (level === 'error') return 'text-error';
    if (level === 'warn') return 'text-warning';
    if (level === 'info') return 'text-info';
    return 'text-base-content/60';
  };

  const getLineClasses = (log: LogEntry) => {
    if (log.level === 'error') return 'bg-error/10';
    if (log.level === 'warn') return 'bg-warning/5';
    return '';
  };

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    } as Intl.DateTimeFormatOptions);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-base-100 border-t border-base-300 flex flex-col z-50 shadow-2xl"
      style={{ height: `${height}px` }}
    >
      {/* Resize Handle */}
      <div
        className="h-1.5 cursor-ns-resize flex items-center justify-center bg-base-200 hover:bg-base-300 transition-colors"
        onMouseDown={handleMouseDown}
      >
        <div className="w-12 h-1 bg-base-300 rounded-full" />
      </div>

      {/* Header */}
      <div className="flex justify-between items-center px-3 h-9 bg-base-200 border-b border-base-300">
        <div className="flex items-center gap-2">
          <span className="iconify ph--terminal size-4" />
          <span className="text-sm font-medium">Console</span>
          <span className="badge badge-ghost badge-xs">{filteredLogs.length} / {logs.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-xs"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button
            className="btn btn-ghost btn-xs btn-square"
            onClick={fetchLogs}
            disabled={isLoading}
            title="Refresh"
          >
            <span
              className={`iconify ph--arrows-clockwise size-4 ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            className="btn btn-ghost btn-xs btn-square"
            onClick={() => {
              wasAtBottomRef.current = true;
              scrollToBottom();
            }}
            title="Scroll to bottom"
          >
            <span className="iconify ph--arrow-down size-4" />
          </button>
          <button
            className="btn btn-ghost btn-xs btn-square hover:text-error"
            onClick={handleClearLogs}
            title="Clear logs"
          >
            <span className="iconify ph--trash size-4" />
          </button>
          <button
            className="btn btn-ghost btn-xs btn-square"
            onClick={onClose}
            title="Close"
          >
            <span className="iconify ph--x size-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 px-3 py-2 bg-base-200/50 border-b border-base-300 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-base-content/50 uppercase text-[10px] font-medium">Levels:</span>
          {LOG_LEVELS.map((level) => (
            <button
              key={level.key}
              className={`badge badge-sm cursor-pointer ${
                activeLevels.has(level.key) ? level.color : 'badge-ghost opacity-40'
              }`}
              onClick={() => toggleLevel(level.key)}
            >
              {level.label}
            </button>
          ))}
        </div>
        {uniqueContexts.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-base-content/50 uppercase text-[10px] font-medium">Context:</span>
            {uniqueContexts.map((ctx) => (
              <button
                key={ctx}
                className={`badge badge-sm cursor-pointer ${
                  activeContexts.has(ctx) ? 'badge-secondary' : 'badge-ghost opacity-40'
                }`}
                onClick={() => toggleContext(ctx)}
              >
                {ctx}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-error/10 text-error text-xs">{error}</div>
      )}

      {/* Log Content */}
      <div className="flex-1 overflow-y-auto px-3 py-2" ref={contentRef}>
        <div className="font-mono text-xs leading-relaxed">
          {filteredLogs.length === 0 ? (
            <div className="text-base-content/40 italic">No logs available</div>
          ) : (
            filteredLogs.map((log, index) => (
              <div
                key={index}
                className={`whitespace-pre-wrap break-all py-0.5 px-1 rounded ${getLineClasses(log)}`}
              >
                <span className="text-base-content/40">[{formatTimestamp(log.timestamp)}]</span>{' '}
                <span className={`font-medium ${getLevelColor(log.level)}`}>
                  [{log.level.toUpperCase().padEnd(5)}]
                </span>{' '}
                <span className="text-secondary">[{log.context}]</span>{' '}
                <span>{log.message}</span>
                {log.data && Object.keys(log.data).length > 0 && (
                  <span className="text-base-content/50 ml-2">
                    {JSON.stringify(log.data)}
                  </span>
                )}
                {log.error && (
                  <span className="text-error ml-2">{log.error}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

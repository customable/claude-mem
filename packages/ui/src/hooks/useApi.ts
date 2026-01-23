/**
 * API Hooks
 *
 * React hooks for data fetching.
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Generic data fetching hook
 */
export function useQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * SSE subscription hook
 */
export function useSSE<T>(
  url: string,
  onMessage: (data: T) => void
): {
  connected: boolean;
  error: Error | null;
} {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as T;
        onMessage(data);
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      setError(new Error('SSE connection failed'));
    };

    return () => {
      eventSource.close();
    };
  }, [url, onMessage]);

  return { connected, error };
}

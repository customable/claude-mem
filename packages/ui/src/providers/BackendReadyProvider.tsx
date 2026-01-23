/**
 * Backend Ready Provider
 *
 * Waits for the backend to be fully initialized before rendering children.
 * Shows a loading screen while waiting.
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '../api/client';

interface BackendStatus {
  coreReady: boolean;
  fullyInitialized: boolean;
  version?: string;
  workersConnected: number;
}

const BackendReadyContext = createContext<BackendStatus>({
  coreReady: false,
  fullyInitialized: false,
  workersConnected: 0,
});

export function useBackendStatus() {
  return useContext(BackendReadyContext);
}

interface Props {
  children: ReactNode;
}

export function BackendReadyProvider({ children }: Props) {
  const [status, setStatus] = useState<BackendStatus>({
    coreReady: false,
    fullyInitialized: false,
    workersConnected: 0,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retryCount = 0;

    async function checkHealth() {
      try {
        const health = await api.getHealth();
        if (cancelled) return;

        setStatus({
          coreReady: health.coreReady,
          fullyInitialized: health.initialized,
          version: health.version,
          workersConnected: health.workers?.connected || 0,
        });
        setError(null);
        retryCount = 0;

        // Keep polling if not fully initialized
        if (!health.initialized) {
          setTimeout(checkHealth, 500);
        }
      } catch (err) {
        if (cancelled) return;

        retryCount++;
        if (retryCount > 20) {
          setError('Unable to connect to backend. Is it running?');
        } else {
          // Retry with exponential backoff
          setTimeout(checkHealth, Math.min(1000 * retryCount, 5000));
        }
      }
    }

    checkHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-300" data-theme="dark">
        <div className="card bg-base-200 w-96">
          <div className="card-body items-center text-center">
            <span className="iconify ph--warning-circle size-16 text-error" />
            <h2 className="card-title">Connection Error</h2>
            <p className="text-base-content/60">{error}</p>
            <button
              className="btn btn-primary mt-4"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!status.fullyInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-300" data-theme="dark">
        <div className="card bg-base-200 w-96">
          <div className="card-body items-center text-center">
            <span className="loading loading-spinner loading-lg text-primary" />
            <h2 className="card-title mt-4">Initializing Backend</h2>
            <p className="text-base-content/60">
              {status.coreReady
                ? 'Loading data services...'
                : 'Starting core systems...'}
            </p>
            <div className="mt-4 w-full">
              <progress
                className="progress progress-primary w-full"
                value={status.coreReady ? 75 : 25}
                max="100"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BackendReadyContext.Provider value={status}>
      {children}
    </BackendReadyContext.Provider>
  );
}

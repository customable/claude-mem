/**
 * SSE-Writer Client
 *
 * Specialized WebSocket client type for SSE-Writer processes.
 * These clients write CLAUDE.md files to local filesystems and
 * need server-side filtering to only receive events for their session.
 *
 * Issue #264: Unified WebSocket System with Channels
 */

import type { WebSocket } from 'ws';
import type { ChannelEvent } from '@claude-mem/types';

/**
 * SSE-Writer client connection
 */
export interface SSEWriterClient {
  /** Unique client ID */
  id: string;
  /** WebSocket connection */
  socket: WebSocket;
  /** Session ID this writer is attached to */
  sessionId: string;
  /** Project name for filtering */
  project: string;
  /** Working directory for file writes */
  workingDirectory: string;
  /** Connection timestamp */
  connectedAt: number;
  /** Last heartbeat timestamp */
  lastHeartbeat: number;
}

/**
 * Event payload types for filtering
 */
interface ClaudeMdReadyPayload {
  contentSessionId: string;
  project: string;
  workingDirectory: string;
  content: string;
}

interface SessionPayload {
  sessionId: string;
  project?: string;
}

interface WriterControlPayload {
  sessionId: string;
  reason?: string;
}

/**
 * Check if an event should be delivered to a specific SSE-Writer client
 *
 * SSE-Writers only receive events that match their session and project.
 * This prevents cross-session data leakage and reduces noise.
 *
 * @param client - The SSE-Writer client to check
 * @param channel - The channel event being published
 * @param data - The event payload
 * @returns true if the event should be delivered to this client
 */
export function shouldDeliverToSSEWriter(
  client: SSEWriterClient,
  channel: ChannelEvent,
  data: unknown
): boolean {
  // claudemd:ready - must match sessionId AND project
  if (channel === 'claudemd:ready') {
    const payload = data as ClaudeMdReadyPayload;
    if (!payload || typeof payload !== 'object') {
      return false;
    }
    return (
      payload.contentSessionId === client.sessionId &&
      payload.project === client.project
    );
  }

  // writer:pause / writer:resume - must match sessionId
  if (channel === 'writer:pause' || channel === 'writer:resume') {
    const payload = data as WriterControlPayload;
    if (!payload || typeof payload !== 'object') {
      return false;
    }
    return payload.sessionId === client.sessionId;
  }

  // session:started / session:ended / session:pre-compact - must match sessionId
  if (channel.startsWith('session:')) {
    const payload = data as SessionPayload;
    if (!payload || typeof payload !== 'object') {
      return false;
    }
    return payload.sessionId === client.sessionId;
  }

  // All other events are not delivered to SSE-Writers
  // (they subscribe to specific channels anyway)
  return false;
}

/**
 * Default channels for SSE-Writer clients
 * These are auto-subscribed on connection
 */
export const SSE_WRITER_CHANNELS = [
  'claudemd:*',
  'writer:*',
  'session:*',
] as const;

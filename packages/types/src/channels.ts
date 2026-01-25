/**
 * Channel Types for Unified WebSocket System
 *
 * Defines channel events and client message types for the
 * channel-based WebSocket subscription system (Issue #264).
 */

// ============================================
// Channel Events
// ============================================

/**
 * All channel events that can be published/subscribed
 */
export type ChannelEvent =
  // Session lifecycle
  | 'session:started'
  | 'session:ended'
  | 'session:pre-compact'
  // Task lifecycle
  | 'task:queued'
  | 'task:assigned'
  | 'task:completed'
  | 'task:failed'
  | 'task:progress'
  // Worker status
  | 'worker:connected'
  | 'worker:disconnected'
  | 'worker:spawned'
  | 'worker:exited'
  // Observations
  | 'observation:created'
  | 'observation:queued'
  // Summaries
  | 'summary:created'
  // CLAUDE.md
  | 'claudemd:ready'
  // Prompts
  | 'prompt:new'
  // Subagents
  | 'subagent:start'
  | 'subagent:stop'
  // User tasks (Issue #260)
  | 'user-task:created'
  | 'user-task:updated'
  // SSE-Writer control
  | 'writer:pause'
  | 'writer:resume';

/**
 * Channel pattern for subscriptions (supports wildcards)
 * Examples: 'session:*', 'task:completed', '*'
 */
export type ChannelPattern = string;

// ============================================
// Client Types
// ============================================

/**
 * WebSocket client types
 */
export type WSClientType = 'browser' | 'worker' | 'sse-writer';

/**
 * Client permissions
 */
export type ClientPermission =
  | 'subscribe'      // Can subscribe to channels
  | 'broadcast'      // Can broadcast events (worker/hub only)
  | 'task:receive'   // Can receive task assignments (worker only)
  | 'task:complete'; // Can complete tasks (worker only)

/**
 * Default permissions by client type
 */
export const DEFAULT_PERMISSIONS: Record<WSClientType, ClientPermission[]> = {
  browser: ['subscribe'],
  worker: ['subscribe', 'task:receive', 'task:complete'],
  'sse-writer': ['subscribe'],
};

// ============================================
// Client -> Server Messages
// ============================================

/**
 * Browser authentication message (no token required)
 */
export interface BrowserAuthMessage {
  type: 'auth';
  clientType?: 'browser';
}

/**
 * SSE-Writer authentication message (with session context)
 */
export interface SSEWriterAuthMessage {
  type: 'auth';
  clientType: 'sse-writer';
  sessionId: string;
  project: string;
  workingDirectory: string;
}

/**
 * Subscribe to channels
 */
export interface SubscribeMessage {
  type: 'subscribe';
  channels: string[];
}

/**
 * Unsubscribe from channels
 */
export interface UnsubscribeMessage {
  type: 'unsubscribe';
  channels: string[];
}

/**
 * Heartbeat response
 */
export interface PongMessage {
  type: 'pong';
}

/**
 * All browser/sse-writer -> server messages
 */
export type ClientToServerMessage =
  | BrowserAuthMessage
  | SSEWriterAuthMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | PongMessage;

// ============================================
// Server -> Client Messages
// ============================================

/**
 * Authentication success response
 */
export interface AuthSuccessMessage {
  type: 'auth:success';
  clientId: string;
  permissions?: ClientPermission[];
}

/**
 * Authentication failure response
 */
export interface AuthFailedMessage {
  type: 'auth:failed';
  reason: string;
}

/**
 * Subscription confirmation
 */
export interface SubscribedMessage {
  type: 'subscribed';
  channels: string[];
}

/**
 * Channel event delivery
 */
export interface EventMessage {
  type: 'event';
  channel: ChannelEvent;
  data: unknown;
  timestamp: number;
}

/**
 * Heartbeat ping
 */
export interface PingMessage {
  type: 'ping';
}

/**
 * All server -> browser/sse-writer messages
 */
export type ServerToClientMessage =
  | AuthSuccessMessage
  | AuthFailedMessage
  | SubscribedMessage
  | EventMessage
  | PingMessage;

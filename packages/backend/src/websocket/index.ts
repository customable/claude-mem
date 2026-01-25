/**
 * WebSocket Module
 */

export { WorkerHub } from './worker-hub.js';
export type { WorkerHubOptions } from './worker-hub.js';

export { TaskDispatcher } from './task-dispatcher.js';
export type { TaskDispatcherOptions } from './task-dispatcher.js';

export { ChannelManager } from './channel-manager.js';

export { FederatedRouter } from './federated-router.js';
export type { TaskRoutingOptions } from './federated-router.js';

export { HubFederation } from './hub-federation.js';
export type { HubFederationOptions, HubFederationEvents } from './hub-federation.js';

export type { ConnectedWorker, WorkerStats, TaskAssignment } from './types.js';

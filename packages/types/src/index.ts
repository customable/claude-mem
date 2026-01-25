/**
 * @claude-mem/types
 *
 * Shared TypeScript types for the claude-mem system.
 */

// Database types
export * from './database.js';

// WebSocket protocol types
export * from './websocket.js';

// Worker capabilities
export * from './capabilities.js';

// Task definitions
export * from './tasks.js';

// Repository pattern (for extensibility: SQLite, PostgreSQL, etc.)
export * from './repository.js';

// Learning insights types
export * from './insights.js';

// Decision tracking types
export * from './decisions.js';

// Plugin system types
export * from './plugins.js';

// Memory sharing types
export * from './sharing.js';

// Metrics configuration types
export * from './metrics.js';

// User task types (Issue #260)
export * from './user-task.js';

// Channel types for unified WebSocket (Issue #264)
export * from './channels.js';

// Hub federation types (Issue #263)
export * from './hub.js';

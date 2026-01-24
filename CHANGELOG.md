# Changelog

## [2.19.24] - 2026-01-24

### Bug Fixes
- Migrated MCP server from deprecated `Server` to `McpServer` to ensure compatibility with the latest API.


## [2.19.23] - 2026-01-24

### Improvements
- Removed unused exports from `websocket.ts` to clean up the type definitions.


## [2.19.22] - 2026-01-24

### Improvements
- Removed unused exports from `capabilities.ts` to streamline the type definitions.


## [2.19.21] - 2026-01-24

### Improvements
- Removed unused exports from `database.ts` to clean up the codebase.


## [2.19.20] - 2026-01-24

### Bug Fixes
- Removed unused functions from `settings.ts`

### Improvements
- Updated `vite` dependency to `^7.3.1`


## [2.19.19] - 2026-01-24

### Improvements
- Removed unused `api.ts` file to streamline the codebase.


## [2.19.18] - 2026-01-24

### Improvements
- Removed unused SSE methods and event types from both backend and UI components.


## [2.19.17] - 2026-01-24

### Improvements
- Removed unused `logger` and `isReady` from `client.ts` to streamline the codebase.


## [2.19.16] - 2026-01-24

### Bug Fixes
- Removed unused `toolName` parameter from `extractTargetDirectory` hook to clean up the codebase.


## [2.19.15] - 2026-01-24

### Improvements
- Removed unused `getStatus` method from `BackendService` to streamline the backend code.


## [2.19.14] - 2026-01-24

### Improvements
- Removed unused constants from `constants.ts` in the shared module to streamline the codebase.


## [2.19.13] - 2026-01-24

### Improvements
- Removed unused `mikroOrmMigrations` export from the database module.


## [2.19.12] - 2026-01-24

### Bug Fixes
- Stop event propagation on observation tab buttons to prevent unintended behavior.


## [2.19.11] - 2026-01-24

### Bug Fixes
- Fixed formatting of `claudemd:ready` events in Live view

### Improvements
- Improved event filtering for `claudemd` events in Live view


## [2.19.10] - 2026-01-24

### Features
- Added auto-merge workflow for all PRs
- Enabled Renovate platform automerge and auto-rebase

### Bug Fixes
- Removed auto-merge from CI workflow
- Prevented cancellation of in-progress CI runs
- Moved auto-merge to the end of the CI workflow
- Ensured auto-merge runs only after CI succeeds
- Removed unused `toolName` parameter from `extractTargetDirectory`
- Removed platform from Renovate repo config

### Improvements
- Minor code quality improvements
- Removed unused `getWorkingDirectories` method from backend
- Cleaned up `MikroOrmDatabase` initializer
- Removed unused methods from `MikroOrmUnitOfWork`
- Replaced deprecated `MikroORM` methods
- Removed unused `mikroOrmMigrations` export
- Removed unused logger and `isReady` from `client.ts`
- Removed unused exports from `websocket.ts`
- Updated `react` dependency
- Updated `typescript` dependency to `^5.9.3`
- Added Renovate configuration for automated dependency updates


## [2.19.9] - 2026-01-24

### Bug Fixes
- Removed unused `api.ts` file to clean up the codebase.

### Improvements
- Refactored type definitions to eliminate redundant files.


## [2.19.8] - 2026-01-24

### Bug Fixes
- Removed unused exports from `capabilities.ts` to clean up the codebase.

### Improvements
- Refactored `capabilities.ts` to eliminate unnecessary exports, improving maintainability.


## [2.19.7] - 2026-01-24

### Bug Fixes
- Removed unused functions from `settings.ts` to clean up the codebase.

### Improvements
- Streamlined the `settings.ts` file by eliminating redundant functions.


## [2.19.6] - 2026-01-24

### Bug Fixes
- Reverted Docker cache to registry-based

### Improvements
- Removed unused constants from `constants.ts`
- Removed Bun from backend Dockerfile, now using Node.js


## [2.19.5] - 2026-01-24

### Bug Fixes
- Removed unused exports from `paths.ts` to clean up the codebase.

### Improvements
- Switched Docker builds to use GitHub Actions cache for improved build performance.


## [2.19.4] - 2026-01-24

### Bug Fixes
- Stop event propagation on observation tab buttons

### Improvements
- Add Node.js tool cache
- Test runner cache after config update
- Test cache after enabling Forgejo cache server
- Add explicit pnpm cache using actions/cache


## [2.19.3] - 2026-01-24

### Bug Fixes
- MCP server now correctly respects remote backend configuration.


## [2.19.2] - 2026-01-24

### Bug Fixes
- Removed explicit pnpm version in CI to use the version specified in package.json

### Improvements
- Optimized CI workflows for faster execution


## [2.19.1] - 2026-01-24

### Bug Fixes
- Fixed queue worker termination when not yet connected to hub


## [2.19.0] - 2026-01-24

### Features
- Added DELETE endpoints for observations to support GDPR compliance

### Bug Fixes
- Fixed incorrect DateRangeFilter type for bulk delete operations


## [2.18.2] - 2026-01-24

### Bug Fixes
- Added `windowsHide` option to prevent terminal popup on Windows


## [2.18.1] - 2026-01-24

### Bug Fixes
- Removed Bun runtime dependency from hooks

### Improvements
- Cleaned up smart install hooks


## [2.18.0] - 2026-01-24

### Features
- Added `search_documents` MCP tool for searching cached documentation.


## [2.17.3] - 2026-01-24

### Bug Fixes
- Removed unused exports from `database.ts` to clean up the codebase.


## [2.17.2] - 2026-01-23

### Bug Fixes
- Fixed VERSION constant in constants.ts to ensure correct version during release


## [2.17.1] - 2026-01-23

### Bug Fixes
- Fixed release trigger for README updates

### Improvements
- Added comprehensive README.md


## [2.17.0] - 2026-01-23

### Features
- Added observation-based trigger for CLAUDE.md generation
- Automatically create CLAUDE.md files for all subdirectories with observations

### Bug Fixes
- Reduced task timeouts and queue overload for claude-md tasks

### Improvements
- Updated CLAUDE.md documentation files
- Updated auto-generated CLAUDE.md files
- Added SSE writer updates to CLAUDE.md documentation


## [2.16.0] - 2026-01-23

### Features
- Added `targetDirectory` support for subdirectory `CLAUDE.md` files

### Improvements
- Updated auto-generated `CLAUDE.md` files in plugin
- Added database query examples and hooks documentation


## [2.15.0] - 2026-01-23

### Features
- Added support for session working directory and subdirectory `CLAUDE.md` files

### Bug Fixes
- Fixed `hooks` to send `cwd` in observation request
- Fixed `sse-writer` to handle session reactivation after completion


## [2.14.2] - 2026-01-23

### Bug Fixes
- Fixed an issue where hooks did not wait for the `claudemd:ready` event after session end.


## [2.14.1] - 2026-01-23

### Bug Fixes
- Write SSE writer logs to file for debugging

### Documentation
- Add `sync-marketplace` command documentation
- Document CLAUDE.md auto-generation feature


## [2.14.0] - 2026-01-23

### Features
- Added periodic generation of `CLAUDE.md` during session


## [2.13.2] - 2026-01-23

### Bug Fixes
- Fixed missing path for `sse-writer.js` in handlers directory


## [2.13.1] - 2026-01-23

### Bug Fixes
- Made token optional for SSE writer in hooks


## [2.13.0] - 2026-01-23

### Features
- Enrich sessions with the first user prompt

### Improvements
- Remove dead legacy SQLite code


## [2.12.0] - 2026-01-23

### Features
- Added styling for 'change' observation type in UI

### Bug Fixes
- Fixed incorrect column name in observation queries
- Fixed handling of `import.meta.url` being undefined in CJS bundles
- Fixed session reactivation for completed sessions on resume


## [2.11.3] - 2026-01-23

### Bug Fixes
- Filter task-notifications from user prompts in session handling

### Improvements
- Update `pnpm-lock.yaml`


## [2.11.2] - 2026-01-23

### Bug Fixes
- Resolved MikroORM initialization issues


## [2.11.1] - 2026-01-23

### Bug Fixes
- Removed unused `factory.ts` export from the database module


## [2.11.0] - 2026-01-23

### Features
- Integrated MikroORM as the primary database backend
- Added MikroORM migration system
- Implemented MikroORM repositories and UnitOfWork


## [2.10.0] - 2026-01-23

### Features
- Added MikroORM setup and entity definitions for database integration.


## [2.9.0] - 2026-01-23

### Features
- Added MCP documentation storage for Context7 and WebFetch


## [2.8.0] - 2026-01-23

### Features
- Added a narrative/facts view toggle to the ObservationDetails component.


## [2.7.1] - 2026-01-23

### Bug Fixes
- Fixed hooks to properly capture `TodoRead`, `TodoWrite`, and `AskUserQuestion` events.


## [2.7.0] - 2026-01-23

### Features
- Added tracking for all MCP tool usage except for `claude-mem`'s own tools.


## [2.6.0] - 2026-01-23

### Features
- Added `/recall` skill for memory retrieval


## [2.5.1] - 2026-01-23

### Bug Fixes
- Removed unused `ObservationList` component from the UI

### Improvements
- Added workflow reminder to always commit changes in documentation


## [2.5.0] - 2026-01-23

### Features
- Added chronological display of summaries in the session timeline.


## [2.4.5] - 2026-01-23

### Bug Fixes
- Fixed auto-search not triggering when the project filter changes


## [2.4.4] - 2026-01-23

### Bug Fixes
- Fixed the "stop hook" to properly mark sessions as completed.


## [2.4.3] - 2026-01-23

### Bug Fixes
- Reduced session-start blocking by implementing a quick health check timeout.


## [2.4.2] - 2026-01-23

### Bug Fixes
- Fixed CI build step order in validate-plugin job
- Updated build-plugin path to .mjs


## [2.4.1] - 2026-01-23

### Bug Fixes
- Fixed build-plugin.js to .mjs for Node.js ES module compatibility


## [2.4.0] - 2026-01-23

### Features
- Added type parameter and backend support to the `save_memory` MCP tool for enhanced functionality.


## [2.3.0] - 2026-01-23

### Features
- Added Analytics and Projects views with clickable sessions

### Improvements
- Added `bun.lock` for reproducible builds


## [2.2.0] - 2026-01-23

### Features
- Added subtitle, narrative, and gitBranch fields to observations
- Added `/api/import` endpoint for data import
- Added `/api/export` endpoint for data export

### Bug Fixes
- Fixed observation fields (facts, concepts, files) population
- Fixed recording of user prompts

### Improvements
- Increment prompt_counter on each user prompt
- Updated pnpm-lock.yaml


## [2.1.0] - 2026-01-23

### Features
- Added `dev:restart` script for local development
- Added CLAUDEMD_ENABLED toggle in settings
- Added CLAUDE.md generation feature
- Added data import/export functionality in settings
- Enhanced worker overview with active capability and queued termination display

### Bug Fixes
- Fixed capability matching for active task display
- Fixed backend entry point and settings loading in dev-restart

### Improvements
- Improved worker overview UI with additional status information


## [2.0.1] - 2026-01-23

### Bug Fixes
- Fixed CI build process to ensure plugin is built before validation.


## [2.0.0] - 2026-01-23

### Features
- Added automatic runtime installation for plugins


## [1.20.4] - 2026-01-23

### Bug Fixes
- Fixed release process to update all workspace package versions


## [1.20.3] - 2026-01-23

### Bug Fixes
- Fixed Docker build to use Node.js and pnpm
- Prevented CI from being canceled prematurely


## [1.20.2] - 2026-01-23

### Bug Fixes
- Fixed Dockerfile to use `bun` instead of `pnpm` for backend dependencies.


## [1.20.1] - 2026-01-23

### Bug Fixes
- Fixed CI concurrency group separation from release

### Improvements
- Improved CI workflow organization


## [1.20.0] - 2026-01-23

### Features
- Sync plugin to separate repo on release
- Add restart backend button in Advanced settings
- Add worker auth, auto-spawn, and provider configuration
- Enhance Settings UI with all available settings
- Add worker spawning from WebUI
- Add real-time SSE updates for worker status in UI
- Implement embedding task handler
- Implement summarize task processing
- Add plugin build system and marketplace sync
- Add Docker support for backend and worker
- Extend observation types with granular categorization
- Show all observation fields in Search results
- Add Live and Memories views, fix Search UI
- Complete stats API and fix database table names
- Enhance UI with Settings/Search/Console views and add Qdrant support
- Phase 6 - UI Package with Tailwind CSS 4 + DaisyUI 5
- Phase 5 - Hooks Package
- Phase 4 - Worker Package with AI Agent System
- Phase 3 - Backend Package with WebSocket Hub
- Add @claude-mem/database package (Phase 2)
- Phase 1 - Monorepo structure with types and shared packages

### Bug Fixes
- Use settings for backend bind address instead of hardcoded default
- Sanitize FTS5 search queries and bump version to 2.0.0
- Connect observation task results to database storage
- Remove duplicate shebang from plugin entry points

### Improvements
- Skip workflows for release commits
- Add Forgejo CI and release workflows
- Refactor: extract shared ObservationDetails component and utils
- Misc improvements and fixes


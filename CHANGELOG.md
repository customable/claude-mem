# Changelog

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


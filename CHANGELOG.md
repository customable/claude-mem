# Changelog

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


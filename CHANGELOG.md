# Changelog

## [1.18.2] - 2026-01-22

### Bug Fixes
- Fixed analytics queries to use milliseconds for `created_at_epoch`


## [1.18.1] - 2026-01-22

### Bug Fixes
- Allow unauthenticated access to `/login` page


## [1.18.0] - 2026-01-22

### Features
- Added CLI commands for generating and cleaning files.


## [1.17.0] - 2026-01-22

### Features
- Added support for OpenAI provider integration.


## [1.16.2] - 2026-01-22

### Bug Fixes
- Fixed rate-limit handling by updating to use the Mistral SDK with automatic rate-limit management.


## [1.16.1] - 2026-01-22

### Bug Fixes
- Fixed macOS rsync and Bun stdin issues
- Added pip fallback for Chroma MCP in sandbox environments


## [1.16.0] - 2026-01-22

### Features
- Added web viewer login page with cookie-based sessions


## [1.15.1] - 2026-01-22

### Bug Fixes
- Added null checks to analytics charts to prevent crashes


## [1.15.0] - 2026-01-22

### Features
- Added metrics and observability endpoints


## [1.14.2] - 2026-01-22

### Bug Fixes
- Fixed Docker build caching by switching from GitHub Actions cache to registry cache


## [1.14.1] - 2026-01-22

### Bug Fixes
- Fixed CI builds by adding Docker socket mount.


## [1.14.0] - 2026-01-22

### Features
- Added memory retention policies to manage data persistence.


## [1.13.0] - 2026-01-22

### Features
- Added new CLI commands for power users


## [1.12.0] - 2026-01-22

### Features
- Added remote worker architecture to support distributed task execution.


## [1.11.0] - 2026-01-22

### Features
- Added backup and restore functionality
- Added Analytics Dashboard with Charts


## [1.10.0] - 2026-01-22

### Features
- Added memory tagging and categorization functionality.


## [1.9.0] - 2026-01-22

### Features
- Added semantic search with similarity scores


## [1.8.1] - 2026-01-22

### Bug Fixes
- Fixed CI to make the Docker job non-blocking in the release workflow.


## [1.8.0] - 2026-01-22

### Features
- Added export functionality and bulk actions for memories
- Implemented keyboard shortcuts and command palette

### Bug Fixes
- Replaced inline SVGs with Icon component for consistent icons in LogsModal

### Improvements
- Replaced CSS iconify icons with Icon component for consistent icons


## [1.7.0] - 2026-01-22

### Features
- Added Session Timeline View
- Added Queue Management UI


## [1.6.0] - 2026-01-22

### Features
- Added Docker deployment support


## [1.5.0] - 2026-01-22

### Features
- Added toast notification system for user feedback and alerts.


## [1.4.0] - 2026-01-22

### Features
- Added support for `CLAUDE_MEM_VECTOR_DB=none` to enable SQLite-only mode.


## [1.3.8] - 2026-01-22

### Bug Fixes
- Fixed syncing to additional Claude environment marketplaces


## [1.3.7] - 2026-01-22

### Bug Fixes
- Prevent Windows Terminal popup from appearing during hook execution


## [1.3.6] - 2026-01-22

### Bug Fixes
- Fixed non-blocking worker startup with graceful degradation in hooks

### Improvements
- Added fallback for `github.repository` variable in release workflow


## [1.3.5] - 2026-01-22

### Bug Fixes
- Added stale session detection and auto-cleanup to prevent orphaned sessions.


## [1.3.4] - 2026-01-22

### Bug Fixes
- Improved zombie process cleanup mechanism

### Improvements
- Added monitoring for zombie process cleanup


## [1.3.3] - 2026-01-22

### Bug Fixes
- Added built-in exclude patterns for CLAUDE.md generation to prevent unnecessary file inclusions.


## [1.3.2] - 2026-01-22

### Bug Fixes
- Resolved TypeScript type errors (partial fix for #49)

### Improvements
- Updated built scripts

### Documentation
- Added documentation link to README


## [1.3.1] - 2026-01-22

### Bug Fixes
- Fixed CI to include plugin/package.json in release version updates

### Improvements
- Synced marketplace.json version to 1.2.2
- Completed migration from thedotmack to customable

### Documentation
- Replaced docs.claude-mem.ai links with GitHub README links


## [1.3.0] - 2026-01-22

### Features
- Migrate to Customable marketplace with auto MCP registration

### Improvements
- Rebuild bundled scripts


## [1.2.2] - 2026-01-22

### Bug Fixes
- Fixed package.json metadata for Customable fork


## [1.2.1] - 2026-01-22

### Bug Fixes
- Prevent stale Web UI cache with aggressive cache-busting

### Improvements
- Add GitHub links to README


## [1.2.0] - 2026-01-22

### Features
- Sync releases to GitHub

### Improvements
- Remove `.playwright-mcp` from tracking


## [1.1.0] - 2026-01-22

### Features
- Added PPID-based orphan detection to improve process cleanup accuracy

### Improvements
- Cleaned up repository structure for better organization


## [1.0.4] - 2026-01-21

### Bug Fixes
- Fixed YAML parsing error in CHANGELOG step
- Completed release automation

### Improvements
- Removed CHANGELOG.md file


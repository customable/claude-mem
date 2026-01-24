# claude-mem

**Persistent memory system for Claude Code** - Transform your AI coding sessions from isolated conversations into continuous knowledge.

[![Version](https://img.shields.io/badge/version-2.27.0-blue.svg)](https://git.customable.host/customable/claude-mem)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## What is claude-mem?

claude-mem is a Claude Code plugin that captures, compresses, and recalls knowledge across sessions. It automatically:

- **Extracts observations** from every tool use (file reads, edits, searches)
- **Generates summaries** at session end
- **Injects context** into new sessions via CLAUDE.md files
- **Enables semantic search** across your project's history

## Features

| Feature | Description |
|---------|-------------|
| **Observation Extraction** | AI-powered extraction of insights from tool outputs |
| **Session Summaries** | Compressed session history with request/learned/completed |
| **Auto CLAUDE.md** | Generates context files in your project directories |
| **MCP Search Tools** | Semantic search across observations and memories |
| **Multi-Provider** | Supports Anthropic, Mistral, OpenAI for AI tasks |
| **Web UI** | Browse sessions, observations, and summaries |
| **Document Caching** | Caches Context7/WebFetch results for reuse |
| **SSE Real-Time Updates** | Live updates to CLAUDE.md files during sessions |

## Key Concepts

### Observations

Observations are AI-extracted insights from tool usage. Each observation captures:
- **Title & Text**: Concise summary of what happened
- **Type**: One of 18 categories (see below)
- **Facts**: Extracted factual statements
- **Concepts**: Related patterns and ideas
- **Files**: Read and modified file paths

**Observation Types:**

| Category | Types | Emoji |
|----------|-------|-------|
| **Work** | `bugfix`, `feature`, `refactor`, `change` | 🔴 🟣 🟠 🟢 |
| **Docs & Config** | `docs`, `config` | 📝 ⚙️ |
| **Quality** | `test`, `security`, `performance` | 🧪 🔒 ⚡ |
| **Infrastructure** | `deploy`, `infra`, `migration` | 🚀 🏗️ 📦 |
| **Knowledge** | `discovery`, `decision`, `research` | 🔵 💡 🔍 |
| **Integration** | `integration`, `dependency`, `api` | 🔗 📚 🌐 |

### Session Lifecycle

```
session-start → user-prompt-submit → post-tool-use (repeated) → stop
     │                                      │                      │
     ▼                                      ▼                      ▼
 Inject context              Extract observations         Generate summary
 Spawn SSE writer           Queue AI extraction tasks     Update CLAUDE.md
```

### Task Queue

Background workers process AI tasks with priority-based scheduling:

| Task Type | Priority | Description |
|-----------|----------|-------------|
| `observation` | 50 | Extract insights from tool output |
| `summarize` | 40 | Compress session observations |
| `embedding` | 30 | Generate vector embeddings |
| `claude-md` | 20 | Generate CLAUDE.md content |

### SSE Writer

The SSE Writer is a standalone Node.js process that handles real-time CLAUDE.md updates:

- **Spawned per session** at `session-start` hook
- **Connects to** `/api/stream` via EventSource API
- **Validates** session/project/directory before every write (security boundary)
- **Listens for events**: `claudemd:ready`, `session:ended`
- **Preserves** user content outside `<claude-mem-context>` tags
- **Auto-exits** after 10 minutes if no relevant events
- **PID management** for cleanup via `~/.claude-mem/sse-writer-*.pid`

```
┌─────────────┐      SSE       ┌─────────────┐
│   Backend   │ ────────────▶  │ SSE Writer  │
│  (Express)  │  claudemd:ready│  (Node.js)  │
└─────────────┘                └──────┬──────┘
                                      │
                                      ▼
                               ┌─────────────┐
                               │ CLAUDE.md   │
                               │   files     │
                               └─────────────┘
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Claude Code                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ SessionStart│  │PostToolUse  │  │    Stop     │          │
│  │    Hook     │  │    Hook     │  │    Hook     │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
└─────────┼────────────────┼────────────────┼─────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                       Backend (Express)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Session   │  │    Task     │  │     SSE     │          │
│  │   Service   │  │   Service   │  │ Broadcaster │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
└─────────┼────────────────┼────────────────┼─────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────────────┐
│    Database     │ │   Worker    │ │      SSE Writer         │
│    (SQLite)     │ │  (AI Agent) │ │   (CLAUDE.md files)     │
└─────────────────┘ └─────────────┘ └─────────────────────────┘
```

## Installation

### As Claude Code Plugin

```bash
# Install from Claude Code marketplace
claude mcp install claude-mem
```

### Development Setup

```bash
# Clone the repository
git clone https://git.customable.host/customable/claude-mem.git
cd claude-mem

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Build plugin for marketplace
pnpm build:plugin

# Sync to Claude installations
pnpm sync-marketplace
```

## Project Structure

```
packages/
├── types/          # Shared TypeScript types
├── shared/         # Utilities, logging, settings
├── database/       # SQLite + MikroORM repositories
├── backend/        # Express API server
├── worker/         # AI agents for observation extraction
├── hooks/          # Claude Code hook handlers
└── ui/             # React web interface
```

## Configuration

Settings are stored in `~/.claude-mem/settings.json`:

```json
{
  "BACKEND_PORT": 37777,
  "AI_PROVIDER": "anthropic",
  "ANTHROPIC_API_KEY": "sk-ant-...",
  "CLAUDEMD_ENABLED": true,
  "CLAUDEMD_OBSERVATION_INTERVAL": 10,
  "LOG_LEVEL": "info"
}
```

## MCP Tools

claude-mem exposes search tools via MCP:

```typescript
// Search observations
mcp__plugin_claude-mem_mcp-search__search({
  query: "authentication implementation",
  limit: 10
})

// Get observation details
mcp__plugin_claude-mem_mcp-search__get_observations({
  ids: [123, 456]
})

// Save a memory
mcp__plugin_claude-mem_mcp-search__save_memory({
  text: "Important decision about architecture",
  type: "decision"
})
```

## Development

```bash
# Restart dev server (backend + UI)
pnpm run dev:restart

# Type check all packages
pnpm run typecheck

# Build plugin
pnpm run build:plugin
```

## Database

SQLite database at `~/.claude-mem/claude-mem.db`:

| Table | Description |
|-------|-------------|
| `sdk_sessions` | Claude Code sessions |
| `observations` | AI-extracted insights from tool use |
| `session_summaries` | Compressed session summaries |
| `project_claudemd` | Generated CLAUDE.md content |
| `task_queue` | Worker task queue |
| `documents` | Cached external documentation |

## Roadmap

Current high-priority items:

- **Endless Mode** ([#109](https://git.customable.host/customable/claude-mem/issues/109)) - Real-time context compression for unlimited session length
- **Process/Memory Leaks** ([#101](https://git.customable.host/customable/claude-mem/issues/101)) - Fix orphaned worker processes
- **Documents Search** ([#115](https://git.customable.host/customable/claude-mem/issues/115)) - MCP tool for searching cached documentation

See [all open issues](https://git.customable.host/customable/claude-mem/issues) for the full list.

## Acknowledgments

Originally based on [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem). This project has since evolved into an independent implementation with:

- Modular monorepo architecture
- Multi-provider AI support (Anthropic, Mistral, OpenAI)
- Auto-generated CLAUDE.md files per subdirectory
- Document caching for Context7/WebFetch
- Forgejo integration

## Related

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) - Anthropic's agentic coding tool

## License

MIT

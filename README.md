<h1 align="center">
  Claude-Mem
  <br>
  <sub>Customable Fork</sub>
</h1>

<h4 align="center">Persistent memory system for <a href="https://claude.ai/download" target="_blank">Claude Code</a>.</h4>

<p align="center">
  <a href="https://github.com/customable/claude-mem">
    <img src="https://img.shields.io/badge/GitHub-customable%2Fclaude--mem-blue?logo=github" alt="GitHub">
  </a>
  <a href="https://mem.customable.host">
    <img src="https://img.shields.io/badge/Docs-mem.customable.host-blue?logo=readthedocs" alt="Documentation">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License">
  </a>
  <a href="package.json">
    <img src="https://img.shields.io/badge/version-1.11.0-green.svg" alt="Version">
  </a>
</p>

<p align="center">
  Claude-Mem preserves context across sessions by automatically capturing tool usage observations, generating semantic summaries, and making them available to future sessions. This enables Claude to maintain continuity of knowledge about projects even after sessions end.
</p>

---

## About This Fork

This is a fork of [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) with the following enhancements:

- **Qdrant Support** - Vector database integration for semantic search
- **OpenCode Compatibility** - Works with OpenCode platform
- **Enhanced Web UI** - Improved viewer with console logs
- **Export/Import** - API endpoints for data portability
- **Network Binding** - Configurable host binding for remote access
- **MIT License** - More permissive licensing

---

## Quick Start

### Option 1: Customable Marketplace (recommended)

```
> /plugin marketplace add https://git.customable.host/customable/claude-plugins.git
> /plugin install claude-mem
```

### Option 2: GitHub

```
> /plugin install https://github.com/customable/claude-mem.git
```

Restart Claude Code. Context from previous sessions will automatically appear in new sessions.

**Key Features:**

- **Persistent Memory** - Context survives across sessions
- **Progressive Disclosure** - Layered memory retrieval with token cost visibility
- **MCP Search Tools** - Query your project history programmatically
- **Web Viewer UI** - Real-time memory stream at http://localhost:37777
- **Privacy Control** - Use `<private>` tags to exclude sensitive content from storage
- **Context Configuration** - Fine-grained control over what context gets injected
- **Automatic Operation** - No manual intervention required

---

## How It Works

**Core Components:**

1. **5 Lifecycle Hooks** - SessionStart, UserPromptSubmit, PostToolUse, Stop, SessionEnd
2. **Worker Service** - HTTP API on port 37777 with web viewer UI
3. **SQLite Database** - Stores sessions, observations, summaries
4. **Chroma Vector Database** - Hybrid semantic + keyword search for intelligent context retrieval

---

## MCP Search Tools

Claude-Mem provides intelligent memory search through **4 MCP tools** following a token-efficient **3-layer workflow pattern**:

**The 3-Layer Workflow:**

1. **`search`** - Get compact index with IDs (~50-100 tokens/result)
2. **`timeline`** - Get chronological context around interesting results
3. **`get_observations`** - Fetch full details ONLY for filtered IDs

**Available MCP Tools:**

- **`search`** - Search memory index with full-text queries, filters by type/date/project
- **`timeline`** - Get chronological context around a specific observation
- **`get_observations`** - Fetch full observation details by IDs
- **`save_memory`** - Manually save observations

---

## System Requirements

- **Node.js**: 18.0.0 or higher
- **Claude Code**: Latest version with plugin support
- **Bun**: JavaScript runtime (auto-installed if missing)
- **uv**: Python package manager for vector search (auto-installed if missing)

---

## Configuration

Settings are managed in `~/.claude-mem/settings.json` (auto-created with defaults on first run).

---

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Type check
bun run typecheck
```

---

## License

This project is licensed under the **MIT License**.

See the [LICENSE](LICENSE) file for details.

---

## Attribution

This project is a fork of [claude-mem](https://github.com/thedotmack/claude-mem) by Alex Newman ([@thedotmack](https://github.com/thedotmack)).

Original project: https://github.com/thedotmack/claude-mem

---

## Support

- **Documentation**: [mem.customable.host](https://mem.customable.host)
- **GitHub**: [github.com/customable/claude-mem](https://github.com/customable/claude-mem)
- **Forgejo**: [git.customable.host/customable/claude-mem](https://git.customable.host/customable/claude-mem)
- **Issues & PRs**: Please submit via [GitHub](https://github.com/customable/claude-mem/issues)
- **Maintainer**: [Customable](https://customable.de)

---

**Built with Claude Agent SDK** | **Powered by Claude Code** | **Made with TypeScript**

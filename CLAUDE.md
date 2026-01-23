# Claude-Mem Development Instructions

## Workflow

**IMMER Änderungen committen und pushen** nach Abschluss einer Aufgabe!

## Wichtige Befehle

### Dev Server Restart
**IMMER** `pnpm run dev:restart` verwenden um Backend und UI neu zu starten:
```bash
pnpm run dev:restart
```

### TypeScript Check
```bash
# Alle Packages auf Root-Ebene
pnpm run typecheck
```

### Build
```bash
pnpm run build
```

### Plugin Build
```bash
pnpm run build:plugin
```

### Plugin Sync (nach Build!)
```bash
pnpm run sync-marketplace
```
Synchronisiert das Plugin in alle Claude-Installationen. **Claude Code muss danach neu gestartet werden!**

## Projekt-Struktur

- `packages/types` - Shared TypeScript types
- `packages/shared` - Shared utilities, constants, logger
- `packages/database` - SQLite database layer
- `packages/backend` - Express API server
- `packages/hooks` - Claude Code hooks handlers
- `packages/worker` - Background worker for AI tasks
- `packages/ui` - React/Vite frontend

## Datenbank

SQLite-Datenbank unter `~/.claude-mem/claude-mem.db`

### Wichtige Tabellen

| Tabelle | Beschreibung |
|---------|--------------|
| `sdk_sessions` | Claude Code Sessions mit working_directory |
| `observations` | AI-generierte Observations mit cwd |
| `session_summaries` | Session-Zusammenfassungen |
| `project_claudemd` | Generierter CLAUDE.md Content |
| `task_queue` | Worker Task Queue |
| `documents` | Gecachte MCP-Dokumentation (Context7, WebFetch) |

### Abfrage-Beispiele

**Hinweis:** MikroORM wird intern im Backend verwendet. Für schnelle Debugging-Abfragen ist `bun:sqlite` einfacher (kein Connection-Setup).

```bash
# Sessions abfragen (WICHTIG: Tabelle heißt sdk_sessions!)
bun -e "
import Database from 'bun:sqlite';
const db = new Database('/home/jonas/.claude-mem/claude-mem.db', { readonly: true });
console.log(db.query('SELECT id, content_session_id, working_directory, status FROM sdk_sessions ORDER BY id DESC LIMIT 5').all());
"

# Observations abfragen
bun -e "
import Database from 'bun:sqlite';
const db = new Database('/home/jonas/.claude-mem/claude-mem.db', { readonly: true });
console.log(db.query('SELECT id, title, type, cwd FROM observations ORDER BY id DESC LIMIT 5').all());
"

# CLAUDE.md Content abfragen
bun -e "
import Database from 'bun:sqlite';
const db = new Database('/home/jonas/.claude-mem/claude-mem.db', { readonly: true });
console.log(db.query('SELECT id, project, content_session_id, working_directory FROM project_claudemd ORDER BY id DESC LIMIT 5').all());
"

# Task Queue Status
bun -e "
import Database from 'bun:sqlite';
const db = new Database('/home/jonas/.claude-mem/claude-mem.db', { readonly: true });
console.log(db.query('SELECT type, status, COUNT(*) as count FROM task_queue GROUP BY type, status').all());
"
```

## CLAUDE.md Auto-Generation

Das Plugin generiert automatisch Context-Sections in CLAUDE.md-Dateien.

**Komponenten:**
- `SSE-Writer` - Wird beim Session-Start gespawnt, lauscht auf SSE-Events
- `claude-md` Task - Generiert den Content (AI-basiert)
- `project_claudemd` Tabelle - Speichert generierten Content

**Timing:**
- Nach jeder X. Observation wird ein `claude-md` Task gequeued (Standard: 10)
- Nach Session-Ende wird ebenfalls generiert (via summarize-Task)
- SSE-Writer empfängt `claudemd:ready` Event und schreibt die Datei
- Subdirectories mit Observations bekommen automatisch eigene CLAUDE.md Dateien

**Konfiguration:**
- `CLAUDEMD_ENABLED: true` in `~/.claude-mem/settings.json`
- `CLAUDEMD_OBSERVATION_INTERVAL: 10` - Anzahl Observations bis zur nächsten Generierung

**Debugging:**
```bash
# SSE-Writer Prozesse prüfen
ps aux | grep sse-writer

# PID-Dateien prüfen
ls ~/.claude-mem/sse-writer-*.pid

# Generierten Content in DB prüfen
bun -e "
import Database from 'bun:sqlite';
const db = new Database('/home/jonas/.claude-mem/claude-mem.db', { readonly: true });
console.log(db.query('SELECT id, project, content_session_id FROM project_claudemd ORDER BY id DESC').all());
"
```

## Neue Migration erstellen

1. **Migration-Datei erstellen:**
   ```bash
   # In packages/database/src/mikro-orm/migrations/
   Migration20260123000005_CreateDocumentsTable.ts
   ```

2. **Migration in Index exportieren:**
   ```typescript
   // packages/database/src/mikro-orm/migrations/index.ts
   export { Migration20260123000005_CreateDocumentsTable } from './Migration20260123000005_CreateDocumentsTable.js';

   export const mikroOrmMigrations = [
     // ... bestehende Migrations
     'Migration20260123000005_CreateDocumentsTable',
   ];
   ```

3. **Migration in Config registrieren:**
   ```typescript
   // packages/database/src/mikro-orm.config.ts
   import { Migration20260123000005_CreateDocumentsTable } from './mikro-orm/migrations/Migration20260123000005_CreateDocumentsTable.js';

   export const migrationsList = [
     // ... bestehende Migrations
     Migration20260123000005_CreateDocumentsTable,
   ];
   ```

4. **Dev-Server neustarten:**
   ```bash
   pnpm run dev:restart
   ```
   Die Migration wird automatisch beim Start ausgeführt.

## Forgejo Issues

Repository: `thedotmack/claude-mem` auf der lokalen Forgejo-Instanz

<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

### Jan 23

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #12047 | 11:14 PM | 🔵 | Git status shows uncommitted changes | ~1028 |
| #12046 | 11:13 PM | 🟣 | Staging CLAUDE.md files for commit | ~748 |
| #12045 | 11:13 PM | 🔵 | Git status reveals modified CLAUDE.md files | ~1104 |
| #12044 | 11:12 PM | ✅ | Simplifying API by removing source filtering | ~968 |
| #12043 | 11:12 PM | 🟠 | Issue created for MCP tool to search docs | ~2149 |
| #12042 | 11:10 PM | 🔵 | Documents table schema inspection | ~2061 |
| #12041 | 11:10 PM | 🔵 | Anthropic SDK: Streaming and Token Usage | ~2619 |
| #12040 | 11:10 PM | 🔵 | Identified Anthropic TypeScript SDK libraries | ~1198 |
| #12039 | 11:09 PM | 🔵 | Database query reveals recent observation types | ~1249 |
| #12038 | 11:09 PM | 🔵 | Database contains 4 documents | ~780 |
| #12037 | 11:09 PM | 🔵 | Post-tool-use handler sends observations | ~2068 |
| #12036 | 11:08 PM | 🔵 | Observation Handler Implementation Review | ~1845 |
| #12035 | 11:08 PM | 🔵 | Project structure overview | ~1077 |
| #12034 | 11:08 PM | 🔵 | Task system architecture overview | ~2546 |
| #12033 | 11:08 PM | 🔵 | Hook system types and structure discovered | ~1379 |
| #12032 | 11:08 PM | 🔵 | No compression-related code found | ~707 |
| #12031 | 11:08 PM | 🔵 | Architecture Analysis for Endless Mode | ~4547 |
| #12030 | 11:08 PM | 🔵 | Examining Observation Entity Structure | ~1414 |
| #12029 | 11:08 PM | 🔵 | Post-tool-use handler sends observations | ~2065 |
| #12028 | 11:08 PM | 🔵 | Found "transcript" references in hooks | ~771 |
| #12027 | 11:08 PM | 🔵 | Discovered observation type definitions | ~1857 |
| #12026 | 11:08 PM | 🔵 | User prompt submission handler initializes | ~1236 |
| #12025 | 11:07 PM | 🔵 | Context Generation Handler Implementation | ~1342 |
| #12024 | 11:07 PM | 🔵 | Exploring settings management structure | ~2402 |
| #12023 | 11:07 PM | 🔵 | SSE Writer Component Analysis | ~1725 |
| #12022 | 11:07 PM | 🔵 | Hook Runner Implementation Analysis | ~1596 |
| #12021 | 11:07 PM | 🔵 | Examining Data Router Structure | ~1949 |
| #12020 | 11:07 PM | 🔵 | Hook system types and structure discovered | ~1475 |
| #12019 | 11:07 PM | 🔵 | Examining Task Service Implementation | ~2105 |
| #12018 | 11:07 PM | 🔵 | Understanding the stop hook handler | ~1761 |

## Key Insights

- **Architecture**: The project is a modular monorepo with packages for backend, database, hooks, and workers. Key components include PostToolUse hooks, task dispatchers, and observation handlers.
- **Endless Mode**: Current implementation causes latency issues due to synchronous processing. Optimization is needed for real-time context compression.
- **New Feature**: Issue #115 proposes an MCP tool to search cached documents, reducing dependency on Context7.
- **API Simplification**: Decision made to remove source filtering from the search API to simplify usage.
- **Documentation**: Multiple CLAUDE.md files were modified and staged, indicating active documentation updates.
</claude-mem-context>

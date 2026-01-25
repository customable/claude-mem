# Claude-Mem Development Instructions

## Workflow

**IMMER Änderungen committen und pushen** nach Abschluss einer Aufgabe!

**Bei mehreren Issues:** Pro Issue einen eigenen Commit erstellen, dann am Ende gesammelt pushen.

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

Repository: `customable/claude-mem` auf der lokalen Forgejo-Instanz

<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

### Jan 25

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #15506 | 1:31 AM | 🔵 | Git status reveals modified files | ~947 |
| #15505 | 1:31 AM | 🔵 | Examining parseFts5Query implementation | ~1302 |
| #15504 | 1:31 AM | 🔵 | Search API rejects standalone wildcard | ~819 |
| #15503 | 1:30 AM | 🔵 | Testing parseFts5Query wildcard handling | ~965 |
| #15502 | 1:30 AM | 🔵 | FTS5 Query Parsing Logic discovered | ~1525 |
| #15501 | 1:30 AM | 🔵 | SQLite FTS wildcard limitation found | ~951 |
| #15500 | 1:30 AM | 🔵 | Search API fails with wildcard query | ~896 |
| #15499 | 1:30 AM | 🟣 | Dev environment restarted | ~1101 |
| #15498 | 1:30 AM | 🔵 | Backend and SSE writer running | ~1018 |
| #15497 | 1:30 AM | 🔵 | Wildcard check logic validated | ~821 |
| #15496 | 1:29 AM | 🔵 | Git history of ObservationRepository | ~895 |
| #15495 | 1:29 AM | 🔵 | Base Router Class Structure | ~1631 |
| #15494 | 1:29 AM | 🔵 | Search routes implementation | ~3257 |
| #15493 | 1:29 AM | 🔵 | MCP Server Implementation | ~3006 |
| #15492 | 1:29 AM | 🔵 | No "mcp-search*.ts" files found | ~710 |
| #15491 | 1:29 AM | 🔵 | FTS5 error handling in search routes | ~1476 |
| #15490 | 1:29 AM | 🔵 | FTS5 query parsing implementation | ~3299 |
| #15489 | 1:29 AM | 🔵 | Full-text search using SQLite FTS5 | ~1881 |
| #15488 | 1:27 AM | 🔵 | Database query for Jan 24 activity | ~4015 |
| #15487 | 1:26 AM | 🔵 | Inspected sdk_sessions table schema | ~1799 |
| #15486 | 1:25 AM | 🟣 | Built and synced plugin | ~1674 |
| #15485 | 1:25 AM | 🟣 | Dev environment restarted | ~2458 |
| #15484 | 1:24 AM | ✅ | Closed issue #238 | ~1339 |
| #15483 | 1:24 AM | 🟣 | Pushed changes to remote | ~780 |
| #15482 | 1:24 AM | 🔴 | Fixed FTS5 special character handling | ~1065 |
| #15481 | 1:24 AM | 🔵 | Git status shows modified files | ~935 |
| #15480 | 1:23 AM | 🔵 | Node.js version mismatch | ~1026 |
| #15479 | 1:23 AM | 🔵 | Suggestion Service details | ~1782 |
| #15478 | 1:23 AM | 🔵 | Dual search system discovered | ~2973 |
| #15477 | 1:23 AM | 🔵 | Search functionality usage | ~1055 |

## Key Insights

- **FTS5 Query Handling**: SQLite FTS5 has limitations with special characters (e.g., `*` as standalone wildcard, `-` as NOT operator). The `parseFts5Query` method handles complex parsing, including phrases, operators, and special characters.
- **Search System**: The project uses a hybrid search system with both semantic (Qdrant) and full-text (SQLite FTS5) search capabilities, with automatic fallback to FTS5 when Qdrant is unavailable.
- **Error Handling**: Consistent error handling for FTS5 query parsing errors across search endpoints, converting SQLite errors to user-friendly messages.
- **Recent Fixes**: Fixed special character handling in search queries (hyphens, wildcards) and improved error messages for invalid queries.
- **Environment Issues**: Node.js version mismatch (requires >=24.13.0, running v22.22.0) and pending commits for modified files (CLAUDE.md, search.ts, ObservationRepository.ts, package.json).
</claude-mem-context>

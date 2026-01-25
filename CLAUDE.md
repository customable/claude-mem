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
**Erfolgreich wenn:** Alle Packages zeigen "Done" in der Ausgabe. Der Check läuft über 7 Workspace-Packages und ist fertig sobald alle "Done" erscheinen. **Nicht** mehrfach starten oder auf weitere Ausgabe warten!

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

### Jan 25, 2026

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #637 | 12:46 PM | 🟠 | Conditional Qdrant capabilities | ~986 |
| #636 | 12:46 PM | 🔵 | Worker Capabilities Analysis | ~5090 |
| #635 | 12:45 PM | 🔵 | UI hooks files discovered | ~768 |
| #634 | 12:45 PM | 🟠 | Vector-DB optional implementation | ~1062 |
| #633 | 12:45 PM | 🔵 | Worker Capabilities System | ~3277 |
| #632 | 12:45 PM | 🔵 | Environment variables in settings | ~805 |
| #631 | 12:45 PM | 🟣 | Task status updated | ~726 |
| #630 | 12:45 PM | 🔵 | Capabilities cross-module usage | ~1282 |
| #629 | 12:45 PM | 🔵 | TypeScript typecheck results | ~947 |
| #628 | 12:45 PM | 🔵 | Settings configuration structure | ~2572 |
| #627 | 12:45 PM | 🟣 | CLAUDE.md file changes staged | ~1277 |
| #626 | 12:45 PM | 🔵 | TypeScript typecheck status | ~972 |
| #625 | 12:45 PM | 🔵 | Worker Service Architecture | ~3966 |
| #624 | 12:45 PM | 🔵 | WebSocket Client Implementation | ~2450 |
| #623 | 12:45 PM | 🔵 | Task Dispatcher Architecture | ~2449 |
| #622 | 12:45 PM | 🟣 | Files staged for Issue #112 | ~987 |
| #621 | 12:45 PM | 🔵 | In-Process Worker Architecture | ~4551 |
| #620 | 12:45 PM | 🔵 | Worker Hub WebSocket System | ~5280 |
| #619 | 12:44 PM | 🔵 | Capabilities cross-module usage | ~1008 |
| #618 | 12:44 PM | 🔵 | Worker package structure | ~1902 |
| #617 | 12:44 PM | 🔵 | Worker package structure | ~1835 |
| #616 | 12:44 PM | 🔵 | WebSocket module structure | ~912 |
| #615 | 12:43 PM | 🔵 | TypeScript typecheck success | ~986 |
| #614 | 12:43 PM | 🔴 | Conditional Qdrant capabilities | ~4335 |
| #613 | 12:43 PM | 🔵 | TypeScript typecheck results | ~863 |
| #612 | 12:43 PM | 🟣 | Conditional Qdrant capabilities | ~4899 |
| #611 | 12:43 PM | 🔵 | In-Process Worker Architecture | ~4505 |
| #610 | 12:42 PM | 🟠 | Vector-DB optional (Issue #112) | ~1001 |
| #609 | 12:42 PM | 🔵 | Worker Service Architecture | ~3974 |
| #608 | 12:42 PM | 🔵 | Task Service Implementation | ~5206 |

## Key Insights

- **Vector-DB Optional Implementation**: Phase 1 of Issue #112 was completed, making Qdrant capabilities conditional on the `VECTOR_DB` setting. This allows the system to run without a vector database.
- **Worker Capabilities System**: The system decouples abstract capabilities from provider implementations, supporting both legacy and new capabilities. This is a core cross-cutting concern.
- **TypeScript Typecheck Status**: The codebase is largely type-correct, with successful typechecks for 7 out of 8 workspace projects. One project may still have type errors.
- **Worker Architecture**: The worker system includes in-process workers, WebSocket-based communication, and a sophisticated task dispatcher that matches tasks to workers based on capabilities.
- **Configuration Structure**: The `settings.ts` file reveals a comprehensive type-safe settings system supporting defaults, settings files, and environment variables like `VECTOR_DB`, `IN_PROCESS_WORKER`, and `WORKER_AUTH_TOKEN`.
</claude-mem-context>

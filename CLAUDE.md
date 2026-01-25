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
| #92 | 11:39 AM | 🔵 | Tool output handling in task dispatcher | ~824 |
| #91 | 11:38 AM | 🔵 | Observation creation and processing workflow | ~1190 |
| #90 | 11:38 AM | 🔵 | Querying recent observations from SQLite | ~1335 |
| #89 | 11:38 AM | 🔵 | Code block extraction logic | ~1449 |
| #88 | 11:38 AM | 🔵 | Code snippet extraction logic | ~1612 |
| #87 | 11:38 AM | 🔵 | Code snippet references in backend | ~811 |
| #86 | 11:38 AM | 🔵 | TaskDispatcher initialization | ~1155 |
| #85 | 11:38 AM | 🔵 | TaskDispatcher instantiation | ~1162 |
| #84 | 11:38 AM | 🔵 | CodeSnippets feature in backend | ~2136 |
| #83 | 11:38 AM | 🔵 | CodeSnippet files in database | ~886 |
| #82 | 11:37 AM | 🔵 | Database schema analysis | ~1452 |
| #81 | 11:37 AM | 🟣 | Git diff shows significant changes | ~1045 |
| #80 | 11:37 AM | 🔵 | No code snippet references in worker | ~701 |
| #79 | 11:37 AM | 🔵 | Reviewed 15 open issues | ~1567 |
| #78 | 11:37 AM | 🔵 | Issue #257: Code snippets not saving | ~1186 |
| #77 | 11:36 AM | 🔵 | API Health Check confirms status | ~786 |
| #76 | 11:36 AM | 🔴 | Issue created for code snippet bug | ~1406 |
| #75 | 11:36 AM | 🔴 | Resolved N+1 query problem | ~1074 |
| #74 | 11:36 AM | ✅ | Closed issue #202 | ~1826 |
| #73 | 11:36 AM | 🔵 | Git status shows modified files | ~1076 |
| #72 | 11:35 AM | 🔵 | Module type warning in dev script | ~1267 |
| #71 | 11:35 AM | 🔄 | Optimized session enrichment | ~5555 |
| #70 | 11:34 AM | 🔵 | TypeScript typecheck passes | ~962 |
| #69 | 11:34 AM | 🔴 | Fixed SQL query logic | ~5791 |
| #68 | 11:33 AM | 🟠 | Added batch query methods | ~5475 |
| #67 | 11:33 AM | 🔵 | Session data enrichment process | ~1604 |
| #66 | 11:33 AM | 🔵 | ObservationRepository uses MikroORM | ~5522 |
| #65 | 11:33 AM | 🔵 | Repository pattern implementation | ~5228 |
| #64 | 11:32 AM | 🔵 | Batch delete with chunking | ~1969 |
| #63 | 11:32 AM | 🔵 | Session-based data retrieval | ~1006 |

## Key Insights

- **Performance Optimizations**: Resolved N+1 query problem in session listing by adding batch query methods (`getCountsBySessionIds`, `getFileStatsBySessionIds`) and refactoring session enrichment logic.
- **Code Snippets Bug**: Identified issue #257 where code snippets are not being saved, requiring investigation into database tables, worker functionality, and UI components.
- **Database Schema**: Confirmed use of MikroORM with FTS5 for full-text search and discovered missing indexes causing performance degradation.
- **Repository Pattern**: The system uses a repository pattern with interfaces like `IObservationRepository` and `ISessionRepository`, allowing for multiple database backends.
- **Open Issues**: 15 open issues identified, including high-priority bugs (e.g., code snippets, auto-spawning) and feature requests (e.g., endless mode, provider-agnostic architecture).
</claude-mem-context>

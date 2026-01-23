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

### Jan 23, 2026

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #11980 | 11:02 PM | 🟠 | Add CLAUDE.md generation config options | ~5421 |
| #11979 | 11:02 PM | 🟠 | Added CLAUDE.md generation timeout limits | ~5567 |
| #11978 | 11:02 PM | 🔵 | Examining default settings structure | ~2073 |
| #11977 | 11:02 PM | 🔵 | Found CLAUDE.md settings in shared config | ~1362 |
| #11976 | 11:01 PM | 🔵 | Task Service Architecture Overview | ~4418 |
| #11975 | 11:01 PM | 🔵 | Examining Task Dispatcher Implementation | ~4710 |
| #11974 | 11:00 PM | 🔵 | Task queue timeout analysis | ~1143 |
| #11973 | 11:00 PM | 🔵 | Backend has 11 connected workers | ~739 |
| #11972 | 11:00 PM | 🔵 | Task queue processing bottlenecks | ~2031 |
| #11971 | 11:00 PM | 🔵 | Documents table schema analysis | ~2308 |
| #11970 | 10:59 PM | 🔵 | SSE-Writer logs show CLAUDE.md writes | ~1213 |
| #11969 | 10:59 PM | 🔵 | Documents table contains Context7 entries | ~1138 |
| #11968 | 10:59 PM | 🔵 | Multiple CLAUDE.md files across packages | ~1340 |
| #11967 | 10:59 PM | 🔵 | React hooks best practices research | ~1381 |
| #11966 | 10:59 PM | 🔵 | Database query reveals recent observations | ~1539 |
| #11965 | 10:59 PM | 🔵 | Found 13 CLAUDE.md files in packages | ~724 |
| #11964 | 10:59 PM | 🔵 | Express.js library resolution | ~1377 |
| #11963 | 10:59 PM | 🔵 | Backend source files discovered | ~1311 |
| #11962 | 10:58 PM | 🔵 | Express app setup with auth/logging | ~1448 |
| #11961 | 10:58 PM | 🔵 | MikroORM Observation Repository | ~3137 |
| #11960 | 10:58 PM | 🔵 | WebSocket Client Implementation | ~4058 |
| #11959 | 10:58 PM | 🔵 | Worker package structure discovered | ~1671 |
| #11958 | 10:58 PM | 🔵 | No server files in backend package | ~687 |
| #11957 | 10:58 PM | 🔵 | React Hooks Best Practices Research | ~2273 |
| #11956 | 10:58 PM | 🔵 | Express.js middleware patterns research | ~1636 |
| #11955 | 10:58 PM | 🔵 | No server files in backend package | ~697 |
| #11954 | 10:58 PM | 🔵 | No connection files in worker package | ~689 |
| #11953 | 10:58 PM | 🔵 | API Client Structure Analysis | ~3753 |
| #11952 | 10:58 PM | 🔵 | SSE Writer Component Analysis | ~3487 |
| #11951 | 10:58 PM | 🔵 | Shared constants file structure | ~2014 |

## Key Insights

- **Task Processing Issues**: 16 claude-md tasks and 26 observation tasks timed out, with 1 claude-md task stuck in processing. This indicates potential performance bottlenecks or deadlocks in the task queue system.
- **Distributed Documentation**: CLAUDE.md files are distributed across multiple packages (backend, types, shared, worker, hooks, UI), suggesting a modular documentation approach.
- **New Configuration Options**: Added `CLAUDEMD_TASK_TIMEOUT` (default: 10min) and `CLAUDEMD_MAX_SUBDIRS` (default: 5) to control CLAUDE.md generation behavior.
- **Architecture Discoveries**: Key components identified include MikroORM ObservationRepository, WebSocket client for worker communication, and SSE Writer for real-time CLAUDE.md updates.
- **Missing Files**: Some expected files (e.g., server files in backend package) were not found, indicating non-standard naming conventions or alternative implementations.
</claude-mem-context>

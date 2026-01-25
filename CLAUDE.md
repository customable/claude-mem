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
| #15408 | 1:01 AM | 🔵 | Open issues in claude-mem repository | ~1523 |
| #15407 | 1:00 AM | 🟣 | Pushed changes to forgejo remote | ~782 |
| #15406 | 1:00 AM | ✅ | Closed issue #206: Exponential backoff | ~2346 |
| #15405 | 1:00 AM | ✅ | Closed issue #204: Batch operations | ~1693 |
| #15404 | 1:00 AM | ✅ | Closed issue #205: Rate limiting | ~1948 |
| #15403 | 1:00 AM | 🟣 | Git sync completed | ~1481 |
| #15402 | 12:59 AM | 🟠 | Implemented exponential backoff | ~1276 |
| #15401 | 12:59 AM | 🔵 | Git status shows modifications | ~1254 |
| #15400 | 12:59 AM | 🔵 | Missing typecheck scripts | ~825 |
| #15399 | 12:59 AM | 🔵 | Monorepo structure identified | ~937 |
| #15398 | 12:59 AM | 🔵 | Typecheck passes 7/8 packages | ~914 |
| #15397 | 12:58 AM | 🔵 | TypeScript validation results | ~996 |
| #15396 | 12:58 AM | 🔵 | Typecheck passes 7/8 packages | ~954 |
| #15395 | 12:58 AM | 🔵 | TypeScript type checking passed | ~961 |
| #15394 | 12:57 AM | 🟣 | Built types package | ~719 |
| #15393 | 12:57 AM | 🔵 | Found tasks export in types | ~698 |
| #15392 | 12:57 AM | 🔄 | Updated TaskRepository parameter type | ~3262 |
| #15391 | 12:57 AM | 🟣 | Updated TaskRepository import | ~3316 |
| #15390 | 12:57 AM | 🔄 | Refactored TaskStatus parameter type | ~5281 |
| #15389 | 12:57 AM | 🔵 | Examined BaseTask interface | ~965 |
| #15388 | 12:57 AM | 🔄 | Updated repository.ts import | ~5088 |
| #15387 | 12:57 AM | 🟠 | Added TaskUpdateExtras interface | ~3846 |
| #15386 | 12:56 AM | 🔵 | Task status update logic | ~1114 |
| #15385 | 12:56 AM | 🔴 | Fixed type annotation in TaskRepository | ~3367 |
| #15384 | 12:56 AM | 🟠 | Added BaseTask import | ~3289 |
| #15383 | 12:56 AM | 🔵 | SQLite-specific JSON queries | ~957 |
| #15382 | 12:56 AM | 🟣 | Updated TaskStatus signature | ~5182 |
| #15381 | 12:56 AM | 🟣 | Added BaseTask import | ~5074 |
| #15380 | 12:56 AM | 🔵 | Repository interface methods | ~746 |
| #15379 | 12:56 AM | 🔵 | TaskRepository methods | ~966 |

## Key Insights

- **Major Features Implemented**: Exponential backoff for task retries (Issue #206), batch operations (Issue #204), and comprehensive rate limiting (Issue #205) were completed and closed.
- **Type System Refactoring**: Significant changes to task-related types, including the introduction of `TaskUpdateExtras` and refactoring from `Partial<BaseTask>` to more specific types.
- **Monorepo Structure**: Discovered the project's monorepo architecture with 8 workspace packages, where 7 pass TypeScript validation (one remaining issue to resolve).
- **Database Optimizations**: Identified SQLite-specific optimizations in TaskRepository that may require attention for multi-database support.
- **Next Steps**: Verify the remaining TypeScript validation issue, test new features under production-like conditions, and monitor performance improvements.
</claude-mem-context>

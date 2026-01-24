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

### Jan 24

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #14059 | 9:27 PM | 🟠 | Create In-Process Worker Implementation | ~6635 |
| #14058 | 9:26 PM | 🟠 | Added InProcessWorker export to worker package | ~1253 |
| #14057 | 9:26 PM | 🟠 | Added In-Process Worker Configuration Settings | ~5820 |
| #14056 | 9:26 PM | 🔵 | WebSocket Client Implementation Analysis | ~4077 |
| #14055 | 9:26 PM | 🟠 | Implemented file-based worker lock mechanism | ~3268 |
| #14054 | 9:25 PM | 🟠 | Added Worker Lock export to shared utilities | ~1044 |
| #14053 | 9:25 PM | 🟠 | Added new in-process worker settings to NUMBER_KEYS | ~6147 |
| #14052 | 9:25 PM | 🟠 | Added In-Process Worker Configuration Settings | ~6022 |
| #14051 | 9:25 PM | 🔵 | Exploring Settings Management System | ~5330 |
| #14050 | 9:25 PM | 🔵 | Post-tool-use handler for observation extraction | ~2379 |
| #14049 | 9:25 PM | 🟠 | Design Document for In-Process Worker Architecture | ~3573 |
| #14048 | 9:25 PM | 🔵 | Worker package exports structure | ~817 |
| #14047 | 9:24 PM | 🔵 | Worker Capabilities System Overview | ~1341 |
| #14046 | 9:24 PM | 🔵 | Shared utilities structure in claude-mem | ~841 |
| #14045 | 9:24 PM | ✅ | In-Process Worker Architecture Plan for Issue #15 | ~2286 |
| #14044 | 9:24 PM | ✅ | Design in-process worker architecture for claude-mem | ~5607 |
| #14043 | 9:23 PM | 🔵 | Exploring hooks directory structure in the project | ~5510 |
| #14042 | 9:23 PM | 🔵 | Understanding SSE Writer Component | ~3492 |
| #14041 | 9:23 PM | 🔵 | Backend Service Architecture Overview | ~5109 |
| #14040 | 9:23 PM | 🔵 | Worker Process Manager Architecture Review | ~4286 |
| #14039 | 9:23 PM | 🔵 | Worker Capabilities System Overview | ~1349 |
| #14038 | 9:23 PM | 🔵 | Exploring shared TypeScript types in claude-mem | ~1047 |
| #14037 | 9:23 PM | 🔵 | Found two backend-service.ts files in the packages directory | ~765 |
| #14036 | 9:23 PM | 🔵 | WebSocket Protocol Types for Worker-Backend Communication | ~1869 |
| #14035 | 9:22 PM | 🔵 | Exploring Settings Management System | ~5316 |
| #14034 | 9:22 PM | 🔵 | Worker package exports structure | ~893 |
| #14033 | 9:22 PM | 🔵 | Worker Hub WebSocket Management System | ~5207 |
| #14032 | 9:22 PM | 🔵 | Examined hook runner implementation | ~2105 |
| #14031 | 9:22 PM | 🔵 | Worker package structure exploration | ~1301 |
| #14030 | 9:22 PM | 🔵 | Locking mechanisms found in task-dispatcher and bun.lock | ~783 |

## Key Insights

- **In-Process Worker Implementation**: Major progress on Issue #15 with new in-process worker architecture, including file-based locking, configuration settings, and WebSocket communication. This eliminates spawn() calls to address Windows terminal popups and zombie processes.
- **Architecture Decisions**: Finalized design for transforming hook processes into in-process workers with hybrid mode support (spawn/in-process). Key components include file-based mutex for single worker registration and timeout management.
- **System Understanding**: Comprehensive exploration of worker capabilities, WebSocket protocols, backend services, and settings management. Discovered modular architecture with clear separation between worker types, AI agents, and backend communication.
- **Configuration System**: Enhanced settings management with new in-process worker parameters (timeout, idle exit, mode selection) and proper type-safe handling through NUMBER_KEYS array.
- **Next Steps**: Testing the in-process worker implementation, verifying memory tier transitions, and implementing conflict detection for analytics endpoints.
</claude-mem-context>

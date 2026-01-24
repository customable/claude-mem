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

Repository: `customable/claude-mem` auf der lokalen Forgejo-Instanz

<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

### Jan 24

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #14409 | 10:15 PM | 🔴 | Fix null handling in processSessionForSharing | ~5228 |
| #14408 | 10:15 PM | 🔵 | Located hooks.json file in plugin directory | ~692 |
| #14407 | 10:15 PM | 🔵 | Search for agent-related patterns yields minimal results | ~810 |
| #14406 | 10:15 PM | 🔴 | Fix null handling in processObservationForSharing | ~5486 |
| #14405 | 10:15 PM | 🔴 | Filter out null/undefined session IDs in fetchSessions | ~5141 |
| #14404 | 10:15 PM | 🔵 | Documentation on SubagentStart and SubagentStop hooks | ~5377 |
| #14403 | 10:15 PM | 🔵 | Privacy handling in share-service.ts | ~1735 |
| #14402 | 10:15 PM | 🔵 | Discovered pinned field in database schema | ~824 |
| #14401 | 10:15 PM | 🔵 | Exploring SdkSessionRecord interface and its usage | ~4715 |
| #14400 | 10:15 PM | 🔵 | SDKSessionRecord type usage in share-service.ts | ~766 |
| #14399 | 10:15 PM | 🔴 | TypeScript errors in share-service.ts after build | ~1697 |
| #14398 | 10:14 PM | 🔄 | Rename SDKSessionRecord to SdkSessionRecord | ~4879 |
| #14397 | 10:14 PM | 🟠 | Added ShareService to BackendService class | ~4908 |
| #14396 | 10:14 PM | 🔄 | Rename SDKSessionRecord to SdkSessionRecord for consistency | ~2959 |
| #14395 | 10:14 PM | 🔴 | TypeScript error in types package: SDKSessionRecord import | ~1077 |
| #14394 | 10:14 PM | 🟠 | Added ShareRouter to backend service | ~5080 |
| #14393 | 10:13 PM | 🟠 | Adding ShareService to backend-service imports | ~5031 |
| #14392 | 10:13 PM | 🔵 | Backend service routes and static UI serving | ~1336 |
| #14391 | 10:13 PM | 🟠 | Added ShareService initialization to BackendService | ~5129 |
| #14390 | 10:13 PM | 🔵 | Backend service initialization and route registration | ~1771 |
| #14389 | 10:13 PM | 🟠 | Added ShareRouter import to backend service | ~4879 |
| #14388 | 10:13 PM | 🔵 | Backend Service Architecture Overview | ~1916 |
| #14387 | 10:13 PM | 🟠 | Added ShareRouter exports to routes index | ~1515 |
| #14386 | 10:13 PM | 🟠 | Added ShareService exports to services index | ~1369 |
| #14385 | 10:13 PM | 🔵 | Hook Implementation Analysis in packages/hooks | ~3524 |
| #14384 | 10:13 PM | 🟠 | Implemented ShareRouter for memory sharing API | ~5475 |
| #14383 | 10:13 PM | 🔵 | Querying observations from SQLite database | ~2701 |
| #14382 | 10:12 PM | 🔵 | Subagent detection and session context in hooks | ~2277 |
| #14381 | 10:12 PM | 🟠 | Created Share Service for memory sharing functionality | ~6893 |
| #14380 | 10:12 PM | 🔵 | Analyzing session schema and ID patterns in SQLite database | ~6017 |

## Key Insights

- **Share Service Integration**: Major focus on implementing memory sharing functionality with ShareService, ShareRouter, and related components. Multiple bugfixes address null handling and TypeScript errors.
- **Subagent Analysis**: Discovery of minimal subagent implementation despite database fields suggesting potential support. Hook system captures 4 main events but lacks subagent detection.
- **Architecture Patterns**: Backend uses MikroORM with Unit of Work pattern, modular router structure, and dependency injection. TypeScript type safety is maintained across packages.
- **Database Schema**: SQLite database includes session tracking with 15 columns, privacy handling for sharing, and a 'pinned' field for prioritization.
- **Refactoring**: Consistent naming convention improvements (SDKSessionRecord → SdkSessionRecord) and null safety enhancements across session and observation processing.
</claude-mem-context>

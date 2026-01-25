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
| #711 | 12:55 PM | 🔵 | PostToolUse Hook Handler Analysis for Endless Mode | ~3246 |
| #710 | 12:55 PM | 🔵 | ArchivedOutputRepository for Endless Mode storage | ~3169 |
| #709 | 12:55 PM | 🔵 | Archived Output Repository Interface and Unit of Work Pattern | ~1893 |
| #708 | 12:55 PM | 🔵 | Exploring hooks package structure | ~1554 |
| #707 | 12:55 PM | 🔵 | Discovered ArchivedOutput repository interfaces | ~941 |
| #706 | 12:55 PM | 🔵 | ArchivedOutputRecord interface for tool output storage | ~1104 |
| #705 | 12:55 PM | 🔵 | Hook handlers registry structure discovered | ~1486 |
| #704 | 12:55 PM | 🔵 | Discovered CompressionStatus and ArchivedOutputRecord in database types | ~834 |
| #703 | 12:54 PM | 🔵 | Database schema for observation tracking system | ~1593 |
| #702 | 12:54 PM | 🔵 | Located hook-related files in backend | ~705 |
| #701 | 12:54 PM | 🔵 | ArchivedOutput entity structure for Endless Mode | ~1328 |
| #700 | 12:54 PM | 🔵 | Database model types for claude-mem | ~1591 |
| #699 | 12:54 PM | 🔵 | Discovered archived_outputs table structure for Endless Mode | ~1653 |
| #698 | 12:54 PM | 🔵 | Observation Handler Structure and Functionality | ~1866 |
| #697 | 12:54 PM | 🔵 | Found archive-related migration file | ~845 |
| #696 | 12:54 PM | 🔵 | Exploring Hooks Router Implementation | ~3460 |
| #695 | 12:54 PM | 🔵 | Located observation processing file in worker package | ~714 |
| #694 | 12:54 PM | 🔵 | No observation-related files found in backend | ~735 |
| #693 | 12:54 PM | 🔵 | Hook system types and structure discovered | ~1619 |
| #692 | 12:54 PM | 🔵 | Post-tool-use handler processes and sends observations | ~2584 |
| #691 | 12:54 PM | 🔵 | Exploring hooks package file structure | ~1906 |
| #690 | 12:53 PM | 🔵 | TypeScript typecheck passes for 7 of 8 workspace projects | ~961 |
| #689 | 12:53 PM | 🔵 | TypeScript type checking completed successfully | ~844 |
| #688 | 12:53 PM | 🔄 | Building types package | ~750 |
| #687 | 12:53 PM | 🔴 | TypeScript errors in database package due to missing exports | ~1478 |
| #686 | 12:52 PM | 🟢 | Add new migration for archived outputs | ~3075 |
| #685 | 12:52 PM | 🟢 | Added archivedOutputs repository to UnitOfWork | ~3109 |
| #684 | 12:52 PM | 🔵 | Exploring shared TypeScript types in claude-mem | ~1061 |
| #683 | 12:52 PM | 🟢 | Added archivedOutputs repository to UnitOfWork | ~3016 |
| #682 | 12:52 PM | 🟢 | Add ArchivedOutput entity to MikroORM configuration | ~2896 |

## Key Insights

- **Endless Mode Implementation**: Significant progress on Issue #109 (Endless Mode) with comprehensive analysis of `PostToolUse` hook handlers, `ArchivedOutputRepository`, and related database structures for storing full tool outputs.
- **Database Schema Updates**: Added `archived_outputs` table and integrated `ArchivedOutput` entity into MikroORM configuration to support compressed observations and full recall capabilities.
- **Type System Validation**: TypeScript type checking completed successfully for most packages, though one project requires attention due to missing exports in `@claude-mem/types`.
- **Hook System Architecture**: Discovered and documented the hook system's structure, including registry patterns, event handlers, and observation processing workflows.
- **Next Steps**: Focus on resolving TypeScript errors, finalizing database migrations, and implementing the unified WebSocket system to replace hybrid SSE/WebSocket architecture.
</claude-mem-context>

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

### Jan 24, 2026

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #14808 | 11:28 PM | 🔵 | TypeScript typecheck passes for UI package | ~755 |
| #14807 | 11:28 PM | 🔵 | Metadata references found in UI components | ~750 |
| #14806 | 11:27 PM | 🟠 | Add MetadataDisplay component | ~6476 |
| #14805 | 11:27 PM | 🔄 | Replace raw metadata display | ~4735 |
| #14804 | 11:27 PM | 🔵 | Documents View Component Structure | ~4397 |
| #14803 | 11:26 PM | 🔵 | Database contains 22 documents | ~1813 |
| #14802 | 11:26 PM | 🔴 | Fix malformed document titles | ~1134 |
| #14801 | 11:26 PM | 🔵 | Found documents with title "[" | ~1255 |
| #14800 | 11:26 PM | 🔴 | Fix document content parsing | ~1729 |
| #14799 | 11:25 PM | 🔵 | Database document structure | ~2476 |
| #14798 | 11:25 PM | 🟣 | Git rebase and sync | ~1430 |
| #14797 | 11:25 PM | 🟣 | Pushed rebased commits | ~789 |
| #14796 | 11:24 PM | 🟠 | Add CAPSLOCK/urgent prompt detection | ~1291 |
| #14795 | 11:24 PM | 🔵 | Repository Pattern Implementation | ~5251 |
| #14794 | 11:24 PM | 🔵 | Git status for Issue #233 | ~1275 |
| #14793 | 11:24 PM | 🔵 | Monorepo build with CSS warning | ~1501 |
| #14792 | 11:24 PM | 🔵 | Database model types | ~3101 |
| #14791 | 11:23 PM | 🟠 | Add migration for urgent prompt | ~2077 |
| #14790 | 11:23 PM | 🟠 | Add urgent prompt migration | ~3356 |
| #14789 | 11:23 PM | 🟠 | Add isUrgent field support | ~2284 |
| #14788 | 11:23 PM | 🔵 | Database configuration | ~3024 |
| #14787 | 11:23 PM | 🟠 | Add is_urgent field to UserPrompt | ~2218 |
| #14786 | 11:23 PM | 🟠 | Add is_urgent to UserPromptRecord | ~2132 |
| #14785 | 11:23 PM | 🟠 | Add is_urgent field to entity | ~1449 |
| #14784 | 11:23 PM | 🟠 | Add urgent prompt migration | ~3511 |
| #14783 | 11:23 PM | 🔵 | UserPrompt Entity Structure | ~964 |
| #14782 | 11:22 PM | 🔵 | UserPromptRepository implementation | ~1714 |
| #14781 | 11:22 PM | 🔵 | Database migration structure | ~1568 |
| #14780 | 11:22 PM | 🔵 | Recent database migrations | ~928 |
| #14779 | 11:22 PM | 🟠 | Add is_urgent to UserPromptRecord | ~3285 |

## Key Insights

- **Urgent Prompt Detection**: Implemented CAPSLOCK detection (70% uppercase threshold) with `is_urgent` field in UserPrompt entity and migrations.
- **Document Fixes**: Resolved malformed document titles and content parsing issues in the database.
- **Metadata Display**: Added `MetadataDisplay` component to replace raw JSON metadata rendering in UI.
- **Database Schema**: Discovered repository pattern and 14 migrations, including recent additions for urgent prompts.
- **Build Status**: Monorepo build successful with minor CSS warnings; TypeScript typecheck passes for UI package.
</claude-mem-context>

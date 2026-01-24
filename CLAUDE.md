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
| #14655 | 10:50 PM | 🟣 | Pushed commits to remote | ~770 |
| #14654 | 10:49 PM | 🟣 | Rebased onto forgejo/main | ~1012 |
| #14653 | 10:49 PM | 🔵 | Git status: diverged branches | ~897 |
| #14652 | 10:49 PM | 🔵 | Uncommitted CLAUDE.md changes | ~916 |
| #14651 | 10:49 PM | 🟣 | Committed CLAUDE.md updates | ~809 |
| #14650 | 10:49 PM | 🔵 | Modified CLAUDE.md files | ~884 |
| #14649 | 10:49 PM | 🟠 | Implemented PreCompact hook | ~1080 |
| #14648 | 10:49 PM | 🟣 | Staged files for Issue #73 | ~834 |
| #14647 | 10:48 PM | 🟠 | Show file details in session | ~855 |
| #14646 | 10:48 PM | 🟠 | Process/memory leak prevention | ~1096 |
| #14645 | 10:48 PM | 🟣 | Staged files for Issue #94 | ~705 |
| #14644 | 10:48 PM | 🟣 | Staged files for Issue #101 | ~888 |
| #14643 | 10:48 PM | 🔵 | Multiple modified files | ~1392 |
| #14642 | 10:48 PM | 🔵 | Issue #101 changes analysis | ~1002 |
| #14641 | 10:48 PM | ✅ | TypeScript check passed | ~834 |
| #14640 | 10:47 PM | 🟠 | Added 'pre-compact' event | ~3345 |
| #14639 | 10:47 PM | 🔵 | Plugin entry point structure | ~1363 |
| #14638 | 10:46 PM | ✅ | Task 3 completed | ~702 |
| #14637 | 10:46 PM | 🔄 | Refactored event broadcasting | ~4669 |
| #14636 | 10:46 PM | 🟠 | Added pre-compact event docs | ~3203 |
| #14635 | 10:46 PM | 🟠 | Added pre-compact event map | ~3486 |
| #14634 | 10:46 PM | 🔵 | EVENT_MAP discovery | ~1357 |
| #14633 | 10:45 PM | 🔵 | Pre-compact hook found | ~1669 |
| #14632 | 10:45 PM | 🔵 | Located hooks.json | ~736 |
| #14631 | 10:45 PM | 🔵 | Plugin CLI structure | ~1607 |
| #14629 | 10:45 PM | 🔵 | Located worker-service.cjs | ~719 |
| #14627 | 10:45 PM | 🟠 | Added PreCompact hook | ~2634 |
| #14626 | 10:45 PM | 🔵 | SSE Broadcaster Service | ~2177 |
| #14624 | 10:45 PM | 🔵 | Hook system configuration | ~1423 |
| #14623 | 10:45 PM | 🔵 | SSE Broadcaster structure | ~1619 |

## Key Insights

- **PreCompact Hook Implementation**: Successfully added a new PreCompact hook feature with backend endpoints, SSE events, and handler registration (Issue #73). This preserves context before memory compaction.
- **File Tracking in Sessions**: Enhanced session view to display file details (Issue #94), aggregating files_read and files_modified from observations in the backend and UI.
- **Cleanup Service**: Implemented a comprehensive cleanup service (Issue #101) to prevent process/memory leaks, with configurable settings, API endpoints, and automatic cleanup capabilities.
- **Event System Enhancement**: Refactored event broadcasting logic and added new event mappings (e.g., 'pre-compact') to extend the plugin's event-driven architecture.
- **Repository Pattern**: Discovered and utilized the repository pattern for data access, ensuring consistent and maintainable data handling across the project.
</claude-mem-context>

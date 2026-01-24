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

### Jan 24, 2026

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #13084 | 6:04 PM | 🟠 | Add Git worktree support to UpdateSessionInput | ~5394 |
| #13083 | 6:04 PM | 🟠 | Add repoPath field to CreateObservationInput | ~5344 |
| #13082 | 6:04 PM | 🟠 | Add Git worktree support to CreateSessionInput | ~5391 |
| #13081 | 6:04 PM | 🔵 | Session Service Architecture Analysis | ~3537 |
| #13080 | 6:03 PM | 🔵 | Repository Pattern Implementation | ~5096 |
| #13079 | 6:03 PM | 🔵 | Discovered TypeScript files in packages/types/src | ~890 |
| #13078 | 6:03 PM | 🔵 | Session Service Architecture Analysis | ~3546 |
| #13077 | 6:03 PM | 🔄 | Added safe repository info retrieval | ~3587 |
| #13076 | 6:03 PM | 🟠 | Added Git worktree support to session start | ~3333 |
| #13075 | 6:02 PM | 🔵 | UserPromptSubmit handler initializes sessions | ~1202 |
| #13074 | 6:02 PM | 🔵 | Located hooks-related route file | ~685 |
| #13073 | 6:02 PM | 🟠 | Added Git repository info collection | ~2165 |
| #13072 | 6:02 PM | 🟠 | Added getRepoInfo import to handler | ~1527 |
| #13071 | 6:02 PM | 🟠 | Add repository info to SSE writer | ~3381 |
| #13070 | 6:02 PM | 🟠 | Add Git repository info support | ~4813 |
| #13069 | 6:02 PM | 🔵 | Session Start Handler Analysis | ~2945 |
| #13068 | 6:01 PM | 🟠 | Add getRepoInfo import and RepoInfo type | ~3275 |
| #13067 | 6:01 PM | 🔵 | Examining Session Entity Structure | ~1139 |
| #13066 | 6:01 PM | 🟠 | Added repository tracking fields | ~1654 |
| #13065 | 6:00 PM | 🟠 | Added indexed repo_path field | ~1582 |
| #13064 | 6:00 PM | 🔵 | Observation Entity Structure Analysis | ~1373 |
| #13063 | 6:00 PM | 🟠 | Add Git worktree support migration | ~2802 |
| #13062 | 6:00 PM | 🔵 | Database configuration structure | ~2120 |
| #13061 | 6:00 PM | 🟠 | Add Git Worktree Support Migration | ~2703 |
| #13060 | 6:00 PM | 🔵 | Database migration files discovered | ~1153 |
| #13059 | 5:59 PM | 🟠 | Add new migration for Git worktree | ~1696 |
| #13058 | 5:59 PM | 🔵 | Migration files structure discovered | ~1060 |
| #13057 | 5:59 PM | 🟠 | Add Git Worktree Support Migration | ~2061 |
| #13056 | 5:59 PM | 🔵 | Migration adds working_directory | ~1017 |
| #13055 | 5:59 PM | 🟠 | Added Git Utilities export | ~986 |

## Key Insights

- **Git Worktree Support Added**: Major feature implementation across multiple components (SessionInput, ObservationInput, database migrations, and handlers) to support Git worktree functionality.
- **Repository Context Tracking**: Enhanced session and observation entities with repository path, branch, and worktree status tracking.
- **Database Schema Evolution**: New migration added to support Git worktree features in both `sdk_sessions` and `observations` tables.
- **Architecture Analysis**: Detailed exploration of session service, repository pattern, and database configuration revealing core project structure.
- **Safe Repository Handling**: Added error handling and logging for repository information retrieval in session initialization.
</claude-mem-context>

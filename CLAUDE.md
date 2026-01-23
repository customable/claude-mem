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

### Jan 23

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #11881 | 10:39 PM | 🔵 | Observation distribution across directories | ~1113 |
| #11880 | 10:39 PM | 🔵 | Multiple CLAUDE.md files found across project | ~1074 |
| #11879 | 10:38 PM | 🔵 | Located all CLAUDE.md files in repository | ~1176 |
| #11878 | 10:38 PM | 🔵 | Dashboard component structure and functionality | ~2883 |
| #11877 | 10:38 PM | 🔵 | Session Start Handler Implementation Analysis | ~2947 |
| #11876 | 10:38 PM | 🔵 | Explored settings management system | ~5014 |
| #11875 | 10:38 PM | 🔵 | Examining Summary Entity Structure | ~1059 |
| #11874 | 10:38 PM | 🔵 | SSE Hook Implementation Analysis | ~2779 |
| #11873 | 10:38 PM | 🔵 | Database model types for claude-mem | ~5210 |
| #11872 | 10:38 PM | 🔵 | StatusBar component uses SSE for monitoring | ~1367 |
| #11871 | 10:38 PM | 🔵 | Checking current session and pending tasks | ~1576 |
| #11870 | 10:38 PM | 🔵 | Task queue status and CLAUDE.md files | ~1326 |
| #11869 | 10:37 PM | 🔵 | Located all CLAUDE.md files in repository | ~917 |
| #11868 | 10:37 PM | 🔵 | Inspecting recent claude-md task history | ~1184 |
| #11867 | 10:37 PM | 🔵 | SSE-Writer logs reveal directory mismatch errors | ~1649 |
| #11866 | 10:37 PM | 🔵 | Analysis of CLAUDE.md files and observations | ~1661 |
| #11865 | 10:37 PM | 🔵 | Task Service Architecture Overview | ~4418 |
| #11864 | 10:37 PM | 🔵 | Logger module structure and capabilities | ~2823 |
| #11863 | 10:37 PM | 🔵 | App.tsx structure and navigation system | ~2313 |
| #11862 | 10:37 PM | 🔵 | Exploring hooks package exports | ~991 |
| #11861 | 10:36 PM | 🔵 | Task system architecture for Backend-Worker | ~2514 |
| #11860 | 10:36 PM | 🔵 | Examining Session Entity Structure | ~1089 |
| #11859 | 10:36 PM | 🔵 | Session Service Architecture Analysis | ~4510 |
| #11858 | 10:36 PM | 🔵 | Observation Entity Structure Analysis | ~1397 |
| #11857 | 10:36 PM | 🔵 | CLAUDE.md handler documentation reviewed | ~1162 |
| #11856 | 10:36 PM | 🔵 | Reviewed CLAUDE.md for recent activity | ~1432 |
| #11855 | 10:36 PM | 🔵 | CLAUDE.md files exist in worker package | ~1241 |
| #11854 | 10:35 PM | 🔵 | Observation Handler Architecture Review | ~1860 |
| #11853 | 10:35 PM | 🔵 | Summarize Handler Implementation Review | ~1547 |
| #11852 | 10:35 PM | 🔵 | Reviewed existing CLAUDE.md files and worker | ~1404 |

## Key Insights

- **Distributed Documentation**: Multiple CLAUDE.md files exist across directories (worker, hooks, backend, etc.), indicating a modular documentation approach.
- **SSE Integration**: The system heavily relies on Server-Sent Events (SSE) for real-time updates, used in components like StatusBar and Dashboard.
- **Task System**: A priority-based task queue system manages observations, summarization, and documentation generation with retry logic.
- **Directory Mismatch Issue**: SSE-Writer logs show repeated "Directory mismatch" errors, requiring attention for consistent CLAUDE.md file generation.
- **AI-Driven Processing**: Handlers (observation, summarize, claude-md) use AI agents to process data and generate documentation automatically.
</claude-mem-context>

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

### Jan 25

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #956 | 1:54 PM | 🟣 | Update capability requirement in test | ~4704 |
| #955 | 1:53 PM | 🟣 | Update fallback capabilities in test | ~5226 |
| #954 | 1:53 PM | 🔵 | Task creation test with priority/retries | ~983 |
| #953 | 1:53 PM | 🔄 | Remove compressedObservation relation | ~1723 |
| #952 | 1:53 PM | 🔵 | Fallback capabilities pattern found | ~946 |
| #951 | 1:52 PM | 🔵 | Worker Capabilities System Architecture | ~2722 |
| #950 | 1:52 PM | 🟣 | Update test capability from 'llm' | ~5302 |
| #949 | 1:51 PM | 🟠 | Add compressed_observation_id field | ~1698 |
| #948 | 1:51 PM | 🔄 | Remove unused imports from entity | ~1682 |
| #947 | 1:51 PM | 🔴 | TypeScript errors in database package | ~1752 |
| #946 | 1:51 PM | 🔵 | ArchivedOutputRepository discovered | ~3156 |
| #945 | 1:51 PM | 🔵 | WorkerCapability type definition found | ~1409 |
| #944 | 1:50 PM | 🔵 | Test suite passes with migrations | ~1785 |
| #943 | 1:49 PM | 🔵 | Database tests passing | ~2855 |
| #942 | 1:49 PM | 🔵 | Database tests running with migrations | ~3341 |
| #941 | 1:49 PM | 🔴 | Database tests failing (duplicate fields) | ~3511 |
| #940 | 1:48 PM | 🔄 | Add explicit field name/index | ~1573 |
| #939 | 1:48 PM | 🔄 | Remove redundant field | ~1675 |
| #938 | 1:47 PM | 🔵 | ArchivedOutput entity structure | ~1414 |
| #937 | 1:47 PM | 🟠 | Add SWC plugin to Vite config | ~1735 |
| #936 | 1:47 PM | 🟠 | Install SWC plugin for Vitest | ~1125 |
| #935 | 1:46 PM | 🔵 | Project structure analysis | ~1498 |
| #934 | 1:46 PM | 🔵 | Database package TypeScript config | ~907 |
| #933 | 1:46 PM | 🔵 | Session entity structure | ~1324 |
| #932 | 1:46 PM | 🔵 | TypeScript config discovered | ~981 |
| #931 | 1:46 PM | 🔵 | Test files in shared package | ~871 |
| #930 | 1:46 PM | 🔵 | Vitest configuration analysis | ~1048 |
| #929 | 1:46 PM | 🔵 | Database config structure | ~2481 |
| #928 | 1:46 PM | 🔴 | Database tests failing (decorators) | ~3208 |
| #927 | 1:46 PM | 🔵 | No database config files found | ~708 |

## Key Insights

- **Capability System Refinement**: Major updates to worker capabilities system, moving from generic 'llm' to specific capability types ('observation:mistral', 'summarize:mistral') with fallback patterns
- **Database Schema Evolution**: Significant changes to ArchivedOutput entity (field additions/removals, indexing) for Endless Mode storage
- **TypeScript Migration Issues**: Multiple test failures due to decorator metadata and type mismatches during TypeScript migration
- **Build System Enhancements**: Added SWC plugin support for Vite/Vitest to improve TypeScript decorator handling
- **Test Suite Stability**: Database tests now passing after migration fixes, with 195 tests across 8 files succeeding
</claude-mem-context>

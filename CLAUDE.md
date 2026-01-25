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
| #285 | 12:03 PM | 🔵 | Reviewing recent commit history | ~1109 |
| #284 | 12:03 PM | ✅ | Close issue #258: Interface-based metrics | ~1564 |
| #283 | 12:03 PM | 🟣 | Task 4 status updated to completed | ~704 |
| #282 | 12:03 PM | 🔄 | Interface-based metrics refactoring | ~1171 |
| #281 | 12:03 PM | 🔵 | TypeScript typecheck passes for 7/8 projects | ~983 |
| #280 | 12:03 PM | 🔄 | Refactor metrics to interface-based config | ~5842 |
| #279 | 12:02 PM | 🟠 | Added centralized metrics configuration | ~2890 |
| #278 | 12:02 PM | 🟠 | Added metrics type definitions | ~1367 |
| #277 | 12:02 PM | 🔵 | Exploring shared TypeScript types | ~1065 |
| #276 | 12:02 PM | 🟠 | Added metrics types export | ~1215 |
| #275 | 12:02 PM | 🔵 | Issue #258: Metrics refactor proposal | ~1598 |
| #274 | 12:02 PM | 🟠 | Issue #260: TodoList & PlanMode feature | ~5964 |
| #273 | 12:01 PM | 🔵 | Discovered TypeScript files in packages/types | ~1041 |
| #272 | 12:01 PM | 🔵 | Prometheus metrics implementation | ~2166 |
| #271 | 12:01 PM | ✅ | Closed issue #259: Package structure review | ~1331 |
| #270 | 12:01 PM | 🟠 | Added package structure documentation | ~4272 |
| #269 | 12:01 PM | 🟣 | Task 3 status updated to completed | ~702 |
| #268 | 12:01 PM | 🟣 | Task 4 status updated to "in_progress" | ~710 |
| #267 | 12:01 PM | 🟠 | Add package structure documentation | ~845 |
| #266 | 12:01 PM | 🔵 | Hook input structure documentation | ~2761 |
| #265 | 12:01 PM | 🔵 | Internal dependency structure analysis | ~1084 |
| #264 | 12:01 PM | 🔵 | Reviewed recent development activity log | ~2215 |
| #263 | 12:01 PM | 🔵 | Claude Code data capture exploration | ~3919 |
| #262 | 12:00 PM | 🔵 | Environment variables in hooks package | ~1761 |
| #261 | 12:00 PM | 🟣 | Updated README.md roadmap section | ~4695 |
| #260 | 12:00 PM | 🔵 | Subagent event tracking in session-service | ~1205 |
| #259 | 12:00 PM | 🔵 | Subagent functionality across files | ~1029 |
| #258 | 12:00 PM | 🔵 | No package READMEs found | ~857 |
| #257 | 12:00 PM | 🔵 | Searching for task-related protocol methods | ~2437 |
| #256 | 12:00 PM | 🔵 | Issue #259: Package structure review | ~1338 |

## Key Insights

- **Metrics Refactoring**: Major refactoring of Prometheus metrics to use interface-based configuration (issues #258, #280, #282) for improved maintainability and type safety.
- **Package Structure Documentation**: Added comprehensive documentation for the monorepo's 7-package architecture (issue #259, #270, #271) with dependency graphs and placement guidelines.
- **Task Management Progress**: Multiple tasks updated to "completed" status (#283, #269) indicating active progress tracking.
- **Feature Development**: New features added for TodoList/PlanMode (#274) and centralized metrics configuration (#279, #278).
- **Type Safety**: TypeScript typecheck passes for 7/8 projects (#281) with ongoing type definition improvements (#278, #276).
</claude-mem-context>

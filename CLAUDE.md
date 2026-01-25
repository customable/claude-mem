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
| #275 | 12:02 PM | 🔵 | Refactor metrics to interface-based config | ~1598 |
| #274 | 12:02 PM | 🟠 | TodoList & PlanMode feature issue created | ~5964 |
| #273 | 12:01 PM | 🔵 | Discovered TypeScript files in packages/types | ~1041 |
| #272 | 12:01 PM | 🔵 | Prometheus metrics implementation found | ~2166 |
| #271 | 12:01 PM | ✅ | Closed package structure review issue | ~1331 |
| #270 | 12:01 PM | 🟠 | Added package structure documentation | ~4272 |
| #269 | 12:01 PM | 🟣 | Task 3 status updated to completed | ~702 |
| #268 | 12:01 PM | 🟣 | Task 4 status updated to in_progress | ~710 |
| #267 | 12:01 PM | 🟠 | Package structure documentation added | ~845 |
| #266 | 12:01 PM | 🔵 | Hook input structure documentation found | ~2761 |
| #265 | 12:01 PM | 🔵 | Internal dependency structure analyzed | ~1084 |
| #264 | 12:01 PM | 🔵 | Reviewed recent development activity log | ~2215 |
| #263 | 12:01 PM | 🔵 | Claude Code data capture exploration | ~3919 |
| #262 | 12:00 PM | 🔵 | Environment variables in hooks package | ~1761 |
| #261 | 12:00 PM | 🟣 | Updated README.md roadmap section | ~4695 |
| #260 | 12:00 PM | 🔵 | Subagent event tracking discovered | ~1205 |
| #259 | 12:00 PM | 🔵 | Subagent functionality across files | ~1029 |
| #258 | 12:00 PM | 🔵 | No package READMEs found | ~857 |
| #257 | 12:00 PM | 🔵 | Task-related protocol methods searched | ~2437 |
| #256 | 12:00 PM | 🔵 | Package structure documentation issue | ~1338 |
| #255 | 12:00 PM | 🔵 | Task system architecture discovered | ~2977 |
| #254 | 12:00 PM | 🟣 | Task 3 status updated to in_progress | ~695 |
| #253 | 12:00 PM | 🔵 | Worker lifecycle patterns discovered | ~1957 |
| #252 | 12:00 PM | 🟣 | Closed documentation update issue | ~1071 |
| #251 | 12:00 PM | 🟣 | Task 2 status updated to completed | ~700 |
| #250 | 12:00 PM | 🔵 | MCP Server Implementation Analysis | ~3023 |
| #249 | 12:00 PM | 🟣 | Updated README with database schema | ~985 |
| #248 | 12:00 PM | 🔵 | Hook Runner Architecture discovered | ~2148 |
| #247 | 12:00 PM | 🔵 | Subagent Stop Hook Handler found | ~1265 |
| #246 | 11:59 AM | 🔵 | Plugin entry point architecture found | ~3044 |

## Key Insights

- **Architecture Documentation**: Comprehensive package structure documentation was added to CLAUDE.md, addressing the need for clear dependency management and code placement guidelines.
- **Task Management**: Multiple tasks were updated (completed/in_progress), indicating active development progress.
- **Metrics Refactoring**: A proposal to refactor Prometheus metrics to interface-based configuration was discovered, aiming to improve maintainability.
- **Feature Development**: New issues were created for TodoList & PlanMode features, suggesting upcoming UI enhancements.
- **Subagent System**: Extensive subagent functionality was found across multiple files, indicating it's a core feature with lifecycle tracking.
</claude-mem-context>

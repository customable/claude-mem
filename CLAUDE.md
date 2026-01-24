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
| #14209 | 9:54 PM | 🟠 | Add ProjectSettingsRecord and ProjectSettingsData interfaces | ~3708 |
| #14208 | 9:54 PM | 🟠 | Add new migration for ProjectSettings table | ~3355 |
| #14207 | 9:54 PM | 🟠 | Add projectSettings repository to repository interfaces | ~5195 |
| #14206 | 9:54 PM | 🟠 | Added Project Settings Repository Interface | ~5589 |
| #14205 | 9:53 PM | 🟠 | Added ProjectSettingsRecord to repository imports | ~5206 |
| #14204 | 9:53 PM | 🟠 | Created ProjectSettings entity for project metadata storage | ~1526 |
| #14203 | 9:53 PM | 🟠 | Add ProjectSettings entity export to database entities index | ~1246 |
| #14202 | 9:53 PM | 🟠 | Add ProjectSettings entity to MikroORM configuration | ~3050 |
| #14201 | 9:53 PM | 🟠 | Add ProjectSettings entity to MikroORM configuration | ~3198 |
| #14200 | 9:53 PM | 🟠 | Add new migration for ProjectSettings table | ~3521 |
| #14199 | 9:53 PM | 🟠 | Add new migration export for ProjectSettings table | ~1985 |
| #14198 | 9:52 PM | 🟠 | Create project_settings table migration | ~1574 |
| #14197 | 9:52 PM | 🔄 | Task 7 status updated to "in_progress" | ~699 |
| #14196 | 9:52 PM | 🔄 | Task 3 status updated to completed | ~682 |
| #14195 | 9:51 PM | 🟠 | Implement memory templates for observation types | ~1131 |
| #14194 | 9:51 PM | 🔄 | Successful monorepo build with CSS warning | ~1415 |
| #14193 | 9:51 PM | 🟠 | Add observationTemplates repository to UnitOfWork | ~2713 |
| #14192 | 9:51 PM | 🟠 | Added observationTemplates to DataRouter initialization | ~4955 |
| #14191 | 9:50 PM | 🟠 | Added Observation Template API Endpoints | ~5977 |
| #14190 | 9:50 PM | 🟠 | Add observationTemplates repository to DataRouter dependencies | ~4924 |
| #14189 | 9:50 PM | 🔴 | Initialize observationTemplates repository in constructor | ~2723 |
| #14188 | 9:50 PM | 🟠 | Added Observation Templates API endpoints | ~5212 |
| #14187 | 9:50 PM | 🟠 | Added IObservationTemplateRepository to data routes import | ~4973 |
| #14186 | 9:50 PM | 🟠 | Add ObservationTemplateRepository import to UnitOfWork | ~2677 |
| #14185 | 9:49 PM | 🟠 | Add observationTemplates repository to UnitOfWork | ~2538 |
| #14184 | 9:49 PM | 🟠 | Implemented ObservationTemplateRepository for MikroORM | ~4048 |
| #14183 | 9:49 PM | 🟠 | Add ObservationTemplateRepository export to MikroORM repositories | ~1326 |
| #14182 | 9:49 PM | 🟠 | Added Observation Template Repository Interface | ~5753 |
| #14181 | 9:48 PM | 🟠 | Added observationTemplates repository to types | ~5099 |
| #14180 | 9:48 PM | 🟠 | Add ObservationTemplateRecord to repository imports | ~5209 |

## Key Insights

- **Project Settings Infrastructure**: A comprehensive system for project-specific settings was implemented, including database tables, entities, repositories, and interfaces. This enables granular project configuration and metadata storage.
- **Observation Templates**: A new feature for customizable observation templates was added, supporting different types (Bug Fix, Feature, Decision, etc.) with full CRUD API endpoints and repository integration.
- **Task Management**: Active progress on task management with status updates (Task 3 completed, Task 7 in progress), indicating ongoing project tracking.
- **Build System**: Successful monorepo build with minor CSS warnings, confirming the project's build pipeline is functional.
- **Database Schema Evolution**: Multiple migrations and entity additions show significant expansion of the database schema to support new features.
</claude-mem-context>

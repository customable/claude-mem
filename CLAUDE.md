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
| #14159 | 9:44 PM | 🟠 | Added observation link management endpoints | ~6003 |
| #14158 | 9:44 PM | 🟠 | Added Observation Links API endpoints | ~5059 |
| #14157 | 9:44 PM | 🔵 | API endpoints for observations, summaries, and tasks | ~1303 |
| #14156 | 9:44 PM | 🟠 | Add observationLinks to DataRouterDeps interface | ~5147 |
| #14155 | 9:44 PM | 🟠 | Add ObservationLinkRepository to Unit of Work | ~2558 |
| #14154 | 9:43 PM | 🟠 | Added ObservationLinkRepository and ObservationLinkType imports | ~5088 |
| #14153 | 9:43 PM | 🟠 | Added observationLinks repository to MikroOrmUnitOfWork | ~2581 |
| #14152 | 9:43 PM | 🟠 | Added observationLinks repository to MikroOrmUnitOfWork | ~3449 |
| #14151 | 9:43 PM | 🟠 | Added observationLinks repository to Unit of Work | ~3482 |
| #14150 | 9:43 PM | 🔵 | MikroORM Unit of Work Implementation Analysis | ~2210 |
| #14149 | 9:43 PM | 🟠 | Added ObservationLinkRepository export to MikroORM repositories | ~1282 |
| #14148 | 9:42 PM | 🔵 | MikroORM Repository Structure | ~1184 |
| #14147 | 9:42 PM | 🟠 | Added Observation Link Repository Interface | ~5707 |
| #14146 | 9:42 PM | 🟠 | Created ObservationLinkRepository for MikroORM | ~3808 |
| #14145 | 9:42 PM | 🟠 | Add ObservationLink entity to MikroORM configuration | ~3342 |
| #14144 | 9:42 PM | 🟠 | Add observationLinks repository interface | ~5103 |
| #14143 | 9:42 PM | 🔵 | Repository interfaces and Unit of Work pattern discovered | ~1147 |
| #14142 | 9:42 PM | 🔵 | Repository interface methods and Unit of Work pattern discovered | ~1373 |
| #14141 | 9:41 PM | 🟠 | Create ObservationLink Entity for Database | ~1443 |
| #14140 | 9:41 PM | 🟠 | Add ObservationLink entity to MikroORM configuration | ~3233 |
| #14139 | 9:41 PM | 🟠 | Add new migration for observation links table | ~3157 |
| #14138 | 9:41 PM | 🟠 | Add ObservationLinkRecord and ObservationLinkType to repository imports | ~5229 |
| #14137 | 9:41 PM | 🟠 | Added observation link types and database record | ~3208 |
| #14136 | 9:41 PM | 🟠 | Add ObservationLink entity export to database entities index | ~1186 |
| #14135 | 9:41 PM | 🟠 | Add new migration export for ObservationLinksTable | ~1950 |
| #14134 | 9:41 PM | 🔵 | Database migration structure discovered | ~1521 |
| #14133 | 9:41 PM | 🔵 | Database entities structure overview | ~1068 |
| #14132 | 9:40 PM | 🟠 | Add new migration for observation links table | ~3299 |
| #14131 | 9:40 PM | 🟠 | Create observation_links table migration | ~1745 |
| #14130 | 9:40 PM | 🟠 | Implement memory importance scoring feature | ~1084 |

## Key Insights

- **Observation Linking Feature**: A comprehensive system for linking observations was implemented, including database schema (ObservationLink entity), repository interfaces, API endpoints, and MikroORM integration. This enables tracking relationships between observations with 8 different link types (related, depends_on, blocks, etc.).
- **Database Expansion**: New `observation_links` table was added with proper foreign keys, indexes, and a unique constraint to prevent duplicate links. This extends the data model to support observation relationships.
- **API Layer Growth**: Three new API endpoints were added for managing observation links (create, retrieve, delete), following RESTful patterns with validation to prevent self-links and duplicates.
- **Unit of Work Integration**: The MikroORM Unit of Work pattern was extended to include observation link functionality, maintaining transaction consistency across operations.
- **Memory Tiering**: Memory importance scoring was implemented with pinned and importance_boost fields, suggesting a move toward more sophisticated memory management capabilities.
</claude-mem-context>

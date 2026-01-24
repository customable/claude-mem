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
| #14089 | 9:34 PM | 🔵 | No memory-related patterns found | ~708 |
| #14088 | 9:34 PM | 🟠 | Plugin system task created | ~796 |
| #14087 | 9:34 PM | 🟠 | AI suggestions feature task | ~791 |
| #14086 | 9:33 PM | 🔵 | Memory tiering files identified | ~1298 |
| #14085 | 9:33 PM | 🔵 | Memory links feature proposal | ~985 |
| #14084 | 9:33 PM | 🔵 | AI suggestions feature proposal | ~1009 |
| #14083 | 9:32 PM | ✅ | Closed in-process worker issue | ~2837 |
| #14082 | 9:32 PM | 🔵 | No uncommitted changes | ~688 |
| #14081 | 9:32 PM | 🟠 | In-process worker implemented | ~1198 |
| #14080 | 9:32 PM | 🔵 | Git status shows changes | ~1364 |
| #14079 | 9:32 PM | 🟠 | In-process worker capability | ~1243 |
| #14078 | 9:32 PM | 🔵 | Clean repository state | ~679 |
| #14077 | 9:31 PM | 🟣 | Files staged for commit | ~765 |
| #14076 | 9:31 PM | 🔵 | Typecheck passes 7/8 projects | ~907 |
| #14075 | 9:31 PM | 🔴 | Removed redundant settings load | ~2877 |
| #14074 | 9:31 PM | 🔵 | TypeScript validation results | ~978 |
| #14073 | 9:30 PM | 🟣 | Monorepo build successful | ~1393 |
| #14072 | 9:30 PM | 🔵 | Dependencies up to date | ~824 |
| #14071 | 9:29 PM | 🔵 | Worker lifecycle discovered | ~1049 |
| #14070 | 9:29 PM | 🔴 | Added type annotation | ~2462 |
| #14069 | 9:29 PM | 🔵 | Post-tool-use handler logic | ~2590 |
| #14068 | 9:29 PM | 🟠 | Added worker dependency | ~1505 |
| #14067 | 9:29 PM | 🔵 | Worker package config | ~1164 |
| #14066 | 9:29 PM | 🔵 | Hooks package config | ~1095 |
| #14065 | 9:29 PM | 🔵 | TypeScript validation | ~963 |
| #14064 | 9:28 PM | 🟠 | Worker transition logic | ~3485 |
| #14063 | 9:28 PM | 🔵 | TypeScript validation | ~964 |
| #14062 | 9:28 PM | 🟠 | Added WorkerMode type | ~1749 |
| #14061 | 9:28 PM | 🟠 | Worker Lifecycle Manager | ~3733 |
| #14060 | 9:27 PM | 🟠 | Worker transition added | ~2807 |

## Key Insights

- **Architectural Shift**: Major transition from spawn-based to in-process worker architecture completed (Issue #15 closed), addressing Windows compatibility and performance issues.
- **Worker System**: Implemented WorkerLifecycleManager with file-based mutex locks and three modes (spawn/in-process/hybrid).
- **Feature Pipeline**: New tasks created for plugin system and AI-powered suggestions, indicating future development direction.
- **Code Quality**: Active type safety improvements (type annotations) and successful TypeScript validation across most projects.
- **Memory Features**: Discovery of memory tiering implementation and proposals for knowledge graph/backlink features.
</claude-mem-context>

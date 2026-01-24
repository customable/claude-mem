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
| #13722 | 8:15 PM | 🟣 | Pushed updates to PR #222 for agent registry | ~913 |
| #13721 | 8:15 PM | 🟣 | Reset CLAUDE.md and drop stash | ~751 |
| #13720 | 8:15 PM | 🟣 | Accept main version of CLAUDE.md during merge | ~728 |
| #13719 | 8:15 PM | 🟣 | Merge main into feat/171-agent-registry | ~903 |
| #13718 | 8:15 PM | 🟣 | Switched to feat/171-agent-registry branch | ~826 |
| #13717 | 8:15 PM | 🟣 | Pushed merged branch to update PR | ~805 |
| #13716 | 8:14 PM | 🟠 | Implement agent provider registry pattern | ~1223 |
| #13715 | 8:14 PM | 🔵 | TypeScript typecheck passes for 7 of 8 projects | ~977 |
| #13714 | 8:13 PM | 🔵 | TypeScript typecheck passes for 7 of 8 projects | ~903 |
| #13713 | 8:13 PM | 🟣 | Rebuild types package | ~753 |
| #13712 | 8:13 PM | 🔵 | Identified key interfaces in repository.ts | ~877 |
| #13711 | 8:13 PM | 🔵 | Identified repository-related types in types | ~763 |
| #13710 | 8:13 PM | 🔵 | Exploring shared TypeScript types structure | ~1046 |
| #13709 | 8:12 PM | 🔴 | TypeScript errors in CodeSnippetRepository | ~1334 |
| #13708 | 8:12 PM | 🟣 | Merge main into feat/16-learning-dashboard | ~904 |
| #13707 | 8:12 PM | 🟣 | Staging resolved conflict files | ~801 |
| #13706 | 8:12 PM | 🔴 | Resolved merge conflict in unit-of-work.ts | ~2935 |
| #13705 | 8:12 PM | 🟠 | Added code snippet API endpoints to client | ~7613 |
| #13704 | 8:12 PM | 🔵 | Git merge conflict in unit-of-work.ts | ~2205 |
| #13703 | 8:12 PM | 🔵 | Merge conflict in IUnitOfWork interface | ~1150 |
| #13702 | 8:12 PM | 🔴 | Resolved merge conflict in repository interface | ~5370 |
| #13701 | 8:11 PM | 🔵 | API client contains code snippet endpoints | ~2100 |
| #13700 | 8:11 PM | 🔴 | Resolving merge conflict in MikroORM config | ~2722 |
| #13699 | 8:11 PM | 🔴 | Resolved merge conflict in MikroOrmUnitOfWork | ~2953 |
| #13698 | 8:11 PM | 🔴 | Resolved merge conflict in MikroOrmUnitOfWork | ~2948 |
| #13697 | 8:11 PM | 🔴 | Resolved merge conflict in MikroOrmUnitOfWork | ~2735 |
| #13696 | 8:11 PM | 🔴 | Resolved merge conflict in MikroORM exports | ~1823 |
| #13695 | 8:11 PM | 🔴 | Resolving merge conflict in MikroORM config | ~3448 |
| #13694 | 8:11 PM | 🔴 | Resolved merge conflict in migration index | ~2143 |
| #13693 | 8:11 PM | 🔵 | Migration file conflict in MikroORM | ~1382 |

## Key Insights

- **Feature Integration**: Successfully merged `feat/16-learning-dashboard` and `feat/171-agent-registry` branches, resolving conflicts in MikroORM configuration, migrations, and repository exports.
- **Type Safety**: TypeScript typecheck passes for 7/8 projects; remaining issues in `plugin-entry.ts` and handlers need resolution.
- **Agent Registry**: Implemented dynamic agent provider registry pattern, replacing hardcoded switch statements with `AgentProviderDefinition` interface.
- **Code Snippets**: Added comprehensive API endpoints for code snippet management (retrieval, search, deletion) and resolved related merge conflicts.
- **Next Steps**: Test integrated features (learning insights + code snippets) and address remaining TypeScript errors.
</claude-mem-context>

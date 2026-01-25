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
| #15545 | 9:34 AM | 🟣 | Restore stashed changes | ~1026 |
| #15544 | 9:34 AM | 🟣 | Force push rebased eventsource-4.x | ~966 |
| #15543 | 9:34 AM | 🟣 | Rebase after dependency update | ~853 |
| #15542 | 9:34 AM | 🔵 | No conflict markers found | ~702 |
| #15541 | 9:34 AM | 🟣 | Resolve merge conflict in package.json | ~1802 |
| #15540 | 9:34 AM | 🔵 | Dependency version conflict | ~1162 |
| #15539 | 9:34 AM | 🟣 | Checkout eventsource-4.x | ~851 |
| #15538 | 9:34 AM | 🟣 | Force push rebased pnpm-10.x | ~992 |
| #15537 | 9:34 AM | 🟣 | Discard CLAUDE.md changes | ~891 |
| #15536 | 9:34 AM | 🔵 | Git rebase in progress | ~1019 |
| #15535 | 9:34 AM | 🔵 | No conflict markers | ~697 |
| #15534 | 9:34 AM | 🔵 | Merge conflicts in package.json | ~698 |
| #15533 | 9:32 AM | 🔴 | Resolved merge conflict | ~2039 |
| #15532 | 9:32 AM | 🔵 | Project structure discovered | ~1626 |
| #15531 | 9:32 AM | 🟣 | Checkout pnpm-10.x | ~859 |
| #15530 | 9:31 AM | 🟣 | Force push rebased node-24.x | ~1024 |
| #15529 | 9:31 AM | 🟣 | Continue rebase | ~800 |
| #15528 | 9:31 AM | 🟣 | Update Node.js to v24.13.0 | ~1469 |
| #15527 | 9:31 AM | 🔵 | Node.js version update | ~1015 |
| #15526 | 9:31 AM | 🟣 | Checkout node-24.x | ~852 |
| #15525 | 9:31 AM | 🟣 | Updated main branch | ~1272 |
| #15524 | 9:31 AM | 🔵 | Fetched updates | ~1092 |
| #15523 | 9:30 AM | 🔵 | Git remote configuration | ~752 |
| #15522 | 9:30 AM | 🔵 | PR #246: Update pnpm to v10 | ~1446 |
| #15521 | 9:30 AM | 🔵 | PR #248: eventsource v4 | ~1365 |
| #15520 | 9:30 AM | 🔵 | PR #245: Node.js v24 | ~1328 |
| #15519 | 1:36 AM | 🔴 | MCP search_documents error | ~1320 |
| #15518 | 1:35 AM | 🔴 | MCP save_memory type error | ~1441 |
| #15517 | 1:34 AM | 🔴 | MCP date filters broken | ~1439 |
| #15516 | 1:34 AM | 🔵 | Missing MCP search endpoint | ~1382 |

## Key Insights

- **Dependency Updates**: Multiple PRs (#245, #246, #248) are pending for Node.js v24, pnpm v10, and eventsource v4. These require review and merging.
- **Merge Conflicts**: Resolved conflicts in `package.json` for Node.js and pnpm updates, but ensure all branches are synchronized.
- **MCP Bugs**: Critical issues in MCP tools: invalid memory types, broken date filters, and missing `/api/search/observations` endpoint.
- **Monorepo Structure**: Project uses pnpm workspaces with multiple packages (e.g., `backend`, `ui`, `plugin`). Ensure updates are compatible across all packages.
- **Next Steps**: Merge dependency PRs, implement missing API endpoints, and fix MCP tool bugs (date filtering, memory types).
</claude-mem-context>

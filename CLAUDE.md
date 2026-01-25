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
| #876 | 1:32 PM | 🟠 | Added Mistral Embedding Provider | ~2798 |
| #875 | 1:32 PM | 🔵 | Provider-Agnostic Architecture Proposal | ~4061 |
| #874 | 1:31 PM | 🟠 | Create Embedding Provider Interface | ~1783 |
| #873 | 1:31 PM | 🟠 | Local Embedding Provider Implementation | ~2900 |
| #872 | 1:31 PM | 🟠 | Add comprehensive test suite for shared | ~1231 |
| #871 | 1:31 PM | 🔵 | Qdrant Service Implementation Analysis | ~3729 |
| #870 | 1:31 PM | 🔴 | Test failure in paths.test.ts | ~1203 |
| #869 | 1:31 PM | 🟣 | Create embeddings directory | ~679 |
| #868 | 1:30 PM | 🔵 | Embedding Handler Implementation Review | ~1313 |
| #867 | 1:30 PM | 🔵 | Test suite execution completed | ~1462 |
| #866 | 1:30 PM | 🔵 | Located embedding-related file | ~699 |
| #865 | 1:30 PM | 🔵 | Discovered worker service files | ~759 |
| #864 | 1:30 PM | 🔵 | Vector-DB optional implementation | ~1164 |
| #863 | 1:30 PM | 🟣 | Task 4 status updated | ~701 |
| #862 | 1:30 PM | 🟣 | Staging test files and CLAUDE.md | ~1026 |
| #861 | 1:30 PM | 🟠 | Added comprehensive test suite | ~1340 |
| #860 | 1:29 PM | 🔴 | Test failure in paths.test.ts | ~1506 |
| #859 | 1:29 PM | 🟣 | Updated CLAUDE_CONFIG_DIR test | ~2415 |
| #858 | 1:29 PM | 🔄 | Refactored paths test | ~6014 |
| #857 | 1:28 PM | 🔵 | Logger module structure | ~3820 |
| #856 | 1:27 PM | 🟠 | Created comprehensive test suite | ~3316 |
| #855 | 1:27 PM | 🔵 | Discovered shared package structure | ~1039 |
| #854 | 1:27 PM | 🔵 | Test suite runs successfully | ~1904 |
| #853 | 1:27 PM | 🟠 | Created comprehensive test suite | ~6183 |
| #852 | 1:27 PM | 🔵 | Exploring shared constants test | ~1696 |
| #851 | 1:26 PM | 🔵 | Secret detection test suite | ~3638 |
| #850 | 1:26 PM | 🔵 | Vitest configuration | ~1059 |
| #849 | 1:26 PM | 🔵 | Project contains no test files | ~5759 |
| #848 | 1:25 PM | 🔵 | Playwright test screenshots | ~976 |
| #847 | 1:25 PM | 🔵 | Issue 210 has no comments | ~686 |

## Key Insights

- **Embedding Provider Architecture**: Major progress on provider-agnostic embedding system with Mistral API integration, local Xenova provider, and comprehensive interface definition (Issue #112).
- **Testing Infrastructure**: Significant test suite expansion with 104+ tests covering core modules (SettingsManager, paths, logger) and 60% coverage threshold.
- **Vector Database**: Completed Phase 1 of optional Qdrant integration with conditional capability registration when VECTOR_DB is set.
- **Architecture Proposals**: New proposals for unified WebSocket system, worker hub federation, and task priority system to enhance distributed worker management.
- **Test Failures**: Two persistent test failures in paths.test.ts related to CLAUDE_CONFIG_DIR validation and LOGS_DIR environment variable handling need resolution.
</claude-mem-context>

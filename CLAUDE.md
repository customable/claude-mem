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

Repository: `customable/claude-mem` auf der lokalen Forgejo-Instanz

<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

### Jan 24

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #14722 | 11:07 PM | 🟠 | Add SemanticSearchTask imports | ~4890 |
| #14721 | 11:07 PM | 🔵 | Search routes implementation | ~2318 |
| #14720 | 11:06 PM | 🟠 | Add 'semantic:search' capability | ~1627 |
| #14719 | 11:06 PM | 🟠 | Add semantic search handler import | ~4159 |
| #14718 | 11:06 PM | 🟠 | Semantic Search Handler Implementation | ~2494 |
| #14717 | 11:06 PM | 🟠 | Add SemanticSearchTaskPayload import | ~4086 |
| #14716 | 11:06 PM | 🔵 | Worker Service Architecture Overview | ~3913 |
| #14715 | 11:06 PM | 🔵 | Located worker service file | ~685 |
| #14714 | 11:06 PM | 🟠 | Detect CAPSLOCK prompts feature | ~1400 |
| #14713 | 11:05 PM | 🟠 | Add semantic search handler export | ~1344 |
| #14712 | 11:05 PM | 🔵 | Task handlers structure discovered | ~998 |
| #14711 | 11:05 PM | 🔵 | Qdrant Service Implementation Analysis | ~3727 |
| #14710 | 11:05 PM | 🔵 | Qdrant Sync Handler Implementation Review | ~2615 |
| #14709 | 11:05 PM | 🔵 | Worker handlers directory structure | ~1019 |
| #14708 | 11:05 PM | 🟠 | Add SemanticSearchTask to Task union | ~3088 |
| #14707 | 11:05 PM | 🟠 | Add SemanticSearchTask interface | ~3610 |
| #14706 | 11:04 PM | 🟠 | Add SemanticSearchTaskPayload interface | ~3292 |
| #14705 | 11:04 PM | 🟠 | Add 'semantic-search' task type | ~2852 |
| #14704 | 11:04 PM | 🔵 | Qdrant Sync Handler Implementation Review | ~2616 |
| #14703 | 11:03 PM | 🔵 | Task system architecture overview | ~2531 |
| #14702 | 11:03 PM | 🔵 | Task system structure and types | ~1443 |
| #14701 | 11:03 PM | 🔵 | WorkerHub WebSocket Management | ~1947 |
| #14700 | 11:03 PM | 🔵 | WorkerHub references found | ~1048 |
| #14699 | 11:02 PM | 🔄 | Git rebase and push | ~937 |
| #14698 | 11:01 PM | 🟠 | Enhanced semantic search status | ~4027 |
| #14697 | 11:01 PM | 🔵 | Recent commits analysis | ~854 |
| #14696 | 11:01 PM | 🟠 | Document semantic search (#156) | ~1055 |
| #14695 | 11:01 PM | 🟠 | Enhanced search API response | ~3504 |
| #14694 | 11:00 PM | ✅ | Task 2 status updated | ~690 |
| #14693 | 11:00 PM | 🔵 | Qdrant Service Implementation Analysis | ~3738 |

## Key Insights

- **Semantic Search Integration**: Major progress on semantic search functionality with Qdrant, including new task types, handlers, and API enhancements. The system now supports vector-based search but falls back to SQLite FTS5 when Qdrant is unavailable.
- **Worker System Enhancements**: Added 'semantic:search' capability to workers, expanded task handling architecture, and implemented auto-restart with exponential backoff.
- **Documentation Updates**: Comprehensive documentation added for Qdrant/semantic search architecture and worker features.
- **Feature Additions**: New CAPSLOCK prompt detection feature to prioritize urgent observations, and enhanced session file tracking.
- **Architecture Discoveries**: Deep exploration of worker-service architecture, task system, and Qdrant integration patterns.
</claude-mem-context>

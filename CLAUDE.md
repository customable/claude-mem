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
| #772 | 1:09 PM | 🔵 | TaskDispatcher class structure and dependencies | ~1463 |
| #771 | 1:09 PM | 🟠 | Added archived outputs repository to TaskDispatcherOptions | ~5222 |
| #770 | 1:09 PM | 🔵 | Backend service initialization and dependency injection | ~1152 |
| #769 | 1:09 PM | 🟠 | Add CompressionTask and IArchivedOutputRepository to imports | ~4725 |
| #768 | 1:09 PM | 🔵 | Task dispatcher handles claude-md content storage and SSE events | ~2195 |
| #767 | 1:09 PM | 🟠 | Added compression capability resolution and fallback logic | ~6090 |
| #766 | 1:09 PM | 🔵 | Task completion handling and observation storage | ~2460 |
| #765 | 1:08 PM | 🟣 | TaskService now receives archivedOutputs dependency | ~5035 |
| #764 | 1:08 PM | 🔵 | TaskService instantiation found in backend-service.ts | ~714 |
| #763 | 1:08 PM | 🟠 | Implement Endless Mode for observation tasks | ~6336 |
| #762 | 1:08 PM | 🟠 | Added compression task queueing functionality | ~5731 |
| #761 | 1:08 PM | 🟠 | Capability configuration for InProcessWorker | ~1598 |
| #760 | 1:08 PM | 🔵 | Discovered task-related files in backend | ~781 |
| #759 | 1:07 PM | 🟠 | Added archivedOutputs repository to TaskService constructor | ~5267 |
| #758 | 1:07 PM | 🔵 | Examining Task Service Implementation | ~5156 |
| #757 | 1:07 PM | 🟠 | Added new task types and repository to task-service.ts | ~5339 |
| #756 | 1:06 PM | 🟠 | Added compression task handling to in-process worker | ~5499 |
| #755 | 1:06 PM | 🟠 | Add compression capability to worker agent detection | ~5126 |
| #754 | 1:06 PM | 🔵 | In-Process Worker Architecture Analysis | ~4507 |
| #753 | 1:06 PM | 🟠 | Add compression task support to in-process worker | ~5555 |
| #752 | 1:06 PM | 🟠 | Added compression task handling to worker service | ~5336 |
| #751 | 1:06 PM | 🟠 | Add compression capability to worker service | ~4741 |
| #750 | 1:06 PM | 🟠 | Add compression task support to worker service | ~5198 |
| #749 | 1:06 PM | 🔵 | Worker Service Architecture Overview | ~3970 |
| #748 | 1:05 PM | 🔵 | Worker package structure exploration | ~1406 |
| #747 | 1:05 PM | 🟠 | Added compression handler export to handlers index | ~1847 |
| #746 | 1:05 PM | 🟠 | Added compression system prompt and builder function | ~5287 |
| #745 | 1:05 PM | 🔵 | Found system prompts for observation extraction and summarization | ~3063 |
| #744 | 1:05 PM | 🟠 | Implemented compression handler for archived tool outputs | ~3192 |
| #743 | 1:04 PM | 🔵 | Discovered task handlers structure in worker package | ~912 |

## Key Insights

- **Endless Mode Implementation**: Major progress on Endless Mode (Issue #109) with compression task support added across worker services, task handlers, and system prompts. The feature archives tool outputs and compresses them (~95% token reduction) for extended memory.
- **Architecture Expansion**: Added `IArchivedOutputRepository` dependency to core services (TaskService, TaskDispatcher) and worker components, enabling dual-memory architecture.
- **Worker Capabilities**: Extended all agent types (Mistral, Anthropic, default) with compression capabilities, maintaining backward compatibility.
- **Task System Enhancements**: New task types (`CompressionTask`, `CompressionTaskPayload`) integrated into the task processing pipeline with proper queueing and handling logic.
- **Next Steps**: Test Endless Mode compression workflow, verify WebSocket integration for real-time updates, and evaluate conditional Qdrant capabilities.
</claude-mem-context>

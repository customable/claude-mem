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
| #15051 | 12:07 AM | 🟣 | Restarted development environment | ~2177 |
| #15046 | 12:05 AM | 🔵 | TypeScript typecheck passes for 7 of 8 projects | ~952 |
| #15045 | 12:05 AM | 🟣 | Pushed commits to forgejo main branch | ~769 |
| #15042 | 12:05 AM | 🔵 | Git remote configuration discovered | ~755 |
| #15041 | 12:05 AM | 🟠 | Added Capability Overview Section to WorkerStatus | ~5606 |
| #15040 | 12:05 AM | 🔵 | Recent commits show active feature development | ~968 |
| #15039 | 12:05 AM | 🟠 | Enhance worker capability display in UI | ~870 |
| #15035 | 12:04 AM | 🟠 | Added capability distribution tracking to WorkerStatus | ~5618 |
| #15034 | 12:04 AM | 🟠 | Enhanced capability display with color coding | ~5793 |
| #15030 | 12:03 AM | 🟠 | Enhanced WorkerStatus with capability parsing | ~6128 |
| #15028 | 12:02 AM | 🔵 | WorkerStatus component structure and functionality | ~5113 |
| #15027 | 12:02 AM | 🔵 | Worker-related files found in UI package | ~705 |
| #15024 | 12:01 AM | 🟠 | Add configurable worker capability profiles | ~1108 |
| #15023 | 12:01 AM | 🔵 | Build warning about large chunks in UI package | ~1010 |
| #15019 | 11:59 PM | 🟠 | Add Worker Profiles and Capability Limits | ~4498 |
| #15017 | 11:59 PM | 🟠 | Add Worker Profiles and Limits Configuration | ~6220 |
| #15016 | 11:59 PM | 🔵 | Build completed with chunk size warnings | ~1280 |
| #15015 | 11:59 PM | 🟠 | Added worker profiles and capability limits to settings | ~6109 |
| #15014 | 11:59 PM | 🔄 | Commit abstract capabilities refactoring | ~1143 |
| #15012 | 11:58 PM | 🔄 | Introduce Abstract Capabilities System | ~7182 |
| #15011 | 11:58 PM | 🔵 | Settings Manager class structure | ~1554 |
| #15010 | 11:57 PM | 🔵 | Identified BOOLEAN_KEYS usage in settings.ts | ~763 |
| #15008 | 11:57 PM | 🔵 | Search for STRING_KEYS constant | ~703 |
| #15007 | 11:57 PM | 🟠 | Added default provider settings | ~6223 |
| #15005 | 11:57 PM | 🔵 | Docker auto-update setting found | ~839 |
| #15002 | 11:57 PM | 🟠 | Added Worker Capability Profiles settings | ~6088 |
| #15001 | 11:57 PM | 🔵 | Examining Settings Management System | ~2577 |
| #14997 | 11:56 PM | 🔵 | Worker Capabilities System Overview | ~1476 |
| #14996 | 11:56 PM | 🔵 | WorkerCapability referenced in 3 files | ~736 |
| #14995 | 11:55 PM | 🟠 | Commit FTS5 search improvements with BM25 | ~1079 |

## Key Insights

- **Worker Capabilities Refactored**: Decoupled capabilities from providers (Issue #226) and added abstract types (LLM, Embedding, VectorDB) with provider-specific implementations.
- **Worker Profiles Introduced**: New configuration system for worker groups with capability limits (Issue #224), including default provider settings (Mistral, local, Qdrant).
- **Search Enhanced**: Implemented BM25 ranking for FTS5 search (Issue #211) with advanced query parsing (phrase search, OR/NOT operators, prefix search).
- **UI Improvements**: Enhanced WorkerStatus component with capability parsing, color coding, and provider info display.
- **Build Warnings**: UI bundle size exceeds 500 kB (635.36 kB), requiring optimization.
</claude-mem-context>

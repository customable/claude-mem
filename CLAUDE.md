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
| #12298 | 10:39 AM | 🔄 | Remove unused exports from paths.ts | ~1581 |
| #12297 | 10:39 AM | 🟣 | Pushed refactor branch to Forgejo | ~931 |
| #12296 | 10:39 AM | 🔄 | Remove unused exports from paths.ts | ~1158 |
| #12295 | 10:39 AM | 🔵 | TypeScript type checking completed | ~831 |
| #12294 | 10:38 AM | 🔄 | Simplified paths.ts module | ~5157 |
| #12293 | 10:38 AM | 🔵 | Search for shared constants | ~758 |
| #12292 | 10:38 AM | 🔄 | Branch creation for paths.ts cleanup | ~809 |
| #12291 | 10:38 AM | 🔵 | Shared package usage analysis | ~2075 |
| #12290 | 10:38 AM | 🔵 | Directory structure discovery | ~1915 |
| #12289 | 10:38 AM | 🔵 | Found paths export in shared package | ~707 |
| #12288 | 10:37 AM | 🔵 | Version functions in build scripts | ~864 |
| #12287 | 10:37 AM | 🔵 | Path-related functions identified | ~749 |
| #12286 | 10:37 AM | 🟣 | Added labels to issue #115 | ~787 |
| #12285 | 10:37 AM | 🔵 | Path configuration structure | ~2555 |
| #12284 | 10:37 AM | 🔵 | Config path constants in shared | ~793 |
| #12283 | 10:37 AM | 🔵 | Unused exports in paths.ts | ~1422 |
| #12282 | 10:37 AM | 🔵 | Reviewed open issues | ~2153 |
| #12281 | 10:37 AM | 🟣 | Added labels to issue #122 | ~796 |
| #12280 | 10:37 AM | 🟣 | Added labels to issue #123 | ~798 |
| #12279 | 10:37 AM | 🟣 | Added labels to issue #120 | ~805 |
| #12278 | 10:37 AM | 🟣 | Added labels to issue #4 | ~794 |
| #12277 | 10:37 AM | 🟣 | Added labels to issue #104 | ~801 |
| #12276 | 10:36 AM | 🔵 | Retrieved "has-pr" label ID | ~771 |
| #12275 | 10:36 AM | 🔵 | Repository labels discovered | ~1202 |
| #12274 | 10:36 AM | 🟢 | Created "has-pr" label | ~757 |
| #12273 | 10:35 AM | 🔵 | Reviewed enhancement issues | ~970 |
| #12272 | 10:35 AM | 🔵 | Worker Auto-Spawn issues | ~1959 |
| #12271 | 10:35 AM | 🔵 | Reviewed feature requests | ~1717 |
| #12270 | 10:35 AM | 🟣 | Discard unintended changes | ~689 |
| #12269 | 10:35 AM | ✅ | Upstream issue mitigations | ~1124 |

## Key Insights

- **Major Refactoring**: `paths.ts` was significantly cleaned up, removing 14 unused constants and 8 unused functions, reducing the file from 226 to 57 lines.
- **Issue Management**: Multiple issues were labeled and categorized, improving project tracking and prioritization.
- **Type Safety**: TypeScript type checking passed successfully, confirming codebase validity.
- **Upstream Dependencies**: Identified upstream Claude Code issues (#701, #737, #740) requiring mitigation strategies.
- **Feature Priorities**: GDPR compliance, Windows terminal fixes, and MCP tool enhancements are key focus areas.
</claude-mem-context>

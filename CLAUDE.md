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
| #163 | 11:55 AM | 🔵 | Worker/spawn-related code found in UI views | ~758 |
| #162 | 11:55 AM | 🔵 | Exploring Settings View Implementation | ~5369 |
| #161 | 11:55 AM | 🔵 | Workers Router API Structure | ~2922 |
| #160 | 11:55 AM | 🔵 | Worker Process Manager Structure | ~1831 |
| #159 | 11:54 AM | 🔵 | Exploring Settings Management System | ~5984 |
| #158 | 11:54 AM | 🔵 | Search for auto-spawn related code | ~1036 |
| #157 | 11:54 AM | 🔵 | Current task list retrieved | ~903 |
| #156 | 11:53 AM | 🔵 | Issue #256: Auto-Spawning reliability | ~1259 |
| #155 | 11:53 AM | 🟣 | Task status updated to "in_progress" | ~720 |
| #154 | 11:53 AM | 🟠 | Task created for Auto-Spawning Status | ~858 |
| #153 | 11:53 AM | 🟠 | Task created for documenting package structure | ~837 |
| #152 | 11:53 AM | 🔄 | Refactor metrics configuration | ~824 |
| #151 | 11:53 AM | 🟠 | Review Technologies and Achievements | ~758 |
| #150 | 11:52 AM | ✅ | Closed issue #207: Task deduplication | ~2464 |
| #149 | 11:52 AM | 🔵 | Open issues overview | ~1561 |
| #148 | 11:52 AM | 🟣 | Updated CLAUDE.md context files | ~809 |
| #147 | 11:51 AM | 🔵 | Database schema inspection | ~1037 |
| #146 | 11:51 AM | 🟠 | Added task deduplication | ~1247 |
| #145 | 11:51 AM | 🔵 | Git status reveals modifications | ~1025 |
| #144 | 11:50 AM | 🟣 | Dev environment restarted | ~1198 |
| #143 | 11:50 AM | 🔵 | PNPM script execution requires -w flag | ~781 |
| #142 | 11:50 AM | 🟠 | Added deduplication migration | ~3232 |
| #141 | 11:49 AM | 🔴 | Fixed task deduplication | ~5706 |
| #140 | 11:48 AM | 🔵 | Task Service Creates Documentation Tasks | ~1236 |
| #139 | 11:48 AM | 🔵 | Found queueClaudeMd method | ~1255 |
| #138 | 11:48 AM | 🔵 | Identified queueClaudeMd usage pattern | ~2042 |
| #137 | 11:48 AM | 🔵 | Examining task-service.ts | ~1646 |
| #136 | 11:48 AM | 🔵 | Identified files for Claude MD tasks | ~772 |
| #135 | 11:48 AM | 🔵 | Task deduplication migration found | ~967 |
| #134 | 11:48 AM | 🔵 | Found deduplication migration file | ~833 |

## Key Insights

- **Task Deduplication Implemented**: Added `deduplication_key` field and SHA-256 hashing to prevent duplicate tasks (Issue #207 closed).
- **Auto-Spawning Issues**: Unreliable worker auto-spawning and lack of UI feedback identified (Issue #256).
- **Documentation Focus**: Active work on documenting package structure and updating UI sections (Tasks #153, #151).
- **Performance Improvements**: Optimized session queries and fixed N+1 query issues.
- **Development Workflow**: PNPM workspace scripts require `-w` flag; dev environment restarted successfully.
</claude-mem-context>

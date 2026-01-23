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

### Jan 23

| ID      | Time      | T  | Title                                      | Read      |
|---------|-----------|----|--------------------------------------------|-----------|
| #12044  | 11:12 PM  | ✅ | Simplifying API by removing source filtering | ~968      |
| #12043  | 11:12 PM  | 🟠 | MCP tool for cached document search         | ~2149     |
| #12042  | 11:10 PM  | 🔵 | Documents table schema inspection           | ~2061     |
| #12041  | 11:10 PM  | 🔵 | Anthropic SDK streaming & token usage       | ~2619     |
| #12040  | 11:10 PM  | 🔵 | Anthropic TypeScript SDK libraries          | ~1198     |
| #12039  | 11:09 PM  | 🔵 | Recent observation types analysis           | ~1249     |
| #12038  | 11:09 PM  | 🔵 | Database contains 4 documents               | ~780      |
| #12037  | 11:09 PM  | 🔵 | Post-tool-use handler observation flow      | ~2068     |
| #12036  | 11:08 PM  | 🔵 | Observation handler implementation          | ~1845     |
| #12035  | 11:08 PM  | 🔵 | Project structure overview                  | ~1077     |
| #12034  | 11:08 PM  | 🔵 | Task system architecture                    | ~2546     |
| #12033  | 11:08 PM  | 🔵 | Hook system types discovered                | ~1379     |
| #12032  | 11:08 PM  | 🔵 | No compression code found                   | ~707      |
| #12031  | 11:08 PM  | 🔵 | Endless Mode architecture analysis          | ~4547     |
| #12030  | 11:08 PM  | 🔵 | Observation entity structure                | ~1414     |
| #12029  | 11:08 PM  | 🔵 | Post-tool-use handler observation flow      | ~2065     |
| #12028  | 11:08 PM  | 🔵 | Transcript references in hooks package      | ~771      |
| #12027  | 11:08 PM  | 🔵 | Observation type definitions                | ~1857     |
| #12026  | 11:08 PM  | 🔵 | User prompt submission handler              | ~1236     |
| #12025  | 11:07 PM  | 🔵 | Context generation handler                   | ~1342     |
| #12024  | 11:07 PM  | 🔵 | Settings management structure               | ~2402     |
| #12023  | 11:07 PM  | 🔵 | SSE Writer component analysis               | ~1725     |
| #12022  | 11:07 PM  | 🔵 | Hook runner implementation                  | ~1596     |
| #12021  | 11:07 PM  | 🔵 | Data router structure                       | ~1949     |
| #12020  | 11:07 PM  | 🔵 | Hook system types discovered                | ~1475     |
| #12019  | 11:07 PM  | 🔵 | Task service implementation                 | ~2105     |
| #12018  | 11:07 PM  | 🔵 | Stop hook handler functionality             | ~1761     |
| #12017  | 11:07 PM  | 🔵 | CLAUDE.md handler structure                 | ~1672     |
| #12016  | 11:07 PM  | 🔵 | Anthropic agent implementation              | ~1623     |
| #12015  | 11:07 PM  | 🔵 | Task system architecture                    | ~2515     |

## Key Insights

- **API Simplification**: Decision made to remove source filtering from search API to simplify usage (#12044)
- **New Feature Proposal**: MCP tool proposed for searching cached documents to reduce Context7 queries (#12043)
- **Endless Mode Bottleneck**: Current synchronous processing causes 110-second delays in Endless Mode (v7.1)
- **Architecture Understanding**: Comprehensive modular monorepo structure identified with 8 main packages
- **Key Components**: Observation extraction workflow, task dispatcher, and Anthropic SDK integration discovered
- **Missing Features**: No compression implementation found, transcript handling needs improvement
- **Next Steps**: Address Endless Mode latency, implement MCP tool, explore transcript storage mechanisms
</claude-mem-context>

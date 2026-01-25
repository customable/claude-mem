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
| #856 | 1:27 PM | 🟠 | Created paths module test suite | ~3316 |
| #855 | 1:27 PM | 🔵 | Discovered shared package structure | ~1039 |
| #854 | 1:27 PM | 🔵 | Test suite runs successfully | ~1904 |
| #853 | 1:27 PM | 🟠 | Created SettingsManager test suite | ~6183 |
| #852 | 1:27 PM | 🔵 | Explored shared constants test file | ~1696 |
| #851 | 1:26 PM | 🔵 | Analyzed secret detection tests | ~3638 |
| #850 | 1:26 PM | 🔵 | Found Vitest configuration | ~1059 |
| #849 | 1:26 PM | 🔵 | No test files in main source | ~5759 |
| #848 | 1:25 PM | 🔵 | Found Playwright screenshots | ~976 |
| #847 | 1:25 PM | 🔵 | Issue #210 has no comments | ~686 |
| #846 | 1:25 PM | 🔵 | Located Vitest config files | ~922 |
| #845 | 1:25 PM | 🔵 | Sidebar component added recently | ~824 |
| #844 | 1:25 PM | 🔵 | Vitest already installed | ~842 |
| #843 | 1:25 PM | 🔵 | Issue #210: Test suite proposal | ~3692 |
| #842 | 1:25 PM | 🔄 | Task 3 status updated | ~699 |
| #841 | 1:25 PM | 🟠 | Implemented priority-based resolution | ~1325 |
| #840 | 1:25 PM | 🔵 | Found Playwright test screenshot | ~10071 |
| #839 | 1:24 PM | ✅ | Responsive design completed | ~1453 |
| #838 | 1:24 PM | 🔵 | Discovered Playwright screenshot | ~10258 |
| #837 | 1:24 PM | 🔵 | App.tsx reveals UI architecture | ~2296 |
| #836 | 1:24 PM | 🔵 | Mobile view screenshot found | ~10139 |
| #835 | 1:24 PM | 🔵 | Dashboard View Implementation | ~3466 |
| #834 | 1:24 PM | 🔄 | Task 2 status updated | ~701 |
| #833 | 1:24 PM | 🔵 | Layout CSS uses responsive pattern | ~2065 |
| #832 | 1:23 PM | 🔵 | UI package uses dark theme | ~885 |
| #831 | 1:23 PM | 🔵 | Sidebar Component Structure | ~1828 |
| #830 | 1:23 PM | 🔵 | UI package has 21 components | ~1116 |
| #829 | 1:23 PM | 🔵 | Issue #218 has no comments | ~697 |
| #828 | 1:22 PM | 🔵 | Explored Settings Management | ~6038 |
| #827 | 1:22 PM | 🔄 | Task status updated | ~742 |

## Key Insights

- **Testing Infrastructure**: Comprehensive test suites created for paths module and SettingsManager (~9500 tokens). Vitest and Playwright are already configured and used for testing.
- **UI Development**: Responsive design implementation completed with mobile-first approach. Sidebar component added with CSS-only toggle pattern.
- **Task Management**: Multiple task status updates indicate active progress tracking in the project.
- **Architecture**: Discovered shared package structure with 12 TypeScript files and UI package with 21 React components.
- **Next Steps**: Implement proposed task priority system and worker hub federation architecture based on recent decisions.
</claude-mem-context>

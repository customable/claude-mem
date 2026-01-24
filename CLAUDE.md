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

### Jan 24, 2026

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #13794 | 8:44 PM | 🟠 | Add 70+ achievements across categories | ~1048 |
| #13793 | 8:44 PM | 🔵 | No changes detected in CLAUDE.md | ~714 |
| #13792 | 8:43 PM | 🔵 | Git status shows modified insights-service.ts | ~870 |
| #13791 | 8:42 PM | 🟠 | Expanded achievement system with tiers | ~8284 |
| #13790 | 8:41 PM | 🔵 | Achievement system structure discovered | ~1592 |
| #13789 | 8:41 PM | 🟠 | Fix dashboard stats with SQL aggregation | ~1098 |
| #13788 | 8:41 PM | 🔵 | Git status reveals modified backend files | ~927 |
| #13787 | 8:40 PM | 🔵 | Insights API returns activity data | ~1278 |
| #13786 | 8:40 PM | 🔵 | Analytics timeline API returns 8 days data | ~965 |
| #13785 | 8:40 PM | 🟣 | Development environment restarted | ~2096 |
| #13784 | 8:38 PM | 🔴 | Fallback for empty daily stats in heatmap | ~5078 |
| #13783 | 8:38 PM | 🔵 | Discovered ISessionRepository interface | ~1915 |
| #13782 | 8:38 PM | 🟣 | Rebuild all packages | ~813 |
| #13781 | 8:38 PM | 🟠 | Added getTimelineStats to SessionRepository | ~3996 |
| #13780 | 8:38 PM | 🟠 | Added fallback logic for empty daily stats | ~5056 |
| #13779 | 8:37 PM | 🔄 | Optimize analytics timeline with SQL | ~6216 |
| #13778 | 8:37 PM | 🔵 | Reading SessionRepository.ts file end | ~777 |
| #13777 | 8:37 PM | 🔵 | Exploring Observation Repository Interface | ~1112 |
| #13776 | 8:37 PM | 🟠 | Added getTimelineStats to ISessionRepository | ~5256 |
| #13775 | 8:37 PM | 🔵 | Analytics timeline endpoint implementation | ~1535 |
| #13774 | 8:37 PM | 🟠 | Added getTimelineStats to ObservationRepository | ~5812 |
| #13773 | 8:36 PM | 🟠 | Added getTimelineStats to IObservationRepository | ~5398 |
| #13772 | 8:35 PM | 🟣 | Waiting for backend to be ready | ~706 |
| #13771 | 8:35 PM | 🔵 | API endpoint returns insights summary | ~968 |
| #13770 | 8:35 PM | 🟣 | Backend service started | ~666 |
| #13769 | 8:34 PM | 🟣 | Rebuilding TypeScript packages | ~818 |
| #13768 | 8:33 PM | 🔵 | Found getInsightsSummary method | ~961 |
| #13767 | 8:33 PM | 🟣 | Increased data fetch limit to 100,000 | ~5176 |
| #13766 | 8:33 PM | 🔴 | Fix insights summary token tracking logic | ~4407 |
| #13765 | 8:33 PM | 🔵 | Analytics API endpoints discovered | ~2026 |

## Key Insights

- **Achievement System Expansion**: Added 70+ achievements across multiple categories (activity, tokens, learning, milestones), significantly enhancing user engagement.
- **Performance Optimization**: Refactored analytics to use SQL aggregation (`getTimelineStats`) instead of in-memory processing, improving efficiency.
- **Fallback Mechanisms**: Added robust fallback logic for empty daily stats in heatmap and activity tracking, ensuring data consistency.
- **Token Tracking Fix**: Resolved incorrect token handling in `getInsightsSummary`, ensuring accurate metrics (198M+ tokens tracked).
- **Next Steps**: Test new achievements, validate SQL aggregation performance, and implement real-time SSE updates for insights/analytics.
</claude-mem-context>

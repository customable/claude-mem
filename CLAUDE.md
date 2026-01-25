# Claude-Mem Development Instructions

**WICHTIG: Alle Anweisungen in dieser Datei sind verbindlich und müssen strikt befolgt werden!**

## Workflow

### Commits & Push

- **Pro Issue mindestens ein Commit** (gerne auch mehr bei größeren Änderungen)
- **Pushen nur mit Freigabe vom User**, außer der Prompt am Anfang erlaubt direktes Pushen
- Bei mehreren Issues: Pro Issue eigene Commits erstellen, dann am Ende gesammelt pushen (nach Freigabe)

### Issues umsetzen

- **Issues IMMER komplett umsetzen** - nicht in Phasen oder Teilschritten
- Erst mit dem nächsten Issue beginnen, wenn das aktuelle vollständig abgeschlossen ist
- Bei Blockern oder Unklarheiten: User fragen, nicht teilweise implementieren

### CLAUDE.md Dateien

- **Automatisch generierte CLAUDE.md-Dateien regelmäßig mit committen**
- Diese Dateien werden vom Plugin im `<claude-mem-context>`-Block aktualisiert
- Beim Committen von Code-Änderungen auch geänderte CLAUDE.md-Dateien mit einschließen

### Dokumentation

- **Wichtige Änderungen eigenständig in der CLAUDE.md dokumentieren**
- Neue Workflows, Konventionen oder wichtige technische Entscheidungen hier festhalten
- Bei strukturellen Änderungen am Projekt die entsprechenden Abschnitte aktualisieren

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

**Hinweis:** MikroORM wird intern im Backend verwendet. Für schnelle Debugging-Abfragen ist die `sqlite3` CLI am einfachsten.

```bash
# Sessions abfragen (WICHTIG: Tabelle heißt sdk_sessions!)
sqlite3 ~/.claude-mem/claude-mem.db "SELECT id, content_session_id, working_directory, status FROM sdk_sessions ORDER BY id DESC LIMIT 5;"

# Observations abfragen
sqlite3 ~/.claude-mem/claude-mem.db "SELECT id, title, type, cwd FROM observations ORDER BY id DESC LIMIT 5;"

# CLAUDE.md Content abfragen
sqlite3 ~/.claude-mem/claude-mem.db "SELECT id, project, content_session_id, working_directory FROM project_claudemd ORDER BY id DESC LIMIT 5;"

# Task Queue Status
sqlite3 ~/.claude-mem/claude-mem.db "SELECT type, status, COUNT(*) as count FROM task_queue GROUP BY type, status;"
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
sqlite3 ~/.claude-mem/claude-mem.db "SELECT id, project, content_session_id FROM project_claudemd ORDER BY id DESC LIMIT 10;"
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

</claude-mem-context>

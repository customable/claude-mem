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
- Diese Dateien werden vom Plugin automatisch aktualisiert
- User-Content außerhalb der generierten Bereiche bleibt erhalten

## Technische Details

### Monorepo-Struktur

```
packages/
├── backend/     # Express API Server
├── database/    # MikroORM Entities & Repositories
├── hooks/       # Claude Code Hook Handlers
├── shared/      # Shared Utilities (Logger, Settings)
├── types/       # TypeScript Interfaces
├── ui/          # React/Vite Frontend
└── worker/      # AI Task Processing
plugin/          # Claude Code Plugin
```

### Wichtige Befehle

```bash
# Development
pnpm dev              # Build plugin + sync to marketplace
pnpm build            # Build all packages
pnpm test             # Run tests
pnpm typecheck        # TypeScript check
pnpm sync-marketplace # Sync plugin to Claude marketplace
pnpm dev:restart      # Restart dev services

# Einzelne Packages builden
pnpm build:backend    # Backend only
pnpm build:worker     # Worker only
pnpm build:hooks      # Hooks only
pnpm build:plugin     # Plugin only

# Docker
pnpm docker:up        # Start containers
pnpm docker:down      # Stop containers
pnpm docker:logs      # View logs
```

### Issue-Tracker

- Repository: `customable/claude-mem` auf Forgejo
- Labels werden automatisch gesetzt (priority, type)
- **Kommentare und Attachments in Issues IMMER prüfen** - können wichtige Informationen enthalten
- **Blocks und Dependencies beachten** - Issues können andere blockieren oder von anderen abhängen

### UI-Referenzen

- Screenshots und Design-Referenzen: `~/references`

### Bei größeren Änderungen

Nach Änderungen an Backend, Worker oder Hooks:

1. **Plugin builden und syncen:**
   ```bash
   pnpm build && pnpm sync-marketplace
   ```

2. **Backend-Erreichbarkeit prüfen:**
   - Nach Neustart testen ob Backend erreichbar ist
   - Falls nicht erreichbar: Erst stoppen, dann **ohne** `-head` oder `-tail` neustarten
   - Direkt die JS-Datei ausführen um vollständigen Log zu sehen:
     ```bash
     node packages/backend/dist/cli.js start
     ```

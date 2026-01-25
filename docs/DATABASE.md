# Database Configuration

claude-mem supports multiple database backends via MikroORM.

## Supported Databases

| Database   | Use Case                    | Status      |
|------------|-----------------------------| ------------|
| **SQLite** | Local development, single-user | Default |
| **PostgreSQL** | Production, multi-user, SaaS | Supported |
| **MySQL** | Alternative to PostgreSQL | Experimental |

## SQLite (Default)

SQLite is the default database, requiring no additional setup.

### Configuration

```bash
# Via environment variable
export CLAUDE_MEM_DATABASE_PATH=~/.claude-mem/claude-mem.db

# Via CLI flag
claude-mem-backend start --db ~/.claude-mem/custom.db
```

### Native Compilation

SQLite uses `better-sqlite3` which requires native compilation. Prebuilt binaries are available for:
- Linux x64 (glibc and musl)
- macOS x64 and arm64
- Windows x64

If prebuilds aren't available for your platform/Node.js version, you'll need build tools:

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install build-essential python3
```

**macOS:**
```bash
xcode-select --install
```

**Windows:**
```powershell
# Install Visual Studio Build Tools
# Or use windows-build-tools
npm install --global windows-build-tools
```

## PostgreSQL

PostgreSQL is recommended for production deployments, multi-user scenarios, and SaaS hosting.

### Installation

```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# macOS (Homebrew)
brew install postgresql@16 && brew services start postgresql@16

# Docker
docker run -d --name claude-mem-postgres \
  -e POSTGRES_DB=claude_mem \
  -e POSTGRES_USER=claude_mem \
  -e POSTGRES_PASSWORD=secret \
  -p 5432:5432 \
  postgres:16
```

### Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE USER claude_mem WITH PASSWORD 'your-secure-password';
CREATE DATABASE claude_mem OWNER claude_mem;
GRANT ALL PRIVILEGES ON DATABASE claude_mem TO claude_mem;
\q
```

### Configuration

**Option 1: Connection String (recommended)**

```bash
# Via CLI flag
claude-mem-backend start --db postgres://claude_mem:password@localhost:5432/claude_mem

# Via environment variable
export CLAUDE_MEM_DATABASE_URL=postgres://claude_mem:password@localhost:5432/claude_mem
```

**Option 2: Individual Settings**

```bash
export CLAUDE_MEM_DATABASE_TYPE=postgres
export CLAUDE_MEM_DATABASE_HOST=localhost
export CLAUDE_MEM_DATABASE_PORT=5432
export CLAUDE_MEM_DATABASE_USER=claude_mem
export CLAUDE_MEM_DATABASE_PASSWORD=your-secure-password
export CLAUDE_MEM_DATABASE_NAME=claude_mem
```

**Option 3: Settings File** (`~/.claude-mem/settings.json`)

```json
{
  "DATABASE_TYPE": "postgres",
  "DATABASE_HOST": "localhost",
  "DATABASE_PORT": 5432,
  "DATABASE_USER": "claude_mem",
  "DATABASE_PASSWORD": "your-secure-password",
  "DATABASE_NAME": "claude_mem"
}
```

### Migrations

Migrations run automatically on startup for both SQLite and PostgreSQL. MikroORM handles the database-specific SQL generation.

### Backup

```bash
# PostgreSQL backup
pg_dump -U claude_mem claude_mem > backup.sql

# PostgreSQL restore
psql -U claude_mem claude_mem < backup.sql
```

## Data Migration

### From Legacy claude-mem

If you're migrating from `thedotmack/claude-mem`:

```bash
# Analyze legacy database
claude-mem-backend migrate analyze ~/.claude-mem-old/claude-mem.db

# Dry-run import
claude-mem-backend migrate import ~/.claude-mem-old/claude-mem.db --dry-run

# Import to SQLite (default)
claude-mem-backend migrate import ~/.claude-mem-old/claude-mem.db

# Import to PostgreSQL
claude-mem-backend migrate import ~/.claude-mem-old/claude-mem.db \
  --target postgres://user:pass@localhost:5432/claude_mem
```

### From SQLite to PostgreSQL

To migrate an existing SQLite installation to PostgreSQL:

1. **Start with PostgreSQL configured** (creates schema)
   ```bash
   claude-mem-backend start --db postgres://user:pass@localhost:5432/claude_mem
   # Stop after migrations complete
   ```

2. **Export from SQLite**
   ```bash
   # Use the migration tool with your SQLite as source
   claude-mem-backend migrate import ~/.claude-mem/claude-mem.db \
     --target postgres://user:pass@localhost:5432/claude_mem
   ```

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_MEM_DATABASE_TYPE` | `sqlite` or `postgres` | `sqlite` |
| `CLAUDE_MEM_DATABASE_PATH` | SQLite file path | `~/.claude-mem/claude-mem.db` |
| `CLAUDE_MEM_DATABASE_URL` | PostgreSQL connection string | - |
| `CLAUDE_MEM_DATABASE_HOST` | PostgreSQL host | `localhost` |
| `CLAUDE_MEM_DATABASE_PORT` | PostgreSQL port | `5432` |
| `CLAUDE_MEM_DATABASE_USER` | PostgreSQL user | - |
| `CLAUDE_MEM_DATABASE_PASSWORD` | PostgreSQL password | - |
| `CLAUDE_MEM_DATABASE_NAME` | PostgreSQL database name | `claude_mem` |

## Troubleshooting

### SQLite: "Cannot find module 'better-sqlite3'"

Install build tools and rebuild:
```bash
npm rebuild better-sqlite3
```

### PostgreSQL: "Connection refused"

Check PostgreSQL is running:
```bash
sudo systemctl status postgresql
# or
pg_isready
```

### PostgreSQL: "Authentication failed"

Verify credentials and check `pg_hba.conf` for local connections.

### Migrations fail

Check logs for specific errors. MikroORM will show the failing migration and SQL statement.

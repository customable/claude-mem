# /recall - Memory Retrieval Skill

Retrieve memories from claude-mem based on the user's query.

**Arguments:** `$ARGUMENTS`

## Instructions

Use the claude-mem MCP tools to find and display relevant memories:

### Step 1: Parse the Query

Check if the query contains filters:
- `--project=NAME` or `project:NAME` → filter by project
- `--type=TYPE` → filter by type (decision, discovery, bugfix, feature, etc.)
- `--since=DATE` → filter by start date (ISO format: 2026-01-01)
- `--until=DATE` → filter by end date

Extract the search terms from the remaining query.

### Step 2: Search Memories

Call the `mcp__plugin_claude-mem_mcp-search__search` tool with:
- `query`: the search terms
- `project`: if specified
- `type`: if specified
- `dateStart`: if --since specified
- `dateEnd`: if --until specified
- `limit`: 10 (adjust based on query specificity)

### Step 3: Get Full Details

If results are found, call `mcp__plugin_claude-mem_mcp-search__get_observations` with the IDs from the search results to get full content.

### Step 4: Present Results

Format the results clearly:

```
## Memories Found

### [Type] Title
**Project:** project-name | **Date:** YYYY-MM-DD HH:MM

Content/narrative here...

---
```

If no results are found, suggest:
- Trying different keywords
- Removing filters
- Checking if the project name is correct

## Examples

User: `/recall authentication flow`
→ Search for "authentication flow", show relevant discoveries and decisions

User: `/recall --project=docubuild database migrations`
→ Search "database migrations" filtered to docubuild project

User: `/recall --type=decision API rate limiting`
→ Search for decisions about "API rate limiting"

User: `/recall --since=2026-01-15 recent changes`
→ Search observations since Jan 15, 2026

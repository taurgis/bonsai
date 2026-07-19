# CLI Output Formats — Reference

## Table Design Principles

### Grep-compatible tables

Design tables so `grep`, `awk`, and `sort` work naturally on the output. One entity per line, consistent column spacing:

```
Name       Region     Status    Created
─────────  ─────────  ────────  ────────────
api        us-east-1  running   2025-01-10
worker     us-east-1  stopped   2025-01-08
scheduler  eu-west-1  running   2025-01-12
```

```bash
mycli apps | grep running          # find running apps
mycli apps | awk '{print $1}'      # extract names
```

### Column alignment

- Left-align text/string columns
- Right-align numeric columns
- Align colons vertically in key-value pairs
- Use `─────` separator lines under headers (not `===` or `---`)

### Standard table control flags

Implement these for any command that outputs a table:

```
--no-headers          omit header row
--no-truncate         show full values (don't truncate long strings)
--columns col1,col2   show only specified columns
--sort col            sort by column (prefix with - for descending)
--filter expr         filter rows
--csv                 output as CSV
--json                output as JSON array
```

### When not to use a table

- Only one row → use key-value format instead
- More than ~8-10 columns → pick the most important or split into subcommands
- Hierarchical relationship is the point → use a tree

---

## Key-Value Output

For single-entity `describe`/`inspect` commands:

```
Name:          my-app
Status:        running
Region:        us-east-1
Version:       1.2.3
Created at:    2025-01-10T14:30:00Z
Last deploy:   2025-01-15T09:12:43Z
```

Implementation with `cli-table3`:
```typescript
import Table from 'cli-table3'

const table = new Table({style: {head: [], border: []}})
table.push(['Name:', app.name])
table.push(['Status:', app.status])
table.push(['Region:', app.region])
this.log(table.toString())
```

---

## JSON Design Conventions

### Schema principles

- Return a **flat-ish object** — deep nesting makes `jq` expressions complex
- Include a `status` key for easy programmatic success checks
- Keep the schema stable after GA — treat it like an API contract
- Include all fields (even null ones) so consumers can rely on key existence

```json
{
  "id": "app-abc123",
  "name": "my-app",
  "status": "running",
  "region": "us-east-1",
  "createdAt": "2025-01-10T14:30:00Z",
  "url": "https://my-app.example.com"
}
```

### Array output

Wrap arrays in an object for extensibility:

```json
{
  "items": [
    {"id": "abc", "name": "api"},
    {"id": "def", "name": "worker"}
  ],
  "total": 2
}
```

### NDJSON / JSON Lines for streaming

For large result sets or streaming commands, offer `--json-lines` (one JSON object per line):

```
{"id":"abc","name":"api","status":"running"}
{"id":"def","name":"worker","status":"stopped"}
```

```bash
mycli apps --json-lines | jq -r 'select(.status == "running") | .name'
```

### jq integration examples

Document these in your CLI's README:

```bash
# Get all running app names
mycli apps --json | jq -r '.items[] | select(.status == "running") | .name'

# Get just the ID of a specific app
mycli apps --json | jq -r '.items[] | select(.name == "api") | .id'

# Count items by status
mycli apps --json | jq '[.items[].status] | group_by(.) | map({(.[0]): length}) | add'
```

---

## Progress Indicator Decision Tree

```
Is the operation < 1 second?
  → No indicator

Is the duration unknown?
  → Spinner (ux.action)

Do you know the total count?
  Is it a single-step task?
    → Progress bar with X/Y
  Are there named sub-steps?
    → listr2 task list

Is it parallel with multiple independent streams?
  → Multi-bar (cli-progress multi) or listr2 concurrent
```

---

## Debug Output Namespace Patterns

Use dot-separated or colon-separated namespaces for the `debug` package:

```
mycli              top-level startup/shutdown
mycli:auth         authentication flows
mycli:http         HTTP requests/responses
mycli:cache        cache reads/writes
mycli:config       config file loading
mycli:commands:X   specific command internals
```

Activation patterns:

```bash
DEBUG=mycli:*              all namespaces
DEBUG=mycli:http,mycli:auth  multiple specific
DEBUG=*,-mycli:cache       all except cache
DEBUG=oclif:*              OCLIF internals (v4 prefix required)
```

---

## Environment Variable Quick Reference

| Variable | Effect |
|----------|--------|
| `NO_COLOR` | Disable all ANSI color (any value) |
| `FORCE_COLOR=1` | Force color in non-TTY (basic 16) |
| `FORCE_COLOR=2` | Force 256-color |
| `FORCE_COLOR=3` | Force truecolor |
| `TERM=dumb` | Indicates a terminal with no escape sequences |
| `DEBUG=mycli:*` | Enable debug namespaces |
| `NO_UPDATE_NOTIFIER=1` | Suppress update checks |
| `CI=true` | Skips update checks, disables spinners |
| `XDG_CONFIG_HOME` | Override user config directory |
| `XDG_CACHE_HOME` | Override user cache directory |
| `MYCLI_CONFIG_HOME` | OCLIF-specific config dir override |
| `MYCLI_DISABLE_THEME=1` | Disable theme.json |

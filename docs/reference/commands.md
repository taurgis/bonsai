# Command Reference

Detailed specifications, flag arguments, and JSON schemas for Bonsai commands.

---

The package is published as `@taurgis/bonsai` and installs a `bonsai` binary. One-shot npm execution should use `npx @taurgis/bonsai ...`; after installation, use `bonsai ...`.

---

## Intentional CLI asymmetries

Bonsai keeps a few asymmetries because they match agent workflows:

- The root URL form (`bonsai <url>`) is the primary fetch UX. The underlying
  `fetch` command is hidden from the command list, but `bonsai help fetch`
  remains the full reference for URL-form flags.
- `status --tier` has no default. When omitted, status evaluates freshness
  against the cached artifact's own tier; setting a default would silently
  re-grade `stable` or `volatile` entries.
- `list --artifact-type` omits `section` because `list` reports page-level
  artifacts (`source`, `research_note`, and `index`). `prune --artifact-type`
  includes `section` so agents can clean up every cached artifact type.
- Short flags are command-local. For example, `-f` means fetch `--format` but
  import `--file`, and `-g` means tags on cache commands but `--global` on
  config commands. Check each command's help before reusing short flags.

---

## 1. Root fetch command

The primary command. It caches or retrieves a URL by using the URL shorthand for
the hidden `fetch` command.

### Usage

```bash
bonsai <url> [flags]
```

### Positional Arguments

- `<url>`: Required string. The full HTTP or HTTPS URL to crawl.

### Command-Line Flags

| Flag            | Short | Type     | Default      | Description                                                                                                                     |
| --------------- | ----- | -------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `--topic`       | `-t`  | string   | `null`       | Main research topic for metadata.                                                                                               |
| `--tags`        | `-g`  | string   | `[]`         | taxonomic tags (can be repeated).                                                                                               |
| `--format`      | `-f`  | choice   | `compressed` | Output format: `compressed` or `detailed`.                                                                                      |
| `--tier`        | —     | choice   | `standard`   | Freshness tier logic: `stable`, `standard`, or `volatile`.                                                                      |
| `--ttl`         | `-l`  | duration | `null`       | TTL duration for freshness (e.g. "2h", "7d", "6m").                                                                             |
| `--max-age`     | —     | duration | `null`       | Maximum cache age to accept (e.g. "2h", "7d", "6m").                                                                            |
| `--force`       | —     | boolean  | `false`      | Ignore cached copies and force a full network crawl.                                                                            |
| `--dry-run`     | —     | boolean  | `false`      | Crawl and extract without writing to cache.                                                                                     |
| `--allow-stale` | —     | boolean  | `false`      | Suppress exit code `5` when a within-grace stale entry is served after failed revalidation; has no effect once an entry is past its grace window. |
| `--rendered`    | —     | boolean  | `false`      | Force browser-rendered extraction for pages that require client-side JavaScript (e.g. SPA docs).                                |
| `--storage`     | —     | choice   | (configured) | Override cache location for this run: `global` or `project`. Secret-bearing pages are always stored globally.                   |
| `--read-only`   | —     | boolean  | `false`      | Block filesystem writes/deletes for this invocation (alias `--plan`). Also honored via `BONSAI_READ_ONLY` / `BONSAI_PLAN_MODE`. |
| `--json`        | —     | boolean  | `false`      | Format command response as machine-readable JSON.                                                                               |

### JSON Output Envelope Schema

```json
{
  "schemaVersion": 1,
  "command": "bonsai",
  "ok": true,
  "exitCode": 0,
  "stdout": "",
  "stderr": "",
  "data": {
    "schemaVersion": 1,
    "command": "bonsai",
    "dryRun": false,
    "cache": {
      "key": "0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7",
      "status": "hit" | "miss" | "revalidated" | "refreshed" | "stale" | "would_fetch" | "would_refresh" | "would_revalidate",
      "freshness": "fresh" | "stale_grace" | "stale_expired" | "none",
      "path": "/path/to/research/cache/0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7.md",
      "storage": "global" | "project",
      "redirectedToGlobal": false
    },
    "source": {
      "url": "https://example.com",
      "normalizedUrl": "https://example.com/",
      "captureMethod": "static_fetch" | "browser_fallback" | "agent_supplied" | "route_markdown" | "github_source",
      "extractionStatus": "extracted" | "agent_supplied" | "failed",
      "extractionConfidence": "high" | "medium" | "low",
      "qualityNotes": [
        "readability extracted main article"
      ],
      "fetchedAt": "2026-06-24T07:33:20.519Z",
      "validatedAt": "2026-06-24T07:33:20.519Z",
      "staleAfter": "2026-07-24T07:33:20.519Z"
    },
    "format": "compressed" | "detailed",
    "tokenEstimate": 29,
    "content": "Cleaned article text..."
  }
}
```

`cache.freshness` reports the freshness of the entry found at lookup, so it explains why the action
was taken (a `refreshed` result still reports the pre-fetch `stale_expired`). On a `miss` it is
`none`: no prior entry existed, so the freshly fetched content has no prior freshness to report.

---

## 2. `import`

Save agent-supplied Markdown text directly to local storage.

### Usage

```bash
bonsai import [url] [flags]
```

### Positional Arguments

- `[url]`: Optional string. The target URL (only for single-source import). Must omit if `--source-url` is used.

### Command-Line Flags

- `--stdin` **or** `--file <path>`: Exactly one input source is required. `--file -` reads stdin (same as `--stdin`).
- `--dry-run`: Validate the import without writing (also implied by global `--read-only` / `--plan`).
- `--source-url`: Source URLs for multi-source import (repeatable).
- `--input-format`: Input content format (`detailed` or `compressed`). Defaults to `detailed`.
- `--topic`: Main topic. **Required** for multi-source import.
- `--tags`: Taxonomic tags (repeatable).
- `--tier`: Freshness tier policy (`stable`, `standard`, or `volatile`).
- `--ttl`: TTL duration for imported note freshness (e.g. "2h", "7d", "6m").
- `--storage`: Storage mode (`global` or `project`). Override the configured cache location for this import. Notes containing secrets are always stored globally and never written to a project cache.
- `--read-only` / `--plan`: Block the write; reports `dryRun: true` and `cache.status: "would_import"`.

Localhost and other private hosts are accepted as **cache keys** for import. Network fetches to those hosts remain blocked by the SSRF guard.
Import stdin and file inputs are capped at 1 MiB. Oversized stdin exits `1` with `STDIN_TOO_LARGE`; oversized files exit `1` with `FILE_TOO_LARGE`. A directory passed to `--file` exits `2` with `NOT_A_FILE`.

### JSON Output envelope `data` block

```json
{
  "dryRun": false,
  "cache": {
    "key": "sha256-import-hash...",
    "status": "imported" | "would_import",
    "freshness": "fresh",
    "path": "/path/to/cache.md",
    "storage": "global" | "project",
    "redirectedToGlobal": false
  },
  "artifactType": "source" | "research_note",
  "topic": "React Suspense" | null,
  "sourceUrls": ["https://example.com"],
  "source": {
    "url": "https://example.com" | null,
    "normalizedUrl": "https://example.com/" | null,
    "captureMethod": "agent_supplied",
    "extractionStatus": "agent_supplied",
    "extractionConfidence": "high",
    "qualityNotes": ["agent-supplied research import"],
    "fetchedAt": null,
    "validatedAt": "2026-06-24T07:33:20.519Z",
    "staleAfter": "2026-07-24T07:33:20.519Z"
  },
  "format": "detailed",
  "tokenEstimate": 145,
  "content": "Imported markdown body..."
}
```

For multi-source imports (`--source-url` repeated, no positional URL), `source.url` and
`source.normalizedUrl` are `null`. Use `sourceUrls` and `topic` (required for multi-source) to find
the note again with `list --topic "…"`.

---

## 3. `status`

Inspect cache state and planning outcomes without performing fetches or writes.

### Usage

```bash
bonsai status <url> [flags]
```

### Command-Line Flags

| Flag        | Short | Type     | Default | Description                                                                          |
| ----------- | ----- | -------- | ------- | ------------------------------------------------------------------------------------ |
| `--tier`    | —     | choice   | —       | Evaluate freshness with this tier; when omitted, use the cached artifact's own tier. |
| `--ttl`     | `-l`  | duration | —       | TTL duration to evaluate freshness (e.g. "2h", "7d", "6m").                          |
| `--max-age` | —     | duration | —       | Maximum cache age to accept (e.g. "2h", "7d", "6m").                                 |
| `--json`    | —     | boolean  | `false` | Machine-readable envelope.                                                           |

### JSON Output envelope `data` block

```json
{
  "cacheKey": "0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7",
  "cachePath": "/path/to/0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7.md",
  "normalizedUrl": "https://example.com/",
  "status": "hit" | "miss" | "stale",
  "freshness": "fresh" | "stale_grace" | "stale_expired" | "none",
  "action": "would_fetch" | "would_revalidate" | "would_return_cached"
}
```

On a `miss`, `freshness` is `none`: no entry exists, so no freshness applies. `stale_grace` and
`stale_expired` describe an entry that exists but has aged into the grace window or past it.
A miss exits `1` with code `CACHE_MISS` but still returns `data` (and an array when multiple URLs are passed).
In a multi-URL batch, an invalid or scheme-less later URL becomes a sparse `error` row
(`{ status: "error", normalizedUrl, error }`, exit `1`, code `INVALID_URL` / `MISSING_URL_SCHEME`)
while prior hit/miss rows stay in `data` — same keep-prior-hits contract as `fetch`.

---

## 4. `inspect`

Display cached headers and frontmatter metadata for a URL.

### Usage

```bash
bonsai inspect <url>
```

### JSON Output envelope `data` block

```json
{
  "cacheKey": "0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7",
  "cachePath": "/path/to/0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7.md",
  "normalizedUrl": "https://example.com/",
  "status": "hit" | "miss",
  "metadata": {
    "schema_version": 1,
    "artifact_type": "source",
    "source_url": "https://example.com",
    "source_urls": ["https://example.com"],
    "normalized_url": "https://example.com/",
    "cache_key": "0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7",
    "topic": "example",
    "tags": ["test"],
    "format_available": ["compressed", "detailed"],
    "tier": "standard",
    "ttl": null,
    "fetched_at": "2026-06-24T07:33:20.519Z",
    "validated_at": "2026-06-24T07:33:20.519Z",
    "stale_after": "2026-07-24T07:33:20.519Z",
    "status": "active"
  },
  "sections": [
    {
      "cacheKey": "…",
      "anchor": "intro",
      "headingPath": "Intro > Overview",
      "tokenEstimate": { "compressed": 12, "detailed": 40 }
    }
  ]
}
```

On a miss, `metadata` is `null`, `sections` is `[]`, and the command exits `1` with `CACHE_MISS`
while still returning `data` (including hit rows in a multi-URL batch).
Invalid URLs in a multi-URL batch follow the same keep-prior-hits contract as `status`/`fetch`
(`error` rows, exit `1`).

---

## 5. `list`

Browse the cache by metadata, without printing page content. `list` filters the
whole cache and sorts the matches newest-first, so it answers "what do I have?"

### Usage

```bash
bonsai list [flags]
```

`list` takes no positional argument; every filter is a flag, and with no flags
it returns the most recent entries across all read roots.

`list` reports page-level artifacts (`source`, `research_note`, and `index`). The
`section` sub-chunks a page is split into are omitted so a single fetch does not
flood the listing — find them with `inspect` (which lists a page's sections).

### Command-Line Flags

| Flag               | Short | Type    | Default | Description                                                                                                                |
| ------------------ | ----- | ------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `--topic`          | `-t`  | string  | —       | Exact topic (case-insensitive).                                                                                            |
| `--tags`           | `-g`  | string  | —       | Tags to require; all repeated tags must match.                                                                             |
| `--freshness`      | —     | choice  | —       | Freshness state: `fresh`, `stale_grace`, or `stale_expired`.                                                               |
| `--artifact-type`  | —     | choice  | —       | Artifact type: `source`, `research_note`, or `index`. Section children are omitted from `list`; use `inspect` to see them. |
| `--capture-method` | —     | choice  | —       | Capture method: `static_fetch`, `browser_fallback`, `agent_supplied`, `route_markdown`, or `github_source`.                |
| `--url`            | —     | glob    | —       | Source URL glob (case-insensitive, supports `*`).                                                                          |
| `--limit`          | —     | integer | `50`    | Cap the result count (1–100).                                                                                              |
| `--json`           | —     | boolean | `false` | Return the machine-readable envelope.                                                                                      |

Results are sorted by `validated_at` (falling back to `fetched_at`), newest
first, then truncated to `--limit`.

### JSON Output envelope `data` block

```json
[
  {
    "cacheKey": "0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7",
    "path": "/path/to/cache/0f115db0...e9d7.md",
    "artifactType": "source" | "research_note",
    "sourceUrls": ["https://example.com"],
    "topic": "example",
    "tags": ["test"],
    "freshness": "fresh" | "stale_grace" | "stale_expired",
    "captureMethod": "static_fetch" | "browser_fallback" | "agent_supplied" | "route_markdown" | "github_source",
    "tokenEstimate": { "compressed": 29, "detailed": 65 },
    "qualityNotes": ["readability extracted main article"],
    "fetchedAt": "2026-06-24T07:33:20.519Z",
    "validatedAt": "2026-06-24T07:33:20.519Z"
  }
]
```

When more entries match than `--limit`, the envelope also includes a top-level
`truncation` object (and `data` remains the capped array). Absence of `truncation`
means the result set was not capped:

```json
{
  "schemaVersion": 1,
  "command": "list",
  "ok": true,
  "exitCode": 0,
  "stdout": "",
  "stderr": "",
  "data": [ /* at most --limit rows */ ],
  "truncation": {
    "totalMatched": 12,
    "shown": 2,
    "limit": 2
  }
}
```

Under `--json`, truncation is never mirrored as a process-stderr tip — the
envelope field is the stable agent signal.

---

## 6. `prune`

Delete cached entries by age, inactivity, or type to reclaim disk space. Pruning
spans **every read root** (project and global), so a key present in both is
deleted from both.

### Usage

```bash
bonsai prune [flags]
```

Two guardrails make accidental deletion hard:

- At least one of `--older-than`, `--inactive`, `--artifact-type`, or `--url` is
  **required**; running `prune` with no filter exits `2` rather than matching
  everything.
- The command refuses to delete unless you pass `--yes`. Use `--dry-run` first
  to see exactly what would go. `--dry-run` and `--yes` are mutually exclusive —
  passing both exits `2` (`CONFLICTING_FLAGS`) rather than guessing which you
  meant.

### Command-Line Flags

| Flag                     | Short | Type     | Default | Description                                                                                                               |
| ------------------------ | ----- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `--older-than`           | —     | duration | —       | Content age threshold (`fetched_at`, falling back to `validated_at`), e.g. `30d`. Zero durations are rejected.            |
| `--inactive`             | —     | duration | —       | Idle time threshold (`validated_at`, falling back to `fetched_at`), e.g. `14d`.                                           |
| `--artifact-type`        | —     | choice   | —       | Artifact type to prune: `source`, `research_note`, `index`, or `section`. Unlike `list`, prune includes section children. |
| `--url`                  | —     | glob     | —       | Source URL glob (case-insensitive, supports `*`).                                                                         |
| `--dry-run`              | —     | boolean  | `false` | Preview files without deleting. Mutually exclusive with `--yes`.                                                          |
| `--yes`                  | `-y`  | boolean  | `false` | Confirm deletion. Required for a real prune (rejected under `--read-only`).                                               |
| `--read-only` / `--plan` | —     | boolean  | `false` | Implicit preview; mutations disabled.                                                                                     |
| `--json`                 | —     | boolean  | `false` | Return the machine-readable envelope.                                                                                     |

`--older-than` and `--inactive` are distinct: a recently revalidated but originally-old page can match
`--older-than` while still failing `--inactive`. When some unlinks fail, `prunedCount` reports actual
deletes and the process exits `1`.

### JSON Output envelope `data` block

```json
{
  "dryRun": true,
  "prunedCount": 0,
  "candidateCount": 3,
  "files": [{ "cacheKey": "0f115db0...e9d7", "path": "/path/to/cache/0f115db0...e9d7.md" }]
}
```

On a dry run, `prunedCount` is `0` and `candidateCount` reports what a real run
would delete. On a real run, `prunedCount` is the number actually removed.

---

## 7. `config`

Manage where the research cache is stored. Configuration is layered, resolved in
precedence order: per-command `--storage` flag > `BONSAI_STORAGE` env var >
project config (`.bonsai.json` in cwd) > user config (`config.json` in the OCLIF
config dir) > built-in default (`global`).

### Storage modes

| Mode               | Cache location                          | Read behavior                                                       |
| ------------------ | --------------------------------------- | ------------------------------------------------------------------- |
| `global` (default) | OCLIF data dir (`<dataDir>/research/`)  | Reads the global cache only.                                        |
| `project`          | `<cwd>/.bonsai/research/` (committable) | Reads the project cache first, then falls back to the global cache. |

The project cache is intended to be shared/committed with a repository. To keep
secrets out of version control, any artifact whose content matches a known
credential pattern (API keys, tokens, private keys, `secret=`/`token=`
assignments, etc.) is **always written to the global cache**, even when
`project` storage is selected. A warning is printed, and the JSON envelope
reports `redirectedToGlobal: true`. The matched secret value is never echoed;
only the credential _type_ is named.

### Subcommands

```bash
# Store this project's research cache inside the repo
bonsai config set storage project --local

# Equivalent inline assignment form
bonsai config set storage=project --local

# Set the user-wide default
bonsai config set storage global

# Inspect values
bonsai config get storage          # effective value
bonsai config get storage --local  # project file only (shows default + "(not configured)" when unset)
bonsai config list                 # all keys

# Remove a key (restores the default)
bonsai config unset storage --local
```

### JSON shapes

`config get --json` returns `{ key, value, configured }`. `configured` is `false` when nothing
beyond the built-in default pins the key: for `--global`/`--local` that means the file omits it;
for the effective (no-scope) view it means no project file, user file, or valid `BONSAI_*` env
override set it. `value` is still the usable default/resolved value so agents need no second lookup.

`config list --json` returns an array of `{ key, value, configured }` entries with the same
semantics per key (same array-as-`data` shape as `list`).

`config set --json` returns `{ key, value, scope, dryRun, status }`, where `status` is `"set"` or
`"would_set"`. `config unset --json` returns `{ key, scope, dryRun, status }`, where `status` is
`"unset"` or `"would_unset"`. `--dry-run`, `--read-only`/`--plan`, `BONSAI_READ_ONLY`, and
`BONSAI_PLAN_MODE` all set `dryRun: true` and skip the config write.

### Flags

- `--global` / `-g`: target the user-level config file (default for `set`/`unset`).
- `--local` / `--project` / `-p`: target the project-level config file (`.bonsai.json`).
- `--dry-run`: (`set`/`unset`) show the change without writing.
- `--read-only` / `--plan`: inherited global flag; (`set`/`unset`) preview without writing.
- `--json`: machine-readable envelope.

### Configuration keys

| Key       | Values                                   | Default        | Description                                                                                                                                                    |
| --------- | ---------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage` | `global`, `project`                      | `global`       | Where new research artifacts are cached.                                                                                                                       |
| `summary` | `conservative`, `balanced`, `aggressive` | `conservative` | How aggressively the `compressed` variant condenses prose (headings, code blocks, tables, and lists are always preserved). Also settable via `BONSAI_SUMMARY`. |

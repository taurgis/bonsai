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
  `search --artifact-type` follows `list`'s rule, since `search` is
  page-level too.
- `search`'s default `--limit` (20) is lower than `list`'s (50): a ranked
  search row carries a `snippet` and match diagnostics that a plain list row
  doesn't, so a smaller default keeps token spend down for the common
  "what matches?" case while `--limit` can still raise it to 100.
- Short flags are command-local. For example, `-f` means fetch `--format` but
  import `--file`, and `-g` means tags on cache commands but `--global` on
  config commands. Check each command's help before reusing short flags.
- Running `bonsai` with no arguments at all shows live cache data (the same as
  `bonsai list`) instead of root help text, preceded by a two-line identity
  header (`bin: <path>` and `description: <one sentence>`) so an agent knows
  what it is looking at without a separate `--help` call. The header is
  human-mode only and specific to that true bare invocation — it does not
  appear on an explicit `bonsai list`, and `--json`/`--toon` output stays a
  clean envelope either way. `bonsai help`, `--help`, and `-h` are unaffected
  and remain the explicit command reference.
- `setup`'s default scope is the opposite of `config set`/`config unset`'s.
  `setup <agent>` writes to the project by default (`--global` opts into a
  user-level install), while `config set`/`config unset` write to the
  user-level file by default (`--local` opts into the project file). `setup`
  defaults to project because a shared hook is the common case for a team
  repo; `config` defaults to user because storage mode is usually a personal
  preference, not something to commit for everyone.

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
| `--topic`       | `-t`  | string   | `null`       | Main research topic for metadata (max 200 chars).                                                                                |
| `--tags`        | `-g`  | string   | `[]`         | taxonomic tags (can be repeated, max 100 chars each).                                                                           |
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
| `--toon`        | —     | boolean  | `false`      | Emit the same envelope as `--json`, encoded as TOON (fewer tokens). Mutually exclusive with `--json`.                          |
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
    "detailedTokenEstimate": 65,
    "content": "Cleaned article text..."
  }
}
```

`cache.freshness` reports the freshness of the entry found at lookup, so it explains why the action
was taken (a `refreshed` result still reports the pre-fetch `stale_expired`). On a `miss` it is
`none`: no prior entry existed, so the freshly fetched content has no prior freshness to report.

`detailedTokenEstimate` is always the true `detailed`-format size, even when `format` is
`compressed` — it equals `tokenEstimate` whenever nothing was actually truncated. See
[Compression & Token Budgeting](/concepts/compression#knowing-how-much-detail-was-cut).

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
- `--topic`: Main topic (max 200 chars). **Required** for multi-source import.
- `--tags`: Taxonomic tags (repeatable, max 100 chars each).
- `--tier`: Freshness tier policy (`stable`, `standard`, or `volatile`).
- `--ttl`: TTL duration for imported note freshness (e.g. "2h", "7d", "6m").
- `--storage`: Storage mode (`global` or `project`). Override the configured cache location for this import. Notes containing secrets are always stored globally and never written to a project cache.
- `--read-only` / `--plan`: Block the write; reports `dryRun: true` and `cache.status: "would_import"`.
- `--toon`: Emit the same envelope as `--json`, encoded as TOON (fewer tokens). Mutually exclusive with `--json`.
- `--json`: Format command response as machine-readable JSON.

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

| Flag          | Short | Type     | Default | Description                                                                          |
| ------------- | ----- | -------- | ------- | ------------------------------------------------------------------------------------ |
| `--tier`      | —     | choice   | —       | Evaluate freshness with this tier; when omitted, use the cached artifact's own tier. |
| `--ttl`       | `-l`  | duration | —       | TTL duration to evaluate freshness (e.g. "2h", "7d", "6m").                          |
| `--max-age`   | —     | duration | —       | Maximum cache age to accept (e.g. "2h", "7d", "6m").                                 |
| `--read-only` | —     | boolean  | `false` | Block filesystem writes/deletes for this invocation (alias `--plan`). Also honored via `BONSAI_READ_ONLY` / `BONSAI_PLAN_MODE`. |
| `--toon`      | —     | boolean  | `false` | Emit the same envelope as `--json`, encoded as TOON (fewer tokens). Mutually exclusive with `--json`. |
| `--json`      | —     | boolean  | `false` | Machine-readable envelope.                                                           |

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

### Command-Line Flags

| Flag          | Short | Type    | Default | Description                                                                          |
| ------------- | ----- | ------- | ------- | ------------------------------------------------------------------------------------- |
| `--read-only` | —     | boolean | `false` | Block filesystem writes/deletes for this invocation (alias `--plan`). Also honored via `BONSAI_READ_ONLY` / `BONSAI_PLAN_MODE`. |
| `--toon`      | —     | boolean | `false` | Emit the same envelope as `--json`, encoded as TOON (fewer tokens). Mutually exclusive with `--json`. |
| `--json`      | —     | boolean | `false` | Return the machine-readable envelope.                                               |

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
while still returning `data` (including hit rows in a multi-URL batch). A miss row also carries
`partOfExistingNote`: `null` for a genuinely uncached URL, or `{ cacheKey, artifactType, topic,
sourceUrls }` when the URL has no cache key of its own but is already listed among another cached
artifact's `source_urls` — typically a multi-source `research_note` imported with `--source-url`,
which keys off topic and content rather than any single URL (see
[Caching Protocol Specification](cache-protocol.md)). The accompanying hint points at
`bonsai list --url "<url>"` to find it, instead of suggesting a fetch that would create an
unrelated duplicate entry.
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
| `--full`           | —     | boolean | `false` | Return every metadata field (cache key, path, artifact type, tags, capture method, quality notes, timestamps) instead of the minimal default row. |
| `--read-only`      | —     | boolean | `false` | Block filesystem writes/deletes for this invocation (alias `--plan`). Also honored via `BONSAI_READ_ONLY` / `BONSAI_PLAN_MODE`. |
| `--toon`           | —     | boolean | `false` | Emit the same envelope as `--json`, encoded as TOON (fewer tokens). Mutually exclusive with `--json`.                      |
| `--json`           | —     | boolean | `false` | Return the machine-readable envelope.                                                                                      |

Results are sorted by `validated_at` (falling back to `fetched_at`), newest
first, then truncated to `--limit`. A whitespace-only `--topic` or `--tags`
value is rejected as `INVALID_FLAG_VALUE` (same as an empty `--url`) rather
than silently matching everything or nothing — almost always a shell-quoting
mistake.

### JSON Output envelope `data` block

By default each row is the minimal shape an agent needs to judge relevance and
act next — fetch/inspect the source, gauge freshness, budget tokens:

```json
[
  {
    "sourceUrls": ["https://example.com"],
    "topic": "example",
    "freshness": "fresh" | "stale_grace" | "stale_expired",
    "tokenEstimate": { "compressed": 29, "detailed": 65 }
  }
]
```

Pass `--full` for every metadata field:

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

The envelope always includes a top-level `summary` object alongside `data` —
aggregate counts plus an explicit empty-result signal, computed over every
matched entry (before `--limit`):

```json
{
  "schemaVersion": 1,
  "command": "list",
  "ok": true,
  "exitCode": 0,
  "stdout": "",
  "stderr": "",
  "data": [ /* at most --limit rows */ ],
  "summary": {
    "total": 12,
    "shown": 2,
    "limit": 2,
    "truncated": true,
    "empty": false,
    "byFreshness": { "fresh": 9, "stale_grace": 2, "stale_expired": 1 }
  }
}
```

`empty: true` (with `total`/`shown` both `0`) is the definitive signal for "no
matches" — never infer it from an empty `data` array alone. Under `--json`,
none of this is ever mirrored as a process-stderr tip — the
envelope field is the stable agent signal.

---

## 6. `search`

Rank cached page-level artifacts by keyword — the content/tag search `list` doesn't do. `--query`
matches (case-insensitive) against topic, tags, `summary`, and `compressed`; every other filter
(`--topic`, `--tags`, `--url`, `--freshness`, `--artifact-type`, `--capture-method`) works exactly
like `list`'s. `search` reads only the token-cheap indexed `summary`/`compressed` text — never the
full `detailed` body — so ranking a large cache stays fast and never balloons context. Omitting
`--query` behaves like `list`: every row scores `0` and results sort newest-first instead of by
relevance.

### Usage

```bash
bonsai search --query "<keywords>" [flags]
```

`search`, like `list`, reports page-level artifacts only (`source`, `research_note`, `index`) —
`section` children are omitted; use `inspect` to see them.

### Command-Line Flags

| Flag               | Short | Type    | Default | Description                                                                                                                |
| ------------------ | ----- | ------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `--query`          | `-q`  | string  | —       | Keyword(s) to search across topic, tags, summary, and compressed content. Every term must match somewhere unless `--match-any` is set. |
| `--match-any`      | —     | boolean | `false` | Match any query term instead of requiring all of them (OR instead of AND).                                                |
| `--topic`          | `-t`  | string  | —       | Exact topic (case-insensitive), same matching as `list --topic`.                                                          |
| `--tags`           | `-g`  | string  | —       | Tags to require; all repeated tags must match, same matching as `list --tags`.                                            |
| `--freshness`      | —     | choice  | —       | Freshness state: `fresh`, `stale_grace`, or `stale_expired`.                                                               |
| `--artifact-type`  | —     | choice  | —       | Artifact type: `source`, `research_note`, or `index`. Section children are omitted from `search` — use `inspect`.          |
| `--capture-method` | —     | choice  | —       | Capture method: `static_fetch`, `browser_fallback`, `agent_supplied`, `route_markdown`, or `github_source`.                |
| `--url`            | —     | glob    | —       | Source URL glob (case-insensitive, supports `*`).                                                                          |
| `--limit`          | —     | integer | `20`    | Cap the result count (1–100). Deliberately lower than `list`'s default of 50: ranked rows carry a `snippet` and extra fields, so a smaller default keeps token spend down. |
| `--full`           | —     | boolean | `false` | Return every metadata field (as `list --full`) alongside `score`/`matchedFields`/`snippet` instead of the minimal default row. |
| `--read-only`      | —     | boolean | `false` | Block filesystem writes/deletes for this invocation (alias `--plan`). Also honored via `BONSAI_READ_ONLY`/`BONSAI_PLAN_MODE`. |
| `--toon`           | —     | boolean | `false` | Emit the same envelope as `--json`, encoded as TOON (fewer tokens). Mutually exclusive with `--json`.                      |
| `--json`           | —     | boolean | `false` | Return the machine-readable envelope.                                                                                      |

A whitespace-only `--query`/`--topic`/`--tags`/`--url` value is rejected as `INVALID_FLAG_VALUE`
rather than silently matching everything or nothing — almost always a shell-quoting mistake.

### Ranking

Each query term is checked against topic, tags, `summary`, and `compressed`; a matched field
contributes a fixed score weight (topic scores highest, then tags, then summary, then compressed),
with repeated occurrences in `summary`/`compressed` capped so one long, repetitive page cannot
out-rank a genuine topic/tag match. Results are sorted by score (descending) when `--query` is
given, tie-broken by `validated_at` then cache key for deterministic output; without `--query`,
results sort newest-first exactly like `list`.

### JSON Output envelope `data` block

By default each row is the minimal shape an agent needs to judge relevance without a second
round trip — the same fields as `list`'s minimal row, plus the score, which fields matched, and a
short excerpt around the first content match:

```json
[
  {
    "sourceUrls": ["https://example.com"],
    "topic": "example",
    "freshness": "fresh" | "stale_grace" | "stale_expired",
    "tokenEstimate": { "compressed": 29, "detailed": 65 },
    "score": 112,
    "matchedFields": ["topic", "compressed"],
    "snippet": "…the surrounding sentence containing the matched keyword…"
  }
]
```

`matchedFields` lists only `"topic"`, `"tags"`, `"summary"`, `"compressed"` — whichever fields a
query term actually matched — in that priority order. `snippet` is `null` when `--query` was
omitted, or when a match came only from `topic`/`tags` (no content excerpt to show). Pass `--full`
for every metadata field, same as `list --full`.

The envelope always includes a top-level `summary` object alongside `data`, matching `list`'s shape
plus one additional flag:

```json
{
  "schemaVersion": 1,
  "command": "search",
  "ok": true,
  "exitCode": 0,
  "stdout": "",
  "stderr": "",
  "data": [ /* at most --limit rows */ ],
  "summary": {
    "total": 12,
    "shown": 2,
    "limit": 2,
    "truncated": true,
    "empty": false,
    "byFreshness": { "fresh": 9, "stale_grace": 2, "stale_expired": 1 },
    "queried": true
  }
}
```

`queried: false` means `--query` was omitted — every row scored `0` and the sort fell back to
`list`'s newest-first order, so a caller can tell "no query was run" apart from "the query matched
nothing" (`empty: true`).

---

## 7. `prune`

Delete cached entries by age, inactivity, or type to reclaim disk space. Pruning
spans **every read root** (project and global), so a key present in both is
deleted from both.

### Usage

```bash
bonsai prune [flags]
```

Two guardrails make accidental deletion hard:

- At least one of `--older-than`, `--inactive`, `--artifact-type`, `--url`,
  `--topic`, or `--tags` is **required**; running `prune` with no filter exits
  `2` rather than matching everything.
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
| `--topic`                | `-t`  | string   | —       | Exact topic (case-insensitive), same matching as `list --topic`.                                                          |
| `--tags`                 | `-g`  | string   | —       | Tags to require (must match all), same matching as `list --tags`.                                                        |
| `--dry-run`              | —     | boolean  | `false` | Preview files without deleting. Mutually exclusive with `--yes`.                                                          |
| `--yes`                  | `-y`  | boolean  | `false` | Confirm deletion. Required for a real prune (rejected under `--read-only`).                                               |
| `--read-only` / `--plan` | —     | boolean  | `false` | Implicit preview; mutations disabled.                                                                                     |
| `--toon`                 | —     | boolean  | `false` | Emit the same envelope as `--json`, encoded as TOON (fewer tokens). Mutually exclusive with `--json`.                     |
| `--json`                 | —     | boolean  | `false` | Return the machine-readable envelope.                                                                                     |

`--older-than` and `--inactive` are distinct: a recently revalidated but originally-old page can match
`--older-than` while still failing `--inactive`. When some unlinks fail, `prunedCount` reports actual
deletes and the process exits `1`. `--topic` and `--tags` reject a whitespace-only value with
`INVALID_FLAG_VALUE` — an empty filter is almost always a shell-quoting mistake, not an intentional
"match everything" or "match nothing".

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

## 8. `config`

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
- `--toon`: emit the same envelope as `--json`, encoded as TOON (fewer tokens). Mutually exclusive with `--json`.
- `--json`: machine-readable envelope.

### Configuration keys

| Key       | Values                                   | Default        | Description                                                                                                                                                    |
| --------- | ---------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage` | `global`, `project`                      | `global`       | Where new research artifacts are cached.                                                                                                                       |
| `summary` | `conservative`, `balanced`, `aggressive` | `conservative` | How aggressively the `compressed` variant condenses prose (headings, code blocks, tables, and lists are always preserved). Also settable via `BONSAI_SUMMARY`. |

---

## 9. `context`

Compact, directory-scoped cache dashboard — total entries, a freshness breakdown, and the most
recently touched pages. This is what `setup`-installed `SessionStart` hooks pipe into an agent's
ambient context; see [Ambient session context](/how-to/agent-integration#ambient-session-context).

### Usage

```bash
bonsai context [flags]
```

### Command-Line Flags

| Flag          | Short | Type    | Default | Description                                                                                                                     |
| ------------- | ----- | ------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `--read-only` | —     | boolean | `false` | Skip persisting the search-index sidecar for this invocation (alias `--plan`). Also honored via `BONSAI_READ_ONLY`/`BONSAI_PLAN_MODE`. |
| `--toon`      | —     | boolean | `false` | Emit the same envelope as `--json`, encoded as TOON (fewer tokens). Mutually exclusive with `--json`.                            |
| `--json`      | —     | boolean | `false` | Format command response as machine-readable JSON.                                                                                |

### JSON Output envelope `data` block

```json
{
  "total": 3,
  "byFreshness": { "fresh": 2, "stale_grace": 1, "stale_expired": 0 },
  "shown": 3,
  "entries": [
    { "topic": "Node URL API", "sourceUrls": ["https://nodejs.org/api/url.html"], "freshness": "fresh" }
  ]
}
```

`entries` is capped to a small preview (5 by default); `total`/`byFreshness` always cover every
matched artifact, so the cap never hides the true count. `total: 0` is a definitive empty state,
not an ambiguous empty list.

---

## 10. `setup`

Installs or repairs a `SessionStart` hook that runs `bonsai context` at the start of every agent
session. See [Ambient session context](/how-to/agent-integration#ambient-session-context) for the
full workflow.

### Usage

```bash
bonsai setup <agent> [flags]
```

### Positional Arguments

- `<agent>`: Required string. `claude-code` or `codex`.

### Command-Line Flags

| Flag          | Short | Type    | Default   | Description                                                                                            |
| ------------- | ----- | ------- | --------- | -------------------------------------------------------------------------------------------------------- |
| `--global`    | `-g`  | boolean | `false`   | Install to the user-level hook file instead of the project (`~/.claude/settings.json` / `~/.codex/hooks.json`). |
| `--local`     | —     | boolean | (default) | Explicit form of the project-scoped default (`.claude/settings.json` / `.codex/hooks.json` under cwd). Mutually exclusive with `--global`. |
| `--dry-run`   | —     | boolean | `false`   | Preview the install without writing anything.                                                          |
| `--read-only` | —     | boolean | `false`   | Preview instead of writing (alias `--plan`). Also honored via `BONSAI_READ_ONLY`/`BONSAI_PLAN_MODE`.   |
| `--toon`      | —     | boolean | `false`   | Emit the same envelope as `--json`, encoded as TOON (fewer tokens). Mutually exclusive with `--json`.  |
| `--json`      | —     | boolean | `false`   | Format command response as machine-readable JSON.                                                      |

### JSON Output envelope `data` block

```json
{
  "agent": "claude-code",
  "scope": "project",
  "path": "/path/to/project/.claude/settings.json",
  "binCommand": "bonsai",
  "status": "installed" | "repaired" | "unchanged" | "would_install" | "would_repair",
  "dryRun": false
}
```

`status` is `"unchanged"` when a re-run finds an identical Bonsai-managed entry already in place
(idempotent no-op) and `"repaired"` when one exists but its command is stale (e.g. after a
reinstall to a new path) — either way, any other hooks already in the file are left untouched.

`opencode` is not yet a supported `<agent>` value — see [Ambient session
context](/how-to/agent-integration#ambient-session-context) for why.

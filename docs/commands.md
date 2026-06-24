# Command Reference

This document provides detailed specifications, flag arguments, and JSON schemas for Bonsai commands.

---

The package is published as `@taurgis/bonsai` and installs a `bonsai` binary. One-shot npm execution should use `npx @taurgis/bonsai ...`; after installation, use `bonsai ...`.

---

## 1. Root fetch command

The primary crawler and cache retriever command.

### Usage
```bash
npx @taurgis/bonsai <url> [flags]
```

### Positional Arguments
* `<url>`: Required string. The full HTTP or HTTPS URL to crawl.

### Command-Line Flags
| Flag | Short | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `--topic` | `-t` | string | `null` | Main topic category for search index and metadata tagging. |
| `--tags` | `-g` | string | `[]` | taxonomic tags (can be repeated). |
| `--format` | `-f` | choice | `compressed` | Output density format: `compressed` or `detailed`. |
| `--tier` | — | choice | `standard` | Freshness tier logic: `stable`, `standard`, or `volatile`. |
| `--ttl` | `-l` | duration | `null` | Custom lifespan override (e.g. "2h", "7d", "30d"). |
| `--max-age` | — | duration | `null` | Read-time threshold. Forces refresh if cache is older than duration. |
| `--force` | — | boolean | `false` | Ignore cached copies and force a full network crawl. |
| `--dry-run` | — | boolean | `false` | Crawl and extract without writing to cache. |
| `--allow-stale` | — | boolean | `false` | Allow serving stale entries if remote server is offline. |
| `--storage` | — | choice | (configured) | Override cache location for this run: `global` or `project`. Secret-bearing pages are always stored globally. |
| `--json` | — | boolean | `false` | Format command response as machine-readable JSON. |

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
    "cache": {
      "key": "0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7",
      "status": "hit" | "miss" | "revalidated" | "refreshed" | "stale",
      "freshness": "fresh" | "stale_grace" | "stale_expired",
      "path": "/path/to/research/cache/0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7.md",
      "storage": "global" | "project",
      "redirectedToGlobal": false
    },
    "source": {
      "url": "https://example.com",
      "normalizedUrl": "https://example.com/",
      "captureMethod": "static_fetch" | "browser_fallback" | "agent_supplied",
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

---

## 2. `import`

Save agent-supplied Markdown text directly to local storage.

### Usage
```bash
npx @taurgis/bonsai import [url] [flags]
```

### Positional Arguments
* `[url]`: Optional string. The target URL (only for single-source import). Must omit if `--source-url` is used.

### Command-Line Flags
* `--stdin`: Required. Indicates content is piped via standard input.
* `--source-url`: Repeated string. Source URLs representing a multi-source synthesis.
* `--input-format`: choice (`detailed` or `compressed`). Defaults to `detailed`.
* `--topic`: string. Categorized topic. **Required** for multi-source import.
* `--tags`, `--tier`, `--ttl`: Metadata options mapped to cache rules.
* `--storage`: choice (`global` or `project`). Override the configured cache location for this import. Notes containing secrets are always stored globally and never written to a project cache.

### JSON Output envelope `data` block
```json
{
  "cache": {
    "key": "sha256-import-hash...",
    "status": "imported",
    "freshness": "fresh",
    "path": "/path/to/cache.md",
    "storage": "global" | "project",
    "redirectedToGlobal": false
  },
  "source": {
    "url": "https://example.com",
    "normalizedUrl": "https://example.com/",
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

---

## 3. `status`

Inspect cache state and planning outcomes without performing fetches or writes.

### Usage
```bash
npx @taurgis/bonsai status <url> [flags]
```

### JSON Output envelope `data` block
```json
{
  "cacheKey": "0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7",
  "cachePath": "/path/to/0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7.md",
  "status": "hit" | "miss" | "stale",
  "freshness": "fresh" | "stale_grace" | "stale_expired",
  "action": "would_fetch" | "would_revalidate" | "would_return_cached"
}
```

---

## 4. `inspect`

Display cached headers and frontmatter metadata for a URL.

### Usage
```bash
npx @taurgis/bonsai inspect <url>
```

### JSON Output envelope `data` block
```json
{
  "cacheKey": "0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7",
  "cachePath": "/path/to/0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7.md",
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
  }
}
```

---

## 5. `search`

Rank local cache contents based on keyword scores.

### Usage
```bash
npx @taurgis/bonsai search "<query>" [flags]
```

### JSON Output envelope `data` block
```json
[
  {
    "cacheKey": "0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7",
    "path": "/path/to/cache/0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7.md",
    "artifactType": "source",
    "sourceUrls": ["https://example.com"],
    "topic": "example",
    "tags": ["test"],
    "freshness": "fresh",
    "captureMethod": "static_fetch",
    "tokenEstimate": { "compressed": 29, "detailed": 65 },
    "snippet": "...example domain is for use in documentation...",
    "score": 145
  }
]
```

---

## 6. `config`

Manage where the research cache is stored. Configuration is layered, resolved in
precedence order: per-command `--storage` flag > `BONSAI_STORAGE` env var >
project config (`.bonsai.json` in cwd) > user config (`config.json` in the OCLIF
config dir) > built-in default (`global`).

### Storage modes

| Mode | Cache location | Read behavior |
| --- | --- | --- |
| `global` (default) | OCLIF data dir (`<dataDir>/research/`) | Reads the global cache only. |
| `project` | `<cwd>/.bonsai/research/` (committable) | Reads the project cache first, then falls back to the global cache. |

The project cache is intended to be shared/committed with a repository. To keep
secrets out of version control, any artifact whose content matches a known
credential pattern (API keys, tokens, private keys, `secret=`/`token=`
assignments, etc.) is **always written to the global cache**, even when
`project` storage is selected — a warning is printed and the JSON envelope
reports `redirectedToGlobal: true`. The matched secret value is never echoed;
only the credential *type* is named.

### Subcommands

```bash
# Store this project's research cache inside the repo
npx @taurgis/bonsai config set storage project --local

# Set the user-wide default
npx @taurgis/bonsai config set storage global

# Inspect values
npx @taurgis/bonsai config get storage          # effective value
npx @taurgis/bonsai config get storage --local  # project file only
npx @taurgis/bonsai config list                 # all keys

# Remove a key (restores the default)
npx @taurgis/bonsai config unset storage --local
```

### Flags

* `--global` / `-g`: target the user-level config file (default for `set`/`unset`).
* `--local` / `--project` / `-p`: target the project-level config file (`.bonsai.json`).
* `--dry-run`: (`set`/`unset`) show the change without writing.
* `--json`: machine-readable envelope.

### Configuration keys

| Key | Values | Default | Description |
| --- | --- | --- | --- |
| `storage` | `global`, `project` | `global` | Where new research artifacts are cached. |

# Command Reference

This document provides detailed specifications, flag arguments, and JSON schemas for all subcommands in the `forward-nexus-plugin-research` plugin.

---

## 1. `research`

The primary crawler and cache retriever command.

### Usage
```bash
forward-nexus research <url> [flags]
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
| `--json` | — | boolean | `false` | Format command response as machine-readable JSON. |

### JSON Output Envelope Schema
```json
{
  "schemaVersion": 1,
  "command": "research",
  "ok": true,
  "exitCode": 0,
  "stdout": "",
  "stderr": "",
  "data": {
    "schemaVersion": 1,
    "command": "research",
    "cache": {
      "key": "0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7",
      "status": "hit" | "miss" | "revalidated" | "refreshed" | "stale",
      "freshness": "fresh" | "stale_grace" | "stale_expired",
      "path": "/path/to/research/cache/0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7.md"
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

## 2. `research import`

Save agent-supplied Markdown text directly to local storage.

### Usage
```bash
forward-nexus research import [url] [flags]
```

### Positional Arguments
* `[url]`: Optional string. The target URL (only for single-source import). Must omit if `--source-url` is used.

### Command-Line Flags
* `--stdin`: Required. Indicates content is piped via standard input.
* `--source-url`: Repeated string. Source URLs representing a multi-source synthesis.
* `--input-format`: choice (`detailed` or `compressed`). Defaults to `detailed`.
* `--topic`: string. Categorized topic. **Required** for multi-source import.
* `--tags`, `--tier`, `--ttl`: Metadata options mapped to cache rules.

### JSON Output envelope `data` block
```json
{
  "cache": {
    "key": "sha256-import-hash...",
    "status": "imported",
    "freshness": "fresh",
    "path": "/path/to/cache.md"
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

## 3. `research status`

Inspect cache state and planning outcomes without performing fetches or writes.

### Usage
```bash
forward-nexus research status <url> [flags]
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

## 4. `research inspect`

Display cached headers and frontmatter metadata for a URL.

### Usage
```bash
forward-nexus research inspect <url>
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

## 5. `research search`

Rank local cache contents based on keyword scores.

### Usage
```bash
forward-nexus research search "<query>" [flags]
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

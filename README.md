# Forward Nexus - Research Plugin

An advanced, local research result caching database plugin for the `forward-nexus` CLI.

Instead of AI agents constantly re-reading raw web pages, scraping HTML boilerplate, and manually deciding freshness, this plugin provides a robust local cache and search engine optimized for LLM context budgets.

---

## What it Does

| Feature | How it works | Typical Use Case |
| --- | --- | --- |
| **Scrape & Convert** | Static fetcher prunes stylesheets/scripts, converts HTML main article content to clean Markdown | Crawling API documentation or GitHub pages |
| **Cache-First Lookup** | Resolves URL to deterministic SHA-256 key, checks local storage for fresh cached notes | Avoiding repeated network fetches and API rate limits |
| **Token Budgeting** | Provides `detailed` (rich markup) or `compressed` (pruned images, absolute links) variants | Minimizing token usage in tight agent context windows |
| **Freshness Tiers** | Custom TTLs or default standard tiers (`stable`, `standard`, `volatile`) keep cache fresh | Tracking volatile release notes vs. stable standard specs |
| **Revalidation** | Uses HTTP ETags/Last-Modified headers to check freshness; allows stale fallback if offline | Quick, offline-first command executions |
| **Import Stdin** | Allows agents to manually import custom notes or synthesized results | Storing pre-crawled pages or manual research findings |
| **Keyword Search** | Instantly searches local cache metadata and snippets by query score | Retrieving existing cache content before executing new fetches |

---

## Installation & Setup

Before installing, ensure you have **Node.js 22 or newer** installed.

### 1. Linking into host CLI `forward-nexus`
To install this plugin locally for development or testing with the main `forward-nexus` CLI:

```bash
# Clone and build the research plugin
cd /path/to/forward-nexus-research
pnpm install
pnpm build

# Link the plugin to your global npm node_modules
npm link

# Link it into the main forward-nexus CLI repository
cd /path/to/forward-nexus
npm link forward-nexus-plugin-research
```

### 2. Standalone execution (Developer Mode)
You can run the plugin directly from its bin script inside this repository:

```bash
# Display help and description
node bin/cli.mjs research --help
```

---

## Step-by-Step Quick Start

Follow these steps to learn the research plugin commands in under 5 minutes.

### Step 1: Scrape and cache a URL
Let's crawl a public page. The first execution will perform a **cache miss** and fetch it from the web:

```bash
node bin/cli.mjs research https://nodejs.org/api/url.html
```
*Behind the scenes, the HTML is parsed, stripped of boilerplate, converted to Markdown, estimated for token size, and saved locally.*

### Step 2: Fast Cache Hit
Run the exact same command again:

```bash
node bin/cli.mjs research https://nodejs.org/api/url.html
```
*This time, the result returns instantly (0ms network request) because the cache is evaluated as fresh.*

### Step 3: Check Cache Status & Metadata
Before downloading or trusting content, you can inspect the cache status or check the metadata without printing the entire content payload.

```bash
# Check if the cache would hit, stale, or miss:
node bin/cli.mjs research status https://nodejs.org/api/url.html

# View full header metadata (topic, tags, fetched time, token count):
node bin/cli.mjs research inspect https://nodejs.org/api/url.html
```

### Step 4: Import Manual Research Notes
If automatic crawler extraction is insufficient, or if you want to store a synthesis from multiple sources, you can import clean Markdown via standard input (`stdin`):

```bash
# Single-source import:
echo "# My Custom Node API Notes" | node bin/cli.mjs research import https://nodejs.org/api/url.html --stdin

# Multi-source research synthesis:
echo "# Synthesized React Cache Guide" | node bin/cli.mjs research import --stdin --topic "React Suspense" --source-url https://react.dev/a --source-url https://react.dev/b
```

### Step 5: Keyword Search the Cache
To find existing cached results before making new network crawls, search the local database by keywords:

```bash
node bin/cli.mjs research search "node api url"
```

---

## Command Reference

### `research <url>`
Fetch and format a webpage, or retrieve it from the cache.

```bash
node bin/cli.mjs research <url> [flags]
```

**Common Flags:**
* `--topic`, `-t`: Primary category/topic for metadata tagging.
* `--tags`, `-g`: Searchable tags (can be repeated: `--tags node --tags url`).
* `--format`, `-f`: Output density: `compressed` (default) or `detailed`.
* `--tier`: Freshness tier: `stable`, `standard` (default), or `volatile`.
* `--ttl`, `-l`: Custom predicted lifespan (e.g. "2h", "7d", "30d").
* `--max-age`: Read-time freshness threshold. Forces refresh if cache is older than duration.
* `--force`: Force a fresh fetch, ignoring any cached entries.
* `--dry-run`: Scrape and validate the URL without writing to cache.
* `--allow-stale`: Serve stale cache if the remote site is offline or unreachable.
* `--json`: Return structured machine-readable JSON output (ideal for agents).

---

### `research import [url]`
Save custom synthesized Markdown notes directly to the cache database.

```bash
node bin/cli.mjs research import [url] --stdin [flags]
```

**Common Flags:**
* `--stdin`: Required flag indicating content is piped via stdin.
* `--input-format`: Density of the input content: `detailed` (default) or `compressed`.
* `--topic`: Required for multi-source imports.
* `--source-url`: Repeated flags specifying multiple source URLs for synthesis.
* `--tags`, `--tier`, `--ttl`: Same metadata mapping as main command.

---

### `research status <url>`
Inspect cache state and planned actions without executing reads or writes.

```bash
node bin/cli.mjs research status <url> [flags]
```
Returns: `cacheKey`, `cachePath`, `status` (`hit` / `miss` / `stale`), `freshness`, and `action` (`would_fetch` / `would_revalidate` / `would_return_cached`).

---

### `research inspect <url>`
Display full stored YAML frontmatter metadata for a URL.

```bash
node bin/cli.mjs research inspect <url>
```

---

### `research search <query>`
Scan the local cache and rank matching entries.

```bash
node bin/cli.mjs research search "<keywords>" [flags]
```

**Common Flags:**
* `--topic`: Filter results matching this exact topic.
* `--tags`: Filter results matching all specified tags.
* `--artifact-type`: Filter by type: `source` or `research_note`.
* `--limit`: Max results to return (default `10`, max `50`).
* `--include-stale`: Include expired cache files.

---

## Freshness and Cache Rules

Durable cache files are stored in your OS data directory:
- **macOS**: `~/.local/share/forward-nexus-plugin-research/research/` (or `~/Library/Application Support/forward-nexus/research/` when linked in the host CLI).

### Freshness Tiers
If no `--ttl` is specified, freshness is computed based on the assigned `--tier`:

| Tier | Fresh Duration | Grace Window (Stale Revalidation) | Use Case |
| --- | --- | --- | --- |
| `volatile` | 7 Days | 5 Days | Latest releases, volatile changelogs |
| `standard` | 30 Days | 14 Days | General API docs, developer guides |
| `stable` | 180 Days | 60 Days | RFCs, long-lived standards, language specifications |

### Offline and Revalidation Grace
1. **ETag / Last-Modified Check**: When an entry is stale but within its grace window, the command issues a quick `conditional GET` request using ETag/Last-Modified headers. If the server returns `304 Not Modified`, the local cache timestamp is bumped to fresh without re-downloading the page.
2. **Failure Exit Code 5**: If revalidation fails (e.g. server is offline or unreachable) and `--allow-stale` is omitted, the command serves the stale content but exits with status code `5`.

---

## Machine-Readable JSON Envelope

When run with `--json`, all commands return a standard JSON envelope:

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
      "status": "hit",
      "freshness": "fresh",
      "path": "/Users/user/.local/share/forward-nexus-plugin-research/research/0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7.md"
    },
    "source": {
      "url": "https://example.com",
      "normalizedUrl": "https://example.com/",
      "captureMethod": "static_fetch",
      "extractionStatus": "extracted",
      "extractionConfidence": "low",
      "qualityNotes": ["readability extracted main article"],
      "fetchedAt": "2026-06-24T07:33:20.519Z",
      "validatedAt": "2026-06-24T07:33:20.519Z",
      "staleAfter": "2026-07-24T07:33:20.519Z"
    },
    "format": "compressed",
    "tokenEstimate": 29,
    "content": "Cleaned main content markdown text..."
  }
}
```

---

## Security & Limitations

* **Untrusted HTML Parsing**: Parsing is isolated within a lightweight virtual DOM (`linkedom`). All script tags, event handlers, styles, and iframes are stripped.
* **No Authentication**: Authenticated or private page scraping is not supported in the MVP.
* **No Client-side JS Hydration**: Pages that are single-page apps (SPAs) relying heavily on client-side JS/React execution to render body content may yield empty markdown.
* **Protocol Whitelist**: Only `http:` and `https:` URL schemes are accepted. Local file systems (`file:///`) are rejected to prevent directory traversal attacks.

---

## Reference Documentation

For detailed information on design decisions, specifications, limits, and configurations:

* **[Command Reference](file:///Users/thomastheunen/Documents/Projects/forward-nexus-research/docs/commands.md)**: Detailed specifications, flags, arguments, and JSON schemas for all CLI subcommands.
* **[Caching Protocol Specification](file:///Users/thomastheunen/Documents/Projects/forward-nexus-research/docs/cache-protocol.md)**: Deep dive on local directories, URL normalization rules, YAML frontmatter schemas, freshness policies, and revalidation flow.
* **[Troubleshooting & Limitations](file:///Users/thomastheunen/Documents/Projects/forward-nexus-research/docs/troubleshooting.md)**: Technical limits (size, timeouts, redirects), DNS private IP blocklists, client-side hydration constraints, and exit codes.


# Bonsai

Bonsai is a standalone local research cache CLI for AI agents. It turns official documentation and web pages into source-cited Markdown artifacts, stores them in a durable local cache, and returns deterministic output that agents can reuse instead of repeatedly scraping the same pages.

The package is published as `@taurgis/bonsai` and installs a `bonsai` binary.

> Because the npm package is scoped, the correct one-shot command is `npx @taurgis/bonsai ...`. The unscoped `npx bonsai` name resolves to the separate `bonsai` package on npm unless an unscoped shim is published later.

---

## What it Does

| Feature | How it works | Typical use case |
| --- | --- | --- |
| **Scrape and convert** | Fetches HTML, extracts main content, sanitizes unsafe markup, and converts it to deterministic Markdown | Capturing API docs, guides, standards, and changelogs |
| **Cache-first lookup** | Normalizes URLs to collision-resistant SHA-256 keys before fetching | Avoiding duplicate network requests and repeated agent research |
| **Token budgeting** | Returns `compressed` or `detailed` Markdown variants | Fitting research into limited context windows without losing full detail |
| **Freshness tiers** | Supports `stable`, `standard`, `volatile`, custom TTLs, and stale revalidation | Handling standards differently from release notes or beta docs |
| **Browser fallback** | Uses `--rendered` for pages that need client-side JavaScript | Capturing SPA documentation when static HTML is incomplete |
| **Manual import** | Stores agent-supplied Markdown from stdin or files | Caching synthesized notes, private docs, or manually extracted pages |
| **Search** | Ranks local cache entries by topic, tags, snippets, fuzzy terms, and phrases | Finding existing research before fetching again |

---

## Installation

Requires Node.js 22 or newer.

Run Bonsai without installing it globally:

```bash
npx @taurgis/bonsai https://nodejs.org/api/url.html
```

Install it as a normal CLI:

```bash
npm install -g @taurgis/bonsai
bonsai https://nodejs.org/api/url.html
```

Use the local development binary inside this repository:

```bash
pnpm install
pnpm build
node bin/cli.mjs --help
```

## Quick Start

### 1. Fetch and cache a URL

```bash
npx @taurgis/bonsai https://nodejs.org/api/url.html
```

The first run fetches the page, extracts the main article content, converts it to Markdown, estimates token size, and stores it locally.

### 2. Reuse the cache

```bash
npx @taurgis/bonsai https://nodejs.org/api/url.html
```

The second run returns from cache when the entry is still fresh.

### 3. Check cache state and metadata

```bash
npx @taurgis/bonsai status https://nodejs.org/api/url.html
npx @taurgis/bonsai inspect https://nodejs.org/api/url.html
```

### 4. Import manual research notes

```bash
echo "# My Custom Node API Notes" | npx @taurgis/bonsai import https://nodejs.org/api/url.html --stdin

echo "# Synthesized React Cache Guide" | npx @taurgis/bonsai import --stdin --topic "React Suspense" --source-url https://react.dev/a --source-url https://react.dev/b
```

### 5. Search before fetching

```bash
npx @taurgis/bonsai search "node api url"
```

---

## Command Reference

### `<url>`

Fetch and format a webpage, or retrieve it from cache.

```bash
npx @taurgis/bonsai <url> [flags]
```

Common flags:

* `--topic`, `-t`: Primary category/topic for metadata tagging.
* `--tags`, `-g`: Searchable tags. Can be repeated.
* `--format`, `-f`: Output density: `compressed` or `detailed`.
* `--tier`: Freshness tier: `stable`, `standard`, or `volatile`.
* `--ttl`, `-l`: Custom predicted lifespan, such as `2h`, `7d`, or `30d`.
* `--max-age`: Read-time freshness threshold.
* `--force`: Force a fresh fetch.
* `--dry-run`: Scrape and validate without writing to cache.
* `--allow-stale`: Serve stale cache if the remote site is offline.
* `--rendered`: Use browser-rendered extraction for SPA pages.
* `--json`: Return structured machine-readable output.

### `import [url]`

Save custom Markdown notes directly to the cache.

```bash
npx @taurgis/bonsai import [url] --stdin [flags]
```

### `status <url>`

Inspect cache state and planned action without fetching.

```bash
npx @taurgis/bonsai status <url> [flags]
```

### `inspect <url>`

Display stored YAML frontmatter metadata for a URL.

```bash
npx @taurgis/bonsai inspect <url>
```

### `search <query>`

Search cached research by metadata and content snippets.

```bash
npx @taurgis/bonsai search "<keywords>" [flags]
```

### `config`

Choose global or project-local cache storage.

```bash
npx @taurgis/bonsai config set storage project --local
```

Project config is stored in `.bonsai.json`; project cache files are stored under `.bonsai/research/`.

---

## Freshness and Cache Rules

Global cache files live in Bonsai's oclif data directory, typically:

* **macOS**: `~/Library/Application Support/bonsai/research/`
* **Linux**: `~/.local/share/bonsai/research/`
* **Windows**: `%LOCALAPPDATA%\bonsai\research\`

Project-local storage uses:

* `.bonsai.json` for the project config
* `.bonsai/research/` for Markdown cache artifacts

If no `--ttl` is specified, freshness is computed from the tier:

| Tier | Fresh duration | Grace window | Use case |
| --- | --- | --- | --- |
| `volatile` | 7 days | 5 days | Latest releases, volatile changelogs, beta docs |
| `standard` | 30 days | 14 days | General API docs and developer guides |
| `stable` | 180 days | 60 days | RFCs, standards, long-lived references |

When stale entries still have `ETag` or `Last-Modified` metadata, Bonsai attempts cheap revalidation before a full refetch. If revalidation fails and `--allow-stale` is omitted, the CLI can serve the stale content while exiting with code `5`.

---

## JSON Envelope

When run with `--json`, commands return a stable envelope:

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
      "status": "hit",
      "freshness": "fresh",
      "path": "/Users/user/Library/Application Support/bonsai/research/0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7.md"
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

## Security and Limits

* Fetched HTML is treated as untrusted input.
* Only `http:` and `https:` URLs are accepted.
* Private and local IP ranges are blocked to reduce SSRF risk.
* Static extraction does not execute JavaScript; use `--rendered` when a page needs browser execution.
* Authenticated/private scraping is not supported in the default workflow. Import trusted Markdown manually instead.

---

## Reference Documentation

* [Command Reference](docs/commands.md)
* [Caching Protocol Specification](docs/cache-protocol.md)
* [Troubleshooting and Limitations](docs/troubleshooting.md)
